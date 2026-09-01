import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { resolveCorePaths } from '@monaddesign/core-installation';

import { createCoreRuntime } from './core-runtime';
import { acquireCoreInstance } from './single-instance';
import { embeddedUiPath, requestedUiPath } from './ui-assets';
import { launchPreferredUi } from './ui-launcher';

const { stateDirectory, bootstrapPath, lockPath } = resolveCorePaths();
const configuredPort = Number(process.env.MONAD_DESIGN_CORE_PORT ?? 41_765);
let uiOrigin: string | null = null;
const openedSessions = new Set<string>();

const contentType = (path: string) => {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
};

const uiFiles = new Map<string, Blob>();
for (const file of Bun.embeddedFiles) {
  const path = embeddedUiPath((file as File).name);
  if (path) uiFiles.set(path, file);
}

const ui = async (pathname: string) => {
  const relativePath = requestedUiPath(pathname);
  const embedded = uiFiles.get(relativePath);
  if (embedded) {
    return new Response(embedded, {
      headers: { 'content-type': contentType(relativePath) }
    });
  }
  const developmentFile = Bun.file(join(import.meta.dir, '..', 'ui', 'dist', relativePath));
  if (await developmentFile.exists()) {
    return new Response(developmentFile, {
      headers: { 'content-type': contentType(relativePath) }
    });
  }
  return new Response('not found', { status: 404 });
};

const writeBootstrap = async (value: unknown) => {
  await mkdir(dirname(bootstrapPath), { recursive: true });
  const temporaryPath = `${bootstrapPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, bootstrapPath);
};

const instance = await acquireCoreInstance(lockPath);
if (!instance.acquired) {
  // biome-ignore lint/suspicious/noConsole: A second launch is a successful discovery of the machine Core.
  console.log(`Monad Design Core is already running as pid ${instance.owner}.`);
  process.exit(0);
}

let runtime: Awaited<ReturnType<typeof createCoreRuntime>>;
try {
  runtime = await createCoreRuntime({
    stateDirectory,
    host: process.env.MONAD_DESIGN_CORE_HOST ?? '0.0.0.0',
    port: Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 41_765,
    onSessionChanged: (session) => {
      if (session.status !== 'selecting_simulator' || openedSessions.has(session.id) || !uiOrigin) return;
      openedSessions.add(session.id);
      const url = `${uiOrigin}/`;
      void launchPreferredUi(url, {
        reportError: (message, error) => {
          openedSessions.delete(session.id);
          // biome-ignore lint/suspicious/noConsole: UI launch failures need operator-visible evidence.
          console.error(message, error);
        }
      });
    },
    ui
  });
  const bootstrap = await runtime.start();
  uiOrigin = bootstrap.localClient.origin;
  await writeBootstrap({
    schemaVersion: 1,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    ...bootstrap
  });

  // biome-ignore lint/suspicious/noConsole: The executable's stdout is its operator-facing lifecycle log.
  console.log(`Monad Design Core listening on ${bootstrap.localClient.origin}`);
} catch (error) {
  await instance.release();
  throw error;
}

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await runtime.stop();
  await instance.release();
  process.exit(0);
};
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
