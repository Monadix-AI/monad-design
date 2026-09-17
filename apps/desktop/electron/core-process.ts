import type { AgentSessionSnapshot } from '@monaddesign/client-contract';

import { type ChildProcess, spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agentSessionVersion } from '@monaddesign/client-contract/agent-session-version';
import { ClientApi } from '@monaddesign/client-rtk/client-api';
import {
  compareCoreVersions,
  installCoreExecutable,
  resolveCorePaths,
  stopLegacyCore
} from '@monaddesign/core-installation';
import { stopCore, waitForCoreRunning } from '@monaddesign/core-installation/core-runtime';
import {
  installCoreLaunchAgent,
  isCoreLaunchAgentLoaded,
  unloadCoreLaunchAgent
} from '@monaddesign/core-installation/launch-agent';
import { app, shell } from 'electron';

import { readInstallerAssets } from './installer-assets';

interface CoreBootstrap {
  schemaVersion: 1;
  pid: number;
  startedAt: string;
  localClient: { origin: string; accessToken?: string };
  status: { port: number; pairingCode: string; addresses: string[] };
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

const isBootstrap = (value: unknown): value is CoreBootstrap => {
  const bootstrap = value as Partial<CoreBootstrap>;
  return (
    bootstrap?.schemaVersion === 1 &&
    typeof bootstrap.pid === 'number' &&
    typeof bootstrap.localClient?.origin === 'string' &&
    typeof bootstrap.status?.port === 'number' &&
    typeof bootstrap.status.pairingCode === 'string' &&
    Array.isArray(bootstrap.status.addresses)
  );
};

export class CoreProcess {
  installationNotice: string | null = null;
  readonly #stateDirectory: string;
  readonly #bootstrapPath: string;
  readonly #executablePath: string;
  readonly #legacyStateDirectory: string;
  #bootstrap: CoreBootstrap | null = null;
  #child: ChildProcess | null = null;
  #spawnError: Error | null = null;
  #lastExitCode: number | null = null;
  #sessionTimer: ReturnType<typeof setTimeout> | null = null;
  #sessionPollGeneration = 0;
  #lastSessionVersion: string | null | undefined;
  #activeSession: AgentSessionSnapshot | null = null;
  #client: ClientApi | null = null;

  constructor() {
    const paths = resolveCorePaths();
    this.#stateDirectory = paths.stateDirectory;
    this.#bootstrapPath = paths.bootstrapPath;
    this.#executablePath = paths.executablePath;
    this.#legacyStateDirectory = app.getPath('userData');
  }

  get localClient() {
    if (!this.#bootstrap) throw new Error('Monad Design Core is not ready.');
    return this.#bootstrap.localClient;
  }

  get status() {
    if (!this.#bootstrap) throw new Error('Monad Design Core is not ready.');
    return this.#bootstrap.status;
  }

  async #readBootstrap() {
    try {
      const value = JSON.parse(await readFile(this.#bootstrapPath, 'utf8')) as unknown;
      return isBootstrap(value) ? value : null;
    } catch {
      return null;
    }
  }

  async #isHealthy(bootstrap: CoreBootstrap) {
    const client = new ClientApi(bootstrap.localClient, { requestTimeoutMilliseconds: 1_000 });
    try {
      await client.adminProjects();
      return true;
    } catch {
      return false;
    } finally {
      client.dispose();
    }
  }

  async #stopDevelopmentCore(bootstrap: CoreBootstrap) {
    try {
      process.kill(bootstrap.pid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (!(await this.#isHealthy(bootstrap))) return;
      await delay(100);
    }
    throw new Error('The previous Monad Design Core did not stop within 5 seconds.');
  }

  async #copyLegacyState() {
    await mkdir(this.#stateDirectory, { recursive: true });
    if (this.#legacyStateDirectory === this.#stateDirectory) return;
    for (const name of ['projects.json', 'pairing.json']) {
      await copyFile(
        join(this.#legacyStateDirectory, name),
        join(this.#stateDirectory, name),
        constants.COPYFILE_EXCL
      ).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT' && error.code !== 'EEXIST') throw error;
      });
    }
  }

  async #installBundledCore() {
    if (isDevelopment) return;
    const assets = await readInstallerAssets(join(process.resourcesPath, 'installer'));
    const result = await installCoreExecutable({
      sourcePath: assets.corePath,
      nativeAddonPath: assets.nativeAddonPath,
      version: assets.manifest.coreVersion,
      source: 'desktop'
    });
    if (result.status === 'newer-preserved') {
      // biome-ignore lint/suspicious/noConsole: A protected machine-runtime upgrade must be visible in app logs.
      console.log(`Keeping newer Monad Design Core v${result.manifest.version}.`);
    }
  }

  async #prepareMachineCore() {
    await this.#copyLegacyState();
    await this.#installBundledCore();
    await stopLegacyCore();
  }

  #spawn() {
    this.#spawnError = null;
    this.#lastExitCode = null;
    const environment = {
      ...process.env,
      MONAD_DESIGN_CORE_BOOTSTRAP_PATH: this.#bootstrapPath,
      MONAD_DESIGN_CORE_STATE_DIR: this.#stateDirectory
    };
    if (!isDevelopment) {
      this.#child = spawn(this.#executablePath, [], {
        detached: true,
        env: environment,
        stdio: 'ignore'
      });
      this.#child.unref();
    } else {
      const source = join(app.getAppPath(), '..', 'core', 'src', 'main.ts');
      this.#child = spawn(process.env.MONAD_DESIGN_BUN_PATH ?? 'bun', ['run', source], {
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      this.#child.stdout?.on('data', (chunk) => process.stdout.write(`[core] ${String(chunk)}`));
      this.#child.stderr?.on('data', (chunk) => process.stderr.write(`[core] ${String(chunk)}`));
    }
    this.#child.once('error', (error) => {
      this.#spawnError = error;
    });
    this.#child.once('exit', (code) => {
      this.#lastExitCode = code;
      this.#child = null;
    });
  }

  async start() {
    this.#spawnError = null;
    this.#lastExitCode = null;
    const existing = await this.#readBootstrap();
    if (existing && (await this.#isHealthy(existing))) {
      if (!isDevelopment) {
        const assets = await readInstallerAssets(join(process.resourcesPath, 'installer'));
        const client = new ClientApi(existing.localClient, { requestTimeoutMilliseconds: 2_000 });
        try {
          const { session } = await client.activeAgentSession();
          if (session && session.status !== 'closed') {
            this.installationNotice =
              'Using the running Core. Close the Live session before repairing or updating the runtime.';
            this.#bootstrap = existing;
            this.#client = client;
            return existing;
          }
          const installed = await readFile(resolveCorePaths().installManifestPath, 'utf8')
            .then((value) => JSON.parse(value) as { version: string; sha256: string; nativeAddonSha256?: string })
            .catch(() => null);
          if (
            installed &&
            (await isCoreLaunchAgentLoaded()) &&
            (compareCoreVersions(installed.version, assets.manifest.coreVersion) === 1 ||
              (installed.sha256 === assets.manifest.hashes['core/monad-design'] &&
                installed.nativeAddonSha256 === assets.manifest.hashes['core/native/serve-sim-native.node']))
          ) {
            try {
              await installCoreLaunchAgent(this.#executablePath, this.#stateDirectory);
              await waitForCoreRunning();
              this.installationNotice = 'Core starts automatically when you sign in.';
            } catch (error) {
              this.installationNotice = `Auto-start needs repair: ${error instanceof Error ? error.message : String(error)}`;
            }
            this.#bootstrap = existing;
            this.#client = client;
            return existing;
          }
        } catch (error) {
          client.dispose();
          throw error;
        }
        client.dispose();
        await unloadCoreLaunchAgent();
        await stopCore();
      } else {
        await this.#stopDevelopmentCore(existing);
      }
    }

    await this.#prepareMachineCore();
    if (!isDevelopment) {
      try {
        await installCoreLaunchAgent(this.#executablePath, this.#stateDirectory);
        this.installationNotice = 'Core starts automatically when you sign in.';
      } catch (error) {
        this.installationNotice = `Auto-start needs repair: ${error instanceof Error ? error.message : String(error)}`;
        this.#spawn();
      }
    } else this.#spawn();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (this.#spawnError) throw this.#spawnError;
      const bootstrap = await this.#readBootstrap();
      if (bootstrap && (await this.#isHealthy(bootstrap))) {
        this.#bootstrap = bootstrap;
        this.#client = new ClientApi(bootstrap.localClient, { requestTimeoutMilliseconds: 2_000 });
        return bootstrap;
      }
      await delay(100);
    }
    if (this.#lastExitCode !== null) {
      throw new Error(`Monad Design Core exited before becoming ready (${this.#lastExitCode}).`);
    }
    throw new Error('Monad Design Core did not become ready within 10 seconds.');
  }

  subscribeToAgentSession(listener: (session: AgentSessionSnapshot | null) => void) {
    this.stopPolling();
    const generation = this.#sessionPollGeneration;
    const poll = async () => {
      if (!this.#client || generation !== this.#sessionPollGeneration) return;
      try {
        const { session } = await this.#client.activeAgentSession();
        if (generation !== this.#sessionPollGeneration) return;
        this.#activeSession = session;
        const version = agentSessionVersion(session);
        if (version === this.#lastSessionVersion) return;
        this.#lastSessionVersion = version;
        listener(session);
      } catch {
        // A transient Core restart is retried by the next polling interval.
      } finally {
        if (generation === this.#sessionPollGeneration) {
          this.#sessionTimer = setTimeout(() => void poll(), 400);
        }
      }
    };
    void poll();
  }

  stopPolling() {
    this.#sessionPollGeneration += 1;
    if (this.#sessionTimer) clearTimeout(this.#sessionTimer);
    this.#sessionTimer = null;
  }

  openFallbackUi() {
    if (!app.isPackaged || !this.#bootstrap || !this.#activeSession || this.#activeSession.status === 'closed') return;
    const url = `${this.#bootstrap.localClient.origin}/`;
    void shell.openExternal(url);
  }
}
