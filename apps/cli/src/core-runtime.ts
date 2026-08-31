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
    const response = await fetch(`${bootstrap.localClient.origin}/v1/health`, {
      signal: AbortSignal.timeout(1_000)
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const ensureCoreRunning = async (executablePath: string) => {
  const existing = await readBootstrap();
  if (existing && (await isHealthy(existing))) return { bootstrap: existing, started: false };

  const child = spawn(executablePath, [], { detached: true, stdio: 'ignore' });
  const launch: { error: Error | null; exitCode: number | null } = { error: null, exitCode: null };
  child.once('error', (error) => {
    launch.error = error;
  });
  child.once('exit', (code) => {
    launch.exitCode = code;
  });
  child.unref();

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (launch.error) throw new Error(`Could not start Monad Design Core: ${launch.error.message}`);
    if (launch.exitCode !== null) {
      throw new Error(`Monad Design Core exited before becoming healthy (${launch.exitCode}).`);
    }
    const bootstrap = await readBootstrap();
    if (bootstrap && (await isHealthy(bootstrap))) return { bootstrap, started: true };
    await delay(100);
  }
  throw new Error('Monad Design Core did not become healthy within 10 seconds.');
};
