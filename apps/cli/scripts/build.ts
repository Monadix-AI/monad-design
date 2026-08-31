import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const releaseTargets = ['arm64', 'x64'].map((arch) => ({
  platform: 'darwin' as const,
  arch,
  sourcePath: resolve(root, '..', 'core', 'dist', `darwin-${arch}`, 'monad-design'),
  core: `core/darwin-${arch}/monad-design`,
  coreNativeAddon: 'core/native/serve-sim-native.node'
}));
const coreNativeAddonPath = resolve(root, '..', 'core', 'dist', 'native', 'serve-sim-native.node');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version: string };

for (const target of releaseTargets) {
  await stat(target.sourcePath).catch(() => {
    throw new Error(
      `Monad Design Core for ${target.platform}-${target.arch} is not built. Run \`bun run --cwd apps/core build\` first.`
    );
  });
}
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

for (const target of releaseTargets) {
  const destination = join(output, 'assets', target.core);
  await mkdir(dirname(destination), { recursive: true });
  await cp(target.sourcePath, destination);
  await chmod(destination, 0o755);
}
await cp(coreNativeAddonPath, join(output, 'assets', 'core', 'native', 'serve-sim-native.node'));
await chmod(join(output, 'assets', 'core', 'native', 'serve-sim-native.node'), 0o755);
await cp(join(root, 'assets', 'skill'), join(output, 'assets', 'skill'), { recursive: true });
await writeFile(
  join(output, 'assets', 'release.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      version: packageJson.version,
      targets: releaseTargets.map(({ platform, arch, core, coreNativeAddon }) => ({
        platform,
        arch,
        core,
        coreNativeAddon
      })),
      skill: 'skill'
    },
    null,
    2
  )}\n`
);
await chmod(join(output, 'cli.js'), 0o755);
