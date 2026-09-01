import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  coreLaunchAgentLabel,
  coreLaunchAgentPlist,
  installCoreLaunchAgent,
  resolveCoreLaunchAgent,
  unloadCoreLaunchAgent
} from '../../src/launch-agent';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('Core launch agent', () => {
  test('writes and bootstraps a user launch agent for the stable Core executable', async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), 'monad-design-launch-agent-'));
    temporaryDirectories.push(homeDirectory);
    const calls: Array<[string, string[]]> = [];
    const executablePath = '/Users/Test User/Library/Application Support/Monad Design/bin/monad-design';
    const stateDirectory = '/Users/Test User/Library/Application Support/Monad Design';

    const result = await installCoreLaunchAgent(executablePath, stateDirectory, {
      homeDirectory,
      uid: 501,
      exec: async (path, arguments_) => {
        calls.push([path, arguments_]);
      }
    });

    expect(result).toEqual(resolveCoreLaunchAgent(homeDirectory, 501));
    expect(calls).toEqual([['/bin/launchctl', ['bootstrap', 'gui/501', result.path]]]);
    expect((await stat(result.path)).mode & 0o777).toBe(0o644);
    const plist = await readFile(result.path, 'utf8');
    expect(plist).toContain(`<string>${coreLaunchAgentLabel}</string>`);
    expect(plist).toContain('<key>RunAtLoad</key>');
    expect(plist).toContain('<key>KeepAlive</key>');
    expect(plist).toContain(
      '<string>/Users/Test User/Library/Application Support/Monad Design/bin/monad-design</string>'
    );
    expect(plist).toContain(
      '<string>/Users/Test User/Library/Application Support/Monad Design/core.stderr.log</string>'
    );
    expect(plist).toEndWith('</plist>\n');
  });

  test('escapes XML-sensitive paths in the launch agent property list', () => {
    const plist = coreLaunchAgentPlist('/Users/A&B/<Core>', '/Users/A&B/State');

    expect(plist).toContain('/Users/A&amp;B/&lt;Core&gt;');
    expect(plist).toContain('/Users/A&amp;B/State/core.stdout.log');
  });

  test('treats an absent launch agent as already unloaded', async () => {
    const missing = Object.assign(new Error('Boot-out failed'), { code: 3 });
    const unloaded = await unloadCoreLaunchAgent({
      homeDirectory: '/Users/example',
      uid: 502,
      exec: async () => {
        throw missing;
      }
    });

    expect(unloaded).toBe(false);
  });

  test('retries a transient launchd bootstrap race', async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), 'monad-design-launch-agent-'));
    temporaryDirectories.push(homeDirectory);
    let attempts = 0;

    await installCoreLaunchAgent('/tmp/monad-design', '/tmp/monad-design-state', {
      homeDirectory,
      uid: 501,
      exec: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error('Bootstrap failed'), {
            code: 5,
            stderr: 'Bootstrap failed: 5: Input/output error'
          });
        }
      }
    });

    expect(attempts).toBe(3);
  });
});
