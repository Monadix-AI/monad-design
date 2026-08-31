import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const corePath = resolve(root, '..', 'core', 'dist', 'monad-design');
const coreNativeAddonPath = resolve(root, '..', 'core', 'dist', 'native', 'serve-sim-native.node');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version: string };

await stat(corePath).catch(() => {
  throw new Error('Monad Design Core is not built. Run `bun run --cwd apps/core build` first.');
});
await stat(coreNativeAddonPath).catch(() => {
  throw new Error('Monad Design Core native simulator addon is not built. Run `bun run --cwd apps/core build` first.');
});
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'assets', 'core', 'native'), { recursive: true });

const build = await Bun.build({
  entrypoints: [join(root, 'src', 'cli.ts')],
  external: ['@clack/prompts', 'add-mcp', 'picocolors'],
  outdir: output,
  target: 'node',
  naming: 'cli.js',
  minify: false
});
if (!build.success) {
  for (const log of build.logs) process.stderr.write(`${String(log)}\n`);
  throw new Error('Could not build Monad Design CLI.');
}

await cp(corePath, join(output, 'assets', 'core', 'monad-design'));
await chmod(join(output, 'assets', 'core', 'monad-design'), 0o755);
await cp(coreNativeAddonPath, join(output, 'assets', 'core', 'native', 'serve-sim-native.node'));
await chmod(join(output, 'assets', 'core', 'native', 'serve-sim-native.node'), 0o755);
await cp(join(root, 'assets', 'skill'), join(output, 'assets', 'skill'), { recursive: true });
await writeFile(
  join(output, 'assets', 'release.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      version: packageJson.version,
      platform: process.platform,
      arch: process.arch,
      core: 'core/monad-design',
      coreNativeAddon: 'core/native/serve-sim-native.node',
      skill: 'skill'
    },
    null,
    2
  )}\n`
);
await chmod(join(output, 'cli.js'), 0o755);
