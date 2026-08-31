import type { AgentSessionSnapshot } from '@monaddesign/client-contract';

import { type ChildProcess, spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveCorePaths } from '@monaddesign/core/paths';
import { installCoreExecutable, stopLegacyCore } from '@monaddesign/core-installation';
import { app, shell } from 'electron';

interface CoreBootstrap {
  schemaVersion: 1;
  pid: number;
  startedAt: string;
  localClient: { origin: string; accessToken: string };
  status: { port: number; pairingCode: string; addresses: string[] };
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const isBootstrap = (value: unknown): value is CoreBootstrap => {
  const bootstrap = value as Partial<CoreBootstrap>;
  return (
    bootstrap?.schemaVersion === 1 &&
    typeof bootstrap.pid === 'number' &&
    typeof bootstrap.localClient?.origin === 'string' &&
    typeof bootstrap.localClient.accessToken === 'string' &&
    typeof bootstrap.status?.port === 'number' &&
    typeof bootstrap.status.pairingCode === 'string' &&
    Array.isArray(bootstrap.status.addresses)
  );
};

export class CoreProcess {
  readonly #stateDirectory: string;
  readonly #bootstrapPath: string;
  readonly #executablePath: string;
  readonly #legacyStateDirectory: string;
  #bootstrap: CoreBootstrap | null = null;
  #child: ChildProcess | null = null;
  #spawnError: Error | null = null;
  #lastExitCode: number | null = null;
  #sessionTimer: ReturnType<typeof setInterval> | null = null;
  #lastSessionRevision = 0;
  #activeSession: AgentSessionSnapshot | null = null;

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
    try {
      const response = await fetch(`${bootstrap.localClient.origin}/v1/admin/projects/`, {
        headers: {
          authorization: `Bearer ${bootstrap.localClient.accessToken}`,
          'x-monad-design-client-kind': 'desktop'
        },
        signal: AbortSignal.timeout(1_000)
      });
      return response.ok;
    } catch {
      return false;
    }
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
    if (!app.isPackaged) return;
    const bundledPath = join(process.resourcesPath, 'core', 'monad-design');
    const bundledNativeAddonPath = join(process.resourcesPath, 'core', 'native', 'serve-sim-native.node');
    const result = await installCoreExecutable({
      sourcePath: bundledPath,
      nativeAddonPath: bundledNativeAddonPath,
      version: app.getVersion(),
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
    if (app.isPackaged) {
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
    await this.#prepareMachineCore();
    const existing = await this.#readBootstrap();
    if (existing && (await this.#isHealthy(existing))) {
      this.#bootstrap = existing;
      return existing;
    }

    this.#spawn();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (this.#spawnError) throw this.#spawnError;
      const bootstrap = await this.#readBootstrap();
      if (bootstrap && (await this.#isHealthy(bootstrap))) {
        this.#bootstrap = bootstrap;
        return bootstrap;
      }
      await delay(100);
    }
    if (this.#lastExitCode !== null) {
      throw new Error(`Monad Design Core exited before becoming ready (${this.#lastExitCode}).`);
    }
    throw new Error('Monad Design Core did not become ready within 10 seconds.');
  }

  subscribeToAgentSession(listener: (session: AgentSessionSnapshot) => void) {
    if (this.#sessionTimer) clearInterval(this.#sessionTimer);
    const poll = async () => {
      if (!this.#bootstrap) return;
      try {
        const response = await fetch(`${this.#bootstrap.localClient.origin}/v1/agent-session/active`, {
          headers: { authorization: `Bearer ${this.#bootstrap.localClient.accessToken}` }
        });
        if (!response.ok) return;
        const { session } = (await response.json()) as { session: AgentSessionSnapshot | null };
        this.#activeSession = session;
        if (!session || session.revision === this.#lastSessionRevision) return;
        this.#lastSessionRevision = session.revision;
        listener(session);
      } catch {
        // A transient Core restart is retried by the next polling interval.
      }
    };
    void poll();
    this.#sessionTimer = setInterval(() => void poll(), 400);
  }

  stopPolling() {
    if (this.#sessionTimer) clearInterval(this.#sessionTimer);
    this.#sessionTimer = null;
  }

  openFallbackUi() {
    if (!app.isPackaged || !this.#bootstrap || !this.#activeSession || this.#activeSession.status === 'closed') return;
    const url = `${this.#bootstrap.localClient.origin}/?accessToken=${encodeURIComponent(
      this.#bootstrap.localClient.accessToken
    )}`;
    void shell.openExternal(url);
  }
}
