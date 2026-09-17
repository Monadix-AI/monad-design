import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { readInstallerAssets } from '../electron/installer-assets';

// Run against the final signed payload, not the pre-signing build directory.
// Everything is isolated: no LaunchAgent, agent configuration or user state.
const root = process.argv[2];
if (!root) throw new Error('Usage: bun scripts/verify-installer.ts <app>/Contents/Resources/installer');
await readInstallerAssets(resolve(root));
const temporary = await mkdtemp(join(tmpdir(), 'monad-installer-smoke-'));
const reservation = createServer();
await new Promise<void>((accept) => reservation.listen(0, '127.0.0.1', accept));
const address = reservation.address();
if (!address || typeof address === 'string') throw new Error('Could not reserve a test port.');
await new Promise<void>((accept, reject) => reservation.close((error) => (error ? reject(error) : accept())));

let child: ReturnType<typeof Bun.spawn> | undefined;
try {
  await cp(join(resolve(root), 'core'), join(temporary, 'bin'), { recursive: true });
  child = Bun.spawn([join(temporary, 'bin/monad-design')], {
    cwd: temporary,
    env: {
      // Deliberately exclude Node/npm/Bun from PATH.
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: temporary,
      TMPDIR: temporary,
      MONAD_DESIGN_CORE_STATE_DIR: join(temporary, 'state'),
      MONAD_DESIGN_CORE_BOOTSTRAP_PATH: join(temporary, 'state/bootstrap.json'),
      MONAD_DESIGN_CORE_HOST: '127.0.0.1',
      MONAD_DESIGN_CORE_PORT: String(address.port)
    },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const stderr = new Response(child.stderr).text();
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Core exited (${child.exitCode}): ${await stderr}`);
    const bootstrap = await readFile(join(temporary, 'state/bootstrap.json'), 'utf8')
      .then((value) => JSON.parse(value) as { pid: number })
      .catch(() => null);
    if (bootstrap?.pid === child.pid) {
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/health`, {
        signal: AbortSignal.timeout(1_000)
      });
      const health = (await response.json()) as { name?: string };
      if (!response.ok || health.name !== 'Monad Design Core') throw new Error('Core health response is invalid.');
      ready = true;
      break;
    }
    await Bun.sleep(100);
  }
  if (!ready) throw new Error('Packaged Core did not become ready within 10 seconds.');
  // biome-ignore lint/suspicious/noConsole: Release verification is operator-facing.
  console.log('PASS: final installer hashes and standalone Core startup /v1/health (isolated state, no Node/npm/Bun).');
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    const force = setTimeout(() => child?.kill('SIGKILL'), 3_000);
    await child.exited;
    clearTimeout(force);
  }
  await rm(temporary, { recursive: true, force: true });
}
