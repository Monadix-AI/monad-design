import { describe, expect, test } from 'bun:test';

import { restartCore, waitForCoreRunning } from '../../src/core-runtime';

const bootstrap = (pid: number) => ({
  schemaVersion: 1 as const,
  pid,
  localClient: { origin: 'http://127.0.0.1:41765', accessToken: 'local-token' }
});

describe('Core restart', () => {
  test('stops a healthy Core and starts the installed executable', async () => {
    const previous = bootstrap(101);
    const replacement = bootstrap(202);
    let previousRunning = true;
    let spawned = false;
    const signals: Array<[number, NodeJS.Signals]> = [];
    const result = await restartCore('/machine/bin/monad-design', {
      delay: async () => undefined,
      isHealthy: async (value) => (value.pid === previous.pid ? previousRunning : spawned),
      processIsRunning: () => {
        previousRunning = false;
        return false;
      },
      readBootstrap: async () => (spawned ? replacement : previous),
      signal: (pid, signal) => signals.push([pid, signal]),
      spawnCore: (path) => {
        expect(path).toBe('/machine/bin/monad-design');
        spawned = true;
        return { error: null, exitCode: null };
      }
    });

    expect(signals).toEqual([[previous.pid, 'SIGTERM']]);
    expect(result).toEqual({ bootstrap: replacement, restarted: true, started: true });
  });

  test('starts Core when no previous runtime is active', async () => {
    const replacement = bootstrap(303);
    let spawned = false;
    const result = await restartCore('/machine/bin/monad-design', {
      delay: async () => undefined,
      isHealthy: async () => spawned,
      processIsRunning: () => false,
      readBootstrap: async () => (spawned ? replacement : null),
      signal: () => {
        throw new Error('No process should be signalled.');
      },
      spawnCore: () => {
        spawned = true;
        return { error: null, exitCode: null };
      }
    });

    expect(result).toEqual({ bootstrap: replacement, restarted: false, started: true });
  });

  test('does not launch a replacement before the old Core stops', async () => {
    const previous = bootstrap(404);
    await expect(
      restartCore('/machine/bin/monad-design', {
        delay: async () => undefined,
        isHealthy: async () => true,
        processIsRunning: () => true,
        readBootstrap: async () => previous,
        signal: () => undefined,
        spawnCore: () => {
          throw new Error('Replacement must not start while the old Core is running.');
        }
      })
    ).rejects.toThrow('Monad Design Core did not stop within 5 seconds.');
  });

  test('waits for a launch-agent-managed Core without spawning another process', async () => {
    const replacement = bootstrap(505);
    let reads = 0;
    const result = await waitForCoreRunning({
      delay: async () => undefined,
      isHealthy: async () => true,
      processIsRunning: () => false,
      readBootstrap: async () => (++reads < 3 ? null : replacement),
      signal: () => undefined,
      spawnCore: () => {
        throw new Error('The installer must not race launchd.');
      }
    });

    expect(result).toEqual(replacement);
    expect(reads).toBe(3);
  });
});
