import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import { ProjectStore } from '../../src/project-store';
import { CoreServer } from '../../src/server/core-server';

const servers: CoreServer[] = [];
const temporaryDirectories: string[] = [];

const arraySchemasWithoutItems = (value: unknown, path = '$'): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => arraySchemasWithoutItems(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  const schema = value as Record<string, unknown>;
  return [
    ...(schema.type === 'array' && !('items' in schema) ? [path] : []),
    ...Object.entries(schema).flatMap(([key, item]) => arraySchemasWithoutItems(item, `${path}.${key}`))
  ];
};

const live = {
  schemaVersion: 1 as const,
  framework: 'swiftui' as const,
  sourceRoots: ['Example'],
  variant: {
    bridge: 'native-launch-arguments' as const,
    bootstrapPath: 'Example/MonadDesignVariant.swift',
    launchArgument: '-MonadDesignVariant' as const,
    values: ['original', 'v1', 'v2', 'v3', 'v4', 'v5'] as ['original', 'v1', 'v2', 'v3', 'v4', 'v5']
  },
  build: {
    system: 'xcodebuild' as const,
    workingDirectory: '.',
    configuration: 'Debug' as const,
    containerPath: 'Example.xcodeproj',
    scheme: 'Example'
  },
  navigation: { strategy: 'debug-bootstrap' as const, bootstrapPath: 'Example/PreviewRouter.swift' }
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const projects = [
  {
    id: 'project-1',
    name: 'Example',
    path: '/tmp/example',
    configPath: '/tmp/example/.monaddesign/project.json',
    lastOpenedAt: '2026-08-28T00:00:00.000Z',
    targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example App', live }]
  },
  {
    id: 'project-2',
    name: 'Second',
    path: '/tmp/second',
    configPath: '/tmp/second/.monaddesign/project.json',
    lastOpenedAt: '2026-08-27T00:00:00.000Z',
    targetApps: []
  }
];

const projectStore = {
  list: async () => projects,
  add: async () => {
    const project = projects[0];
    if (!project) throw new Error('Project not found.');
    return project;
  },
  configure: async () => {
    const project = projects[0];
    if (!project) throw new Error('Project not found.');
    return project;
  },
  open: async (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) throw new Error('Project not found.');
    return project;
  },
  icons: async (id: string): Promise<Record<string, string>> =>
    id === 'project-1' ? { 'com.example.app': 'data:image/png;base64,aWNvbg==' } : {},
  remove: async () => undefined,
  configureLiveTargets: async () => {
    const project = projects[0];
    if (!project) throw new Error('Project not found.');
    return project;
  }
};

const startServer = async () => {
  const server = new CoreServer(projectStore, {
    host: '127.0.0.1',
    port: 0,
    pairingCode: '123456',
    localAccessToken: 'local-test-token'
  });
  servers.push(server);
  await server.start();
  return {
    server,
    origin: `http://127.0.0.1:${server.status.port}`
  };
};

const authorizedHeaders = {
  Authorization: 'Bearer 123456',
  'Content-Type': 'application/json'
};

describe('Core server', () => {
  test('registers the simulator input WebSocket with the Node adapter', async () => {
    const warning = spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await startServer();
      expect(warning).not.toHaveBeenCalledWith("Current adapter doesn't support WebSocket");
    } finally {
      warning.mockRestore();
    }
  });

  test('publishes v1 health but protects feature routes', async () => {
    const { origin } = await startServer();

    const health = await fetch(`${origin}/v1/health`);
    expect(await health.json()).toMatchObject({
      name: 'Monad Design Core',
      protocolVersion: 1,
      apiVersion: 'v1'
    });

    const projects = await fetch(`${origin}/v1/projects`);
    expect(projects.status).toBe(401);
    expect(await projects.json()).toMatchObject({
      error: 'The pairing code is invalid.',
      code: 'UNAUTHORIZED',
      retryable: false
    });

    const simulator = await fetch(`${origin}/v1/simulator/appearance`);
    expect(simulator.status).toBe(401);
  });

  test('uses the standard offset pagination response', async () => {
    const { origin } = await startServer();

    const response = await fetch(`${origin}/v1/projects?limit=1&offset=1`, {
      headers: authorizedHeaders
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projects: [
        {
          id: 'project-2',
          name: 'Second',
          lastOpenedAt: '2026-08-27T00:00:00.000Z',
          targetApps: []
        }
      ],
      limit: 1,
      offset: 1,
      total: 2
    });
  });

  test('serves resolved target app icons to the paired mobile client', async () => {
    const { origin } = await startServer();

    const response = await fetch(`${origin}/v1/projects/project-1/icons`, {
      headers: authorizedHeaders
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      icons: { 'com.example.app': 'data:image/png;base64,aWNvbg==' }
    });
  });

  test('accepts the private localhost client token without exposing it in pairing status', async () => {
    const { origin, server } = await startServer();

    expect(server.status).not.toHaveProperty('accessToken');
    expect(server.localClient).toEqual({
      origin,
      accessToken: 'local-test-token'
    });
    const response = await fetch(`${origin}/v1/projects`, {
      headers: { Authorization: 'Bearer local-test-token' }
    });
    expect(response.status).toBe(200);

    const streamStyleResponse = await fetch(`${origin}/v1/projects?accessToken=local-test-token`);
    expect(streamStyleResponse.status).toBe(200);
  });

  test('keeps local project paths behind the Core admin token', async () => {
    const { origin } = await startServer();

    const companionResponse = await fetch(`${origin}/v1/admin/projects/`, {
      headers: authorizedHeaders
    });
    expect(companionResponse.status).toBe(401);

    const adminResponse = await fetch(`${origin}/v1/admin/projects/`, {
      headers: { Authorization: 'Bearer local-test-token' }
    });
    expect(adminResponse.status).toBe(200);
    const adminProjects = (await adminResponse.json()) as { projects: Array<Record<string, unknown>> };
    expect(adminProjects.projects[0]).toMatchObject({
      id: 'project-1',
      path: '/tmp/example',
      configPath: '/tmp/example/.monaddesign/project.json'
    });
  });

  test('shares one live editing session between MCP and the paired companion', async () => {
    const { origin } = await startServer();
    expect((await fetch(`${origin}/v1/agent-session/active`)).status).toBe(401);

    const client = new Client({ name: 'monad-design-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
    try {
      const tools = (await client.listTools()).tools;
      expect(tools.map(({ name }) => name)).toEqual([
        'start_live_session',
        'configure_live_project',
        'get_live_session',
        'wait_for_change',
        'claim_change',
        'capture_simulator_context',
        'publish_variants',
        'complete_change',
        'close_live_session'
      ]);
      const configureTool = tools.find(({ name }) => name === 'configure_live_project');
      expect(arraySchemasWithoutItems(configureTool?.inputSchema)).toEqual([]);
      const waitTool = tools.find(({ name }) => name === 'wait_for_change');
      expect(waitTool?.inputSchema).toMatchObject({
        properties: { waitMs: { default: 120_000, maximum: 120_000 } }
      });

      const started = await client.callTool({
        name: 'start_live_session',
        arguments: { workspacePath: '/tmp/example/features/profile', task: 'Adjust the title' }
      });
      expect(started.structuredContent).toMatchObject({
        session: {
          project: { id: 'project-1', path: '/tmp/example' },
          task: 'Adjust the title',
          status: 'selecting_simulator',
          revision: 1
        }
      });
      const startedSession = (started.structuredContent as { session: { id: string } }).session;

      const activeResponse = await fetch(`${origin}/v1/agent-session/active`, { headers: authorizedHeaders });
      expect(activeResponse.status).toBe(200);
      const active = (await activeResponse.json()) as { session: { id: string; project: Record<string, unknown> } };
      expect(active.session).toMatchObject({
        id: startedSession.id,
        project: { id: 'project-1' },
        status: 'selecting_simulator'
      });
      expect(active.session.project).not.toHaveProperty('path');

      const connectedResponse = await fetch(`${origin}/v1/agent-session/${active.session.id}/connected`, {
        method: 'POST',
        headers: authorizedHeaders,
        body: JSON.stringify({ udid: 'simulator-1', bundleIdentifier: 'com.example.app' })
      });
      expect(connectedResponse.status).toBe(200);

      const requestResponse = await fetch(`${origin}/v1/agent-session/${active.session.id}/request`, {
        method: 'POST',
        headers: authorizedHeaders,
        body: JSON.stringify({
          request: 'Increase the title contrast.',
          variantCount: 2,
          context: {
            simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' },
            currentScreen: { screen: { width: 390, height: 844 }, elements: [] }
          }
        })
      });
      expect(requestResponse.status).toBe(200);
      expect(await requestResponse.json()).toMatchObject({
        status: 'change_requested',
        changeRequest: { request: 'Increase the title contrast.', variantCount: 2 }
      });

      const projectsResource = await client.readResource({ uri: 'monaddesign://projects' });
      const projectsContent = projectsResource.contents[0];
      expect(JSON.parse(projectsContent && 'text' in projectsContent ? projectsContent.text : '[]')).toHaveLength(2);
    } finally {
      await client.close();
    }
  });

  test('configures an unadapted project through MCP before Simulator selection', async () => {
    const baseProject = projects[0];
    if (!baseProject) throw new Error('Project fixture is missing.');
    const unconfigured = {
      ...baseProject,
      targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example App' }]
    };
    const projectStore = {
      list: async () => [unconfigured],
      add: async () => unconfigured,
      open: async () => unconfigured,
      configureLiveTargets: async () => ({
        ...unconfigured,
        targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example App', live }]
      })
    };
    const server = new CoreServer(projectStore, { host: '127.0.0.1', port: 0 });
    servers.push(server);
    await server.start();
    const client = new Client({ name: 'monad-design-config-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.status.port}/mcp`)));
    try {
      const started = await client.callTool({
        name: 'start_live_session',
        arguments: { workspacePath: '/tmp/example' }
      });
      const session = (started.structuredContent as { session: { id: string } }).session;
      expect(started.structuredContent).toMatchObject({ session: { status: 'configuring_project' } });

      const configured = await client.callTool({
        name: 'configure_live_project',
        arguments: {
          sessionId: session.id,
          targets: [{ bundleIdentifier: 'com.example.app', live }]
        }
      });
      expect(configured.structuredContent).toMatchObject({
        session: {
          status: 'selecting_simulator',
          project: { targetApps: [{ live: { framework: 'swiftui' } }] }
        }
      });
    } finally {
      await client.close();
    }
  });

  test('automatically binds an unregistered Git project before starting live configuration', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'monaddesign-auto-bind-test-'));
    temporaryDirectories.push(parent);
    const root = join(parent, 'Example');
    const boundRoot = await realpath(parent).then((canonicalParent) => join(canonicalParent, 'Example'));
    const workspace = join(root, 'Sources', 'Feature');
    await mkdir(workspace, { recursive: true });
    execFileSync('git', ['init', '--quiet', root], { stdio: 'ignore' });
    await writeFile(
      join(root, 'app.json'),
      JSON.stringify({ expo: { name: 'Example', ios: { bundleIdentifier: 'com.example.autobound' } } }),
      'utf8'
    );
    const store = new ProjectStore(join(parent, 'state', 'projects.json'));
    const server = new CoreServer(store, { host: '127.0.0.1', port: 0 });
    servers.push(server);
    await server.start();
    const client = new Client({ name: 'monad-design-auto-bind-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.status.port}/mcp`)));
    try {
      const started = await client.callTool({
        name: 'start_live_session',
        arguments: { workspacePath: workspace }
      });
      expect(started).toMatchObject({
        structuredContent: {
          session: {
            project: {
              path: boundRoot,
              targetApps: [{ bundleIdentifier: 'com.example.autobound', sourcePath: 'app.json' }]
            },
            status: 'configuring_project'
          }
        }
      });
      expect(JSON.parse(await readFile(join(root, '.monaddesign', 'project.json'), 'utf8'))).toMatchObject({
        schemaVersion: 1,
        simulator: { targetApps: [{ bundleIdentifier: 'com.example.autobound' }] }
      });
      expect(await store.list()).toHaveLength(1);
    } finally {
      await client.close();
    }
  });

  test('rejects non-local MCP Host headers before protocol handling', async () => {
    const { origin } = await startServer();
    const response = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: { Host: 'malicious.example', 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(response.status).toBe(403);
  });

  test('standardizes validation and not-found errors', async () => {
    const { origin } = await startServer();
    const validation = await fetch(`${origin}/v1/projects?limit=0`, {
      headers: authorizedHeaders
    });
    expect(validation.status).toBe(400);
    expect(await validation.json()).toMatchObject({
      error: 'request validation failed',
      code: 'VALIDATION',
      retryable: false
    });
    expect(validation.headers.get('x-monad-design-request-id')).toMatch(/^req_/);

    const missing = await fetch(`${origin}/v1/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: 'not found',
      code: 'NOT_FOUND'
    });
  });
});
