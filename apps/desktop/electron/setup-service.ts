import type { SetupState } from '../src/setup-contract';
import type { CoreProcess } from './core-process';

import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  detectAgents,
  exportKimiWorkPlugin,
  type InstallScope,
  inspectAgentIntegration,
  installAgent,
  isSupportedAgent,
  supportedAgents
} from '@monaddesign/agent-integration';
import { resolveCorePaths } from '@monaddesign/core-installation';
import { app, dialog, ipcMain, shell } from 'electron';

import { readInstallerAssets } from './installer-assets';

export const registerSetup = (core: CoreProcess, trustedSender: (event: Electron.IpcMainInvokeEvent) => boolean) => {
  const handle = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown) =>
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!trustedSender(event)) throw new Error('Untrusted setup request.');
      return listener(event, ...args);
    });
  const root = resolveCorePaths().stateDirectory;
  const preferences = join(root, 'desktop-setup.json');
  let state: SetupState = { phase: 'preparing', completed: false };
  let starting: Promise<void> | null = null;
  let installing = false;
  let project: string | null = null;
  const assets = async () => {
    if (app.isPackaged) return readInstallerAssets(join(process.resourcesPath, 'installer'));
    return {
      skillPath: join(app.getAppPath(), '../../.agents/skills/monad-design'),
      manifest: { skillVersion: 'development' }
    };
  };
  const start = async () => {
    if (starting) return starting;
    starting = (async () => {
      state = { ...state, phase: 'preparing', error: undefined };
      try {
        state.completed = JSON.parse(await readFile(preferences, 'utf8')).completed === true;
      } catch {}
      try {
        await core.start();
        state = { ...state, phase: 'ready', notice: core.installationNotice };
      } catch (error) {
        state = { ...state, phase: 'error', error: error instanceof Error ? error.message : String(error) };
      }
    })().finally(() => {
      starting = null;
    });
    return starting;
  };
  const scopeFor = (scope: unknown): InstallScope => {
    if (scope !== 'global' && scope !== 'project') throw new Error('Invalid installation scope.');
    if (scope === 'project' && !project) throw new Error('Choose a Git project first.');
    return scope;
  };
  const scan = async (scopeInput: unknown) => {
    const scope = scopeFor(scopeInput);
    const bundle = await assets();
    const detection = await detectAgents(project);
    const url = `${core.localClient.origin}/mcp`;
    return Promise.all(
      supportedAgents.map(async (agent) => ({
        ...(await inspectAgentIntegration(agent, scope, project, bundle.skillPath, url)),
        detected: detection[scope].includes(agent)
      }))
    );
  };
  handle('setup:status', () => state);
  handle('setup:retry', async () => {
    await start();
    return state;
  });
  handle('setup:scan', (_event, scope: unknown) => scan(scope));
  handle('setup:project', async () => {
    if (installing) throw new Error('Wait for installation to finish.');
    const result = await dialog.showOpenDialog({
      title: 'Choose a Git project for agent integration',
      properties: ['openDirectory']
    });
    const selected = result.filePaths[0];
    if (result.canceled || !selected) return project;
    const resolved = await realpath(selected);
    await access(join(resolved, '.git')).catch(() => {
      throw new Error('Select the Git repository root.');
    });
    project = resolved;
    return project;
  });
  handle('setup:install', async (_event, input: unknown) => {
    if (installing) throw new Error('Installation is already running.');
    const request = input as { agents?: unknown; scope?: unknown; replaceModified?: unknown };
    if (
      !Array.isArray(request?.agents) ||
      request.agents.length > supportedAgents.length ||
      !request.agents.every((agent) => typeof agent === 'string' && isSupportedAgent(agent))
    )
      throw new Error('Invalid agent selection.');
    const scope = scopeFor(request.scope);
    const selected = [...new Set(request.agents as (typeof supportedAgents)[number][])];
    installing = true;
    try {
      const bundle = await assets();
      const url = `${core.localClient.origin}/mcp`;
      const results = [];
      for (const agent of selected) {
        try {
          const status = await inspectAgentIntegration(agent, scope, project, bundle.skillPath, url);
          if (status.error) throw new Error(status.error);
          if (status.skill === 'modified' && request.replaceModified !== true)
            throw new Error(
              'Skill has local changes or was installed elsewhere. Select Replace existing skills to replace it.'
            );
          await installAgent(agent, scope, project, bundle.skillPath, url);
          const verified = await inspectAgentIntegration(agent, scope, project, bundle.skillPath, url);
          if (verified.skill !== 'current' || verified.mcp !== 'configured')
            throw new Error('Written configuration did not pass verification. Refresh status and retry.');
          results.push({
            agent,
            success: true,
            skillPath: verified.skillPath,
            mcpPath: verified.mcpPath,
            instructions: verified.instructions
          });
        } catch (error) {
          results.push({ agent, success: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return results;
    } finally {
      installing = false;
    }
  });
  handle('setup:complete', async () => {
    if (state.phase !== 'ready') throw new Error('Core is not ready.');
    await mkdir(root, { recursive: true });
    await writeFile(preferences, JSON.stringify({ completed: true }), { mode: 0o600 });
    state.completed = true;
  });
  handle('setup:kimi-work', async () => {
    if (process.arch !== 'arm64') throw new Error('Kimi Work integration requires Apple silicon.');
    const bundle = await assets();
    const directory = await exportKimiWorkPlugin({
      outputDirectory: join(root, 'plugins/kimi-work'),
      skillSourcePath: bundle.skillPath,
      version: bundle.manifest.skillVersion,
      mcpUrl: `${core.localClient.origin}/mcp`
    });
    await shell.openPath(directory);
    return directory;
  });
  return { start };
};
