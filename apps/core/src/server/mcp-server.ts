import type { ProjectFrameworkAdapter, ProjectStore } from '../project-store';
import type { AgentSessionSnapshot, AgentSessionStore } from './agent-session-store';

import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  McpServer,
  originValidationResponse
} from '@modelcontextprotocol/server';
import { z } from 'zod';

import { findGitProjectRoot } from '../git-project-root';
import { detectProjectTargets } from '../project-target-detection';
import { simulatorBridge } from '../simulator-bridge';
import { captureSimulatorScreen } from '../simulators';
import { CoreApiError } from './api-error';

type ProjectResolver = Pick<ProjectStore, 'list' | 'add'>;

const sessionIdSchema = z.string().uuid();
const requestIdSchema = z.string().uuid();
const frameworkVariantValues = ['original', 'v1', 'v2', 'v3', 'v4', 'v5'] as const;
const defaultWaitMs = 120_000;

const structuredResult = (value: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value
});

const sessionResult = (session: AgentSessionSnapshot, presentation?: { uiUrl: string }) =>
  structuredResult({ session, ...(presentation ?? {}) });
const stateResult = (session: AgentSessionSnapshot) =>
  structuredResult({
    state: {
      id: session.id,
      status: session.status,
      revision: session.revision,
      updatedAt: session.updatedAt,
      ...(session.connection ? { connection: session.connection } : {}),
      ...(session.changeRequest ? { changeRequest: session.changeRequest } : {}),
      ...(session.publishedVariants ? { publishedVariants: session.publishedVariants } : {}),
      ...(session.captureFailure ? { captureFailure: session.captureFailure } : {}),
      ...(session.confirmedSelection ? { confirmedSelection: session.confirmedSelection } : {}),
      ...(session.lastResult ? { lastResult: session.lastResult } : {})
    }
  });

const frameworkAdapterSchema = z.object({
  schemaVersion: z.literal(1),
  framework: z.enum(['swiftui', 'uikit-swift', 'uikit-objective-c', 'react-native', 'expo', 'flutter']),
  sourceRoots: z.array(z.string().trim().min(1)).min(1),
  variant: z.object({
    bridge: z.enum(['native-launch-arguments', 'react-native-initial-properties', 'flutter-method-channel']),
    bootstrapPath: z.string().trim().min(1),
    launchArgument: z.literal('-MonadDesignVariant'),
    values: z.array(z.enum(frameworkVariantValues)).length(frameworkVariantValues.length)
  }),
  build: z.object({
    system: z.enum(['xcodebuild', 'react-native', 'expo', 'flutter', 'custom']),
    workingDirectory: z.string().trim().min(1),
    configuration: z.literal('Debug'),
    containerPath: z.string().trim().min(1).optional(),
    scheme: z.string().trim().min(1).optional(),
    flavor: z.string().trim().min(1).optional(),
    command: z.array(z.string().trim().min(1)).min(1).optional(),
    artifactPath: z.string().trim().min(1).optional()
  }),
  navigation: z.object({
    strategy: z.enum(['app-router', 'deep-link', 'state-restoration', 'debug-bootstrap']),
    bootstrapPath: z.string().trim().min(1)
  })
});

const canonicalPath = async (path: string) => realpath(resolve(path)).catch(() => resolve(path));

const requireConnectedSession = (sessions: AgentSessionStore, sessionId: string) => {
  const session = sessions.get(sessionId);
  const connection = simulatorBridge.connection;
  if (
    !session.connection ||
    !connection ||
    connection.projectId !== session.project.id ||
    connection.udid !== session.connection.udid ||
    connection.bundleIdentifier !== session.connection.bundleIdentifier
  ) {
    throw new CoreApiError(409, 'CONFLICT', 'The Simulator connection for this live session is not active.');
  }
  return { connection, session };
};

const ensureProjectBinding = async (projects: ProjectResolver, workspacePath: string) => {
  const requestedPath = await canonicalPath(workspacePath);
  const registeredPaths = await Promise.all((await projects.list()).map(({ path }) => canonicalPath(path)));
  const registered = registeredPaths.some(
    (path) => requestedPath === path || requestedPath.startsWith(`${path}${sep}`)
  );
  if (registered) return;

  let root: string;
  try {
    root = await findGitProjectRoot(requestedPath);
  } catch (error) {
    throw new CoreApiError(
      409,
      'CONFLICT',
      error instanceof Error ? error.message : 'The workspace is not inside a Git repository.'
    );
  }
  const detection = await detectProjectTargets(root);
  if (detection.candidates.length === 0) {
    throw new CoreApiError(
      409,
      'CONFLICT',
      `Monad Design could not bind ${root}: no explicit iOS Bundle ID was detected in Expo or Xcode project metadata.`
    );
  }
  await projects.add(
    root,
    detection.candidates.map(({ bundleIdentifier, name, sourcePath }) => ({ bundleIdentifier, name, sourcePath }))
  );
};

const buildMcpServer = (projects: ProjectResolver, sessions: AgentSessionStore, uiUrl: () => string) => {
  const server = new McpServer(
    { name: 'monad-design', version: '1.0.0' },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        'Use this server through the monad-design skill. Project bootstrap is returned once; change events contain only turn-local requests and runtime context.'
    }
  );

  server.registerTool(
    'start_live_session',
    {
      title: 'Start Monad Design live session',
      description:
        'Open the Monad Design project containing a local workspace path. If it is not registered, detect its Git root and iOS targets and bind it automatically before live configuration.',
      inputSchema: z.object({
        workspacePath: z.string().min(1).describe('Absolute path inside the current local project.'),
        task: z.string().trim().min(1).max(10_000).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ task, workspacePath }) => {
      await ensureProjectBinding(projects, workspacePath);
      return sessionResult(await sessions.create(workspacePath, task), { uiUrl: uiUrl() });
    }
  );

  server.registerTool(
    'configure_live_project',
    {
      title: 'Configure Monad Design live project',
      description:
        'Persist framework, variant bridge, build, and navigation facts for every target app on the first live connection. This unlocks the Simulator picker.',
      inputSchema: z.object({
        sessionId: sessionIdSchema,
        targets: z.array(z.object({ bundleIdentifier: z.string().trim().min(1), live: frameworkAdapterSchema })).min(1)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ sessionId, targets }) =>
      sessionResult(
        await sessions.configureProject(
          sessionId,
          targets as Array<{ bundleIdentifier: string; live: ProjectFrameworkAdapter }>
        )
      )
  );

  server.registerTool(
    'get_live_session',
    {
      title: 'Get Monad Design live session',
      description: 'Read one live session, or the current active session when sessionId is omitted.',
      inputSchema: z.object({ sessionId: sessionIdSchema.optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    ({ sessionId }) => {
      const session = sessionId ? sessions.get(sessionId) : sessions.active();
      return structuredResult({ session });
    }
  );

  server.registerTool(
    'wait_for_change',
    {
      title: 'Wait for Monad Design change',
      description:
        'Wait until a live session revision changes or the bounded timeout expires. Reuse the returned revision for the next wait. Client transport timeouts are recoverable and callers should reconcile the session before polling again.',
      inputSchema: z.object({
        sessionId: sessionIdSchema,
        afterRevision: z.number().int().nonnegative(),
        waitMs: z.number().int().min(0).max(defaultWaitMs).default(defaultWaitMs)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ afterRevision, sessionId, waitMs }) => stateResult(await sessions.wait(sessionId, afterRevision, waitMs))
  );

  server.registerTool(
    'claim_change',
    {
      title: 'Claim Monad Design change',
      description: 'Claim the exact active change request before editing source.',
      inputSchema: z.object({ sessionId: sessionIdSchema, requestId: requestIdSchema }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    ({ requestId, sessionId }) => stateResult(sessions.claim(sessionId, requestId))
  );

  server.registerTool(
    'capture_simulator_context',
    {
      title: 'Capture Simulator context',
      description:
        'Capture the connected Simulator screenshot and/or accessibility tree for a live session. Runtime evidence is not guaranteed source mapping.',
      inputSchema: z.object({
        sessionId: sessionIdSchema,
        includeScreenshot: z.boolean().default(true),
        includeAccessibility: z.boolean().default(true)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ includeAccessibility, includeScreenshot, sessionId }) => {
      const { connection, session } = requireConnectedSession(sessions, sessionId);
      const accessibility = includeAccessibility ? await simulatorBridge.accessibilitySnapshot() : undefined;
      const screenshot = includeScreenshot ? await captureSimulatorScreen(connection.udid) : undefined;
      const metadata = {
        sessionId: session.id,
        connection: session.connection,
        ...(accessibility ? { accessibility } : {})
      };
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(metadata, null, 2) },
          ...(screenshot
            ? [
                {
                  type: 'image' as const,
                  data: screenshot.slice('data:image/png;base64,'.length),
                  mimeType: 'image/png'
                }
              ]
            : [])
        ],
        structuredContent: metadata
      };
    }
  );

  server.registerTool(
    'publish_variants',
    {
      title: 'Publish Monad Design variants',
      description:
        'After building and installing all requested Debug variants, notify Monad Design to capture and present them for user selection.',
      inputSchema: z.object({
        sessionId: sessionIdSchema,
        requestId: requestIdSchema,
        summary: z.string().trim().min(1).max(20_000)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ requestId, sessionId, summary }) =>
      stateResult(await sessions.publishVariants(sessionId, requestId, summary))
  );

  server.registerTool(
    'complete_change',
    {
      title: 'Complete Monad Design change',
      description:
        'After the user confirms a variant and the agent permanently applies it, removes temporary variant code, builds, and installs, relaunch the final app and finish the request.',
      inputSchema: z.object({
        sessionId: sessionIdSchema,
        requestId: requestIdSchema,
        summary: z.string().trim().min(1).max(20_000)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ requestId, sessionId, summary }) => stateResult(await sessions.complete(sessionId, requestId, summary))
  );

  server.registerTool(
    'close_live_session',
    {
      title: 'Close Monad Design live session',
      description: 'Close the live session when the user explicitly ends the editing loop.',
      inputSchema: z.object({ sessionId: sessionIdSchema }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ sessionId }) => stateResult(await sessions.close(sessionId))
  );

  server.registerResource(
    'projects',
    'monaddesign://projects',
    {
      title: 'Registered Monad Design projects',
      description: 'Local project roots and configured iOS target apps.',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await projects.list(), null, 2) }]
    })
  );

  server.registerResource(
    'active-session',
    'monaddesign://session/active',
    {
      title: 'Active Monad Design live session',
      description: 'The current process-local live editing session, or null.',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(sessions.active(), null, 2) }]
    })
  );

  return server;
};

export const createMonadDesignMcpHandler = (
  projects: ProjectResolver,
  sessions: AgentSessionStore,
  uiUrl: () => string
) => {
  const handler = createMcpHandler(() => buildMcpServer(projects, sessions, uiUrl));
  return {
    close: () => handler.close(),
    fetch: (request: Request, parsedBody?: unknown) => {
      const rejected =
        hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
        originValidationResponse(request, localhostAllowedOrigins());
      return rejected ?? handler.fetch(request, parsedBody === undefined ? undefined : { parsedBody });
    }
  };
};
