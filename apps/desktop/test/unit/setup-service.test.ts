import type { CoreProcess } from '../../electron/core-process';

import { afterEach, expect, mock, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>();
let selectedDirectory: string | undefined;
mock.module('electron', () => ({
  app: { isPackaged: false, getAppPath: () => resolve(import.meta.dir, '../..') },
  dialog: { showOpenDialog: async () => ({ canceled: !selectedDirectory, filePaths: [selectedDirectory] }) },
  ipcMain: {
    handle: (name: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) =>
      handlers.set(name, handler)
  },
  shell: { openPath: async () => '' }
}));
const { registerSetup } = await import('../../electron/setup-service');
const roots: string[] = [];
const previousDirectory = process.env.MONAD_DESIGN_CORE_STATE_DIR;
afterEach(async () => {
  if (previousDirectory === undefined) delete process.env.MONAD_DESIGN_CORE_STATE_DIR;
  else process.env.MONAD_DESIGN_CORE_STATE_DIR = previousDirectory;
  selectedDirectory = undefined;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const invoke = async (name: string, ...args: unknown[]) => handlers.get(name)?.({ trusted: true }, ...args);

test('setup exposes recoverable startup and validates IPC before any configuration writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'monad-setup-'));
  roots.push(root);
  process.env.MONAD_DESIGN_CORE_STATE_DIR = root;
  let failing = true;
  const core = {
    start: async () => {
      if (failing) throw new Error('Runtime failed');
    },
    installationNotice: 'Auto-start enabled',
    localClient: { origin: 'http://127.0.0.1:41765' }
  } as unknown as CoreProcess;
  const setup = registerSetup(core, (event) => (event as unknown as { trusted: boolean }).trusted === true);
  await setup.start();
  expect(await invoke('setup:status')).toMatchObject({ phase: 'error', error: 'Runtime failed' });
  failing = false;
  expect(await invoke('setup:retry')).toMatchObject({ phase: 'ready', completed: false });
  await expect(Promise.resolve().then(() => handlers.get('setup:scan')?.({}, 'global'))).rejects.toThrow('Untrusted');
  await expect(invoke('setup:install', { agents: ['arbitrary-agent'], scope: 'global' })).rejects.toThrow(
    'Invalid agent'
  );
  await expect(invoke('setup:scan', 'project')).rejects.toThrow('Choose a Git project');
  selectedDirectory = root;
  await expect(invoke('setup:project')).rejects.toThrow('Git repository root');
  await mkdir(join(root, '.git'));
  await invoke('setup:project');
  const results = await invoke('setup:install', { agents: ['trae'], scope: 'project' });
  expect(results).toMatchObject([
    {
      agent: 'trae',
      success: true,
      skillPath: join(await realpath(root), '.trae/skills/monad-design'),
      mcpPath: join(await realpath(root), '.trae/mcp.json')
    }
  ]);
  expect(await readFile(join(root, '.trae/mcp.json'), 'utf8')).toContain('http://127.0.0.1:41765/mcp');
  await invoke('setup:complete');
  expect(JSON.parse(await readFile(join(root, 'desktop-setup.json'), 'utf8')).completed).toBe(true);
});
