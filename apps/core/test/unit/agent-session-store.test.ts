import type { AgentSessionSnapshot } from '../../src/server/agent-session-store';

import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AgentSessionStore } from '../../src/server/agent-session-store';

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
  navigation: { strategy: 'debug-bootstrap' as const, bootstrapPath: 'Example/MonadDesignPreviewRouter.swift' }
};

const project = {
  id: 'project-1',
  name: 'Example',
  path: '/tmp/example',
  configPath: '/tmp/example/.monaddesign/project.json',
  lastOpenedAt: '2026-08-28T00:00:00.000Z',
  targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example App', live }]
};

const projectStore = {
  list: async () => [project],
  open: async () => project,
  configureLiveTargets: async () => project
};

describe('agent session store', () => {
  test('publishes the requested variants, returns the confirmed selection, and completes after cleanup', async () => {
    const changes: AgentSessionSnapshot[] = [];
    const restarts: AgentSessionSnapshot[] = [];
    const sessions = new AgentSessionStore(projectStore, {
      onChanged: (session) => changes.push(session),
      restartApp: async (session) => {
        restarts.push(session);
      }
    });

    const created = await sessions.create('/tmp/example/features/profile', 'Polish the profile screen');
    expect(created.status).toBe('selecting_simulator');
    expect(created.project.id).toBe(project.id);
    expect(sessions.active()?.id).toBe(created.id);

    const connected = sessions.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });
    expect(connected.status).toBe('awaiting_request');

    const requested = await sessions.request(created.id, {
      request: 'Increase the title contrast',
      variantCount: 2,
      context: { simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' } }
    });
    expect(requested.status).toBe('change_requested');
    expect(requested.changeRequest?.request).toBe('Increase the title contrast');
    expect(requested.changeRequest?.variantCount).toBe(2);
    expect(requested.changeRequest?.context.simulator.udid).toBe('simulator-1');
    expect(requested.changeRequest).not.toHaveProperty('prompt');

    const claimed = sessions.claim(created.id, requested.changeRequest?.id ?? 'missing');
    expect(claimed.status).toBe('working');

    const published = await sessions.publishVariants(
      created.id,
      requested.changeRequest?.id ?? 'missing',
      'Built original plus two variants.'
    );
    expect(published.status).toBe('variants_ready');
    expect(published.publishedVariants?.summary).toBe('Built original plus two variants.');

    const confirmed = sessions.confirmSelection(created.id, requested.changeRequest?.id ?? 'missing', 'v2');
    expect(confirmed.status).toBe('selection_confirmed');
    expect(confirmed.confirmedSelection?.variant).toBe('v2');

    const completed = await sessions.complete(
      created.id,
      requested.changeRequest?.id ?? 'missing',
      'Applied v2 and removed temporary variant code.'
    );
    expect(completed.status).toBe('awaiting_request');
    expect(completed.changeRequest).toBeUndefined();
    expect(completed.confirmedSelection).toBeUndefined();
    expect(completed.lastResult?.summary).toBe('Applied v2 and removed temporary variant code.');
    expect(restarts).toHaveLength(2);
    expect(changes.map(({ status }) => status)).toEqual([
      'selecting_simulator',
      'awaiting_request',
      'change_requested',
      'working',
      'variants_ready',
      'selection_confirmed',
      'awaiting_request'
    ]);
  });

  test('requires and persists framework adapters before opening the Simulator picker', async () => {
    const unconfigured = { ...project, targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example App' }] };
    let configured = false;
    const sessions = new AgentSessionStore({
      list: async () => [unconfigured],
      open: async () => unconfigured,
      configureLiveTargets: async (_id, targets) => {
        configured = true;
        const target = targets[0];
        if (!target) throw new Error('Missing adapter.');
        return {
          ...unconfigured,
          targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example App', live: target.live }]
        };
      }
    });

    const created = await sessions.create('/tmp/example');
    expect(created.status).toBe('configuring_project');
    const ready = await sessions.configureProject(created.id, [{ bundleIdentifier: 'com.example.app', live }]);
    expect(configured).toBe(true);
    expect(ready.status).toBe('selecting_simulator');
    expect(ready.project.targetApps[0]?.live?.framework).toBe('swiftui');
  });

  test('returns capture failures to the agent and allows the same request to be republished', async () => {
    const sessions = new AgentSessionStore(projectStore, { restartApp: async () => undefined });
    const created = await sessions.create('/tmp/example');
    sessions.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });
    const requested = await sessions.request(created.id, {
      request: 'Adjust the profile layout',
      variantCount: 2,
      context: { simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' } }
    });
    const requestId = requested.changeRequest?.id ?? 'missing';
    sessions.claim(created.id, requestId);
    const published = await sessions.publishVariants(created.id, requestId, 'Built the variants.');

    const waiting = sessions.wait(created.id, published.revision, 1_000);
    const failed = sessions.reportCaptureFailure(
      created.id,
      requestId,
      'original',
      'Original did not restore the selected page.'
    );

    expect(failed.status).toBe('working');
    expect(failed.captureFailure).toMatchObject({
      requestId,
      variant: 'original',
      message: 'Original did not restore the selected page.'
    });
    expect((await waiting).revision).toBe(failed.revision);

    const republished = await sessions.publishVariants(created.id, requestId, 'Fixed original and rebuilt.');
    expect(republished.status).toBe('variants_ready');
    expect(republished.captureFailure).toBeUndefined();
  });

  test('stores an annotated screenshot in the bound project temp directory and exposes its path to the agent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-annotation-request-'));
    try {
      const boundProject = { ...project, path: root, configPath: join(root, '.monaddesign', 'project.json') };
      const sessions = new AgentSessionStore({
        list: async () => [boundProject],
        open: async () => boundProject,
        configureLiveTargets: async () => boundProject
      });
      const created = await sessions.create(root);
      sessions.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
      const annotationDirectory = join(root, '.monaddesign', 'tmp', 'annotations');
      const orphanPath = join(annotationDirectory, '00000000-0000-4000-8000-000000000000.png');
      const orphanTemporaryPath = join(
        annotationDirectory,
        '00000000-0000-4000-8000-000000000000.png.123.00000000-0000-4000-8000-000000000001.tmp'
      );
      await mkdir(annotationDirectory, { recursive: true });
      await writeFile(orphanPath, png);
      await writeFile(orphanTemporaryPath, png);
      const requested = await sessions.request(created.id, {
        request: 'Implement the annotated changes',
        variantCount: 1,
        context: { simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' } },
        annotationScreenshot: `data:image/png;base64,${png.toString('base64')}`
      });

      const screenshotPath = requested.changeRequest?.context.annotation?.screenshotPath;
      expect(screenshotPath).toStartWith(join(root, '.monaddesign', 'tmp', 'annotations'));
      expect(await readFile(screenshotPath ?? '')).toEqual(png);
      await expect(readFile(orphanPath)).rejects.toThrow();
      await expect(readFile(orphanTemporaryPath)).rejects.toThrow();
      expect(requested.changeRequest?.context.annotation?.mimeType).toBe('image/png');
      await sessions.close(created.id);
      await expect(readFile(screenshotPath ?? '')).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('long-polls until the session revision changes', async () => {
    const sessions = new AgentSessionStore(projectStore);
    const created = await sessions.create('/tmp/example');
    const waiting = sessions.wait(created.id, created.revision, 1_000);
    sessions.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });

    expect((await waiting).status).toBe('awaiting_request');
  });

  test('returns the current session after a long-poll timeout', async () => {
    const sessions = new AgentSessionStore(projectStore);
    const created = await sessions.create('/tmp/example');

    expect(await sessions.wait(created.id, created.revision, 1)).toEqual(created);
  });

  test('rejects turn context for a different Simulator target', async () => {
    const sessions = new AgentSessionStore(projectStore);
    const created = await sessions.create('/tmp/example');
    sessions.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });

    await expect(
      sessions.request(created.id, {
        request: 'Adjust the title',
        variantCount: 1,
        context: { simulator: { udid: 'simulator-2', bundleIdentifier: 'com.example.app' } }
      })
    ).rejects.toThrow('does not match');
  });

  test('enforces the 1 to 5 variant request boundary and published selection set', async () => {
    const sessions = new AgentSessionStore(projectStore, { restartApp: async () => undefined });
    const created = await sessions.create('/tmp/example');
    sessions.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });
    const context = { simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' } };

    await expect(sessions.request(created.id, { request: 'Adjust title', variantCount: 0, context })).rejects.toThrow(
      'between 1 and 5'
    );
    const requested = await sessions.request(created.id, { request: 'Adjust title', variantCount: 1, context });
    sessions.claim(created.id, requested.changeRequest?.id ?? 'missing');
    await sessions.publishVariants(created.id, requested.changeRequest?.id ?? 'missing', 'Built one variant.');
    expect(() => sessions.confirmSelection(created.id, requested.changeRequest?.id ?? 'missing', 'v2')).toThrow(
      'not published'
    );
  });

  test('closes the previous active session when a new loop starts', async () => {
    const sessions = new AgentSessionStore(projectStore);
    const first = await sessions.create('/tmp/example');
    const second = await sessions.create('/tmp/example');

    expect(sessions.get(first.id).status).toBe('closed');
    expect(sessions.active()?.id).toBe(second.id);
  });

  test('retains only the most recent closed sessions', async () => {
    const sessions = new AgentSessionStore(projectStore);
    const created = [];
    for (let index = 0; index < 22; index += 1) {
      created.push(await sessions.create('/tmp/example', `Session ${index}`));
    }

    expect(() => sessions.get(created[0]?.id ?? 'missing')).toThrow('not found');
    expect(sessions.get(created[1]?.id ?? 'missing').status).toBe('closed');
    expect(sessions.active()?.id).toBe(created.at(-1)?.id);
  });

  test('restores the active session from the machine Core state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'monad-design-agent-sessions-'));
    const persistencePath = join(directory, 'agent-sessions.json');
    try {
      const firstStore = new AgentSessionStore(projectStore, { persistencePath });
      const created = await firstStore.create('/tmp/example', 'Keep this generation alive');
      firstStore.connected(created.id, { udid: 'simulator-1', bundleIdentifier: 'com.example.app' });
      const requested = await firstStore.request(created.id, {
        request: 'Adjust the title',
        variantCount: 1,
        context: { simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' } }
      });
      firstStore.claim(created.id, requested.changeRequest?.id ?? 'missing');

      const restoredStore = new AgentSessionStore(projectStore, { persistencePath });
      expect(restoredStore.active()?.id).toBe(created.id);
      expect(restoredStore.active()?.status).toBe('working');
      expect(restoredStore.active()?.changeRequest?.request).toBe('Adjust the title');
      expect(JSON.parse(await readFile(persistencePath, 'utf8')).schemaVersion).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
