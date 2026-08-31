import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolveCorePaths } from '@monaddesign/core-installation';

interface CoreBootstrap {
  schemaVersion: 1;
  pid: number;
  localClient: { origin: string; accessToken: string };
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const readBootstrap = async (): Promise<CoreBootstrap | null> => {
  try {
    const value = JSON.parse(await readFile(resolveCorePaths().bootstrapPath, 'utf8')) as Partial<CoreBootstrap>;
    return value.schemaVersion === 1 &&
      typeof value.pid === 'number' &&
      typeof value.localClient?.origin === 'string' &&
      typeof value.localClient.accessToken === 'string'
      ? (value as CoreBootstrap)
      : null;
  } catch {
    return null;
  }
};

const isHealthy = async (bootstrap: CoreBootstrap) => {
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
};

interface CoreLaunchState {
  error: Error | null;
  exitCode: number | null;
}

interface CoreRuntimeDependencies {
  delay: (milliseconds: number) => Promise<unknown>;
  isHealthy: (bootstrap: CoreBootstrap) => Promise<boolean>;
  processIsRunning: (pid: number) => boolean;
  readBootstrap: () => Promise<CoreBootstrap | null>;
  signal: (pid: number, signal: NodeJS.Signals) => void;
  spawnCore: (executablePath: string) => CoreLaunchState;
}

const spawnCore = (executablePath: string): CoreLaunchState => {
  const launch: CoreLaunchState = { error: null, exitCode: null };
  const child = spawn(executablePath, [], { detached: true, stdio: 'ignore' });
  child.once('error', (error) => {
    launch.error = error;
  });
  child.once('exit', (code) => {
    launch.exitCode = code;
  });
  child.unref();
  return launch;
};

const processIsRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const defaultDependencies: CoreRuntimeDependencies = {
  delay,
  isHealthy,
  processIsRunning,
  readBootstrap,
  signal: (pid, signal) => process.kill(pid, signal),
  spawnCore
};

const startCore = async (executablePath: string, dependencies: CoreRuntimeDependencies) => {
  const launch = dependencies.spawnCore(executablePath);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (launch.error) throw new Error(`Could not start Monad Design Core: ${launch.error.message}`);
    if (launch.exitCode !== null) {
      throw new Error(`Monad Design Core exited before becoming healthy (${launch.exitCode}).`);
    }
    const bootstrap = await dependencies.readBootstrap();
    if (bootstrap && (await dependencies.isHealthy(bootstrap))) return { bootstrap, started: true as const };
    await dependencies.delay(100);
  }
  throw new Error('Monad Design Core did not become healthy within 10 seconds.');
};

export const ensureCoreRunning = async (
  executablePath: string,
  dependencies: CoreRuntimeDependencies = defaultDependencies
) => {
  const existing = await dependencies.readBootstrap();
  if (existing && (await dependencies.isHealthy(existing))) return { bootstrap: existing, started: false };
  return startCore(executablePath, dependencies);
};

export const restartCore = async (
  executablePath: string,
  dependencies: CoreRuntimeDependencies = defaultDependencies
) => {
  const existing = await dependencies.readBootstrap();
  let restarted = false;
  if (existing && (await dependencies.isHealthy(existing))) {
    try {
      dependencies.signal(existing.pid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
    restarted = true;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (!dependencies.processIsRunning(existing.pid) && !(await dependencies.isHealthy(existing))) break;
      if (attempt === 49) throw new Error('Monad Design Core did not stop within 5 seconds.');
      await dependencies.delay(100);
    }
  }
  return { ...(await startCore(executablePath, dependencies)), restarted };
};
