import { chmod, copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const architectures = ['arm64', 'x64'] as const;

if (process.platform !== 'darwin' || !architectures.includes(process.arch as (typeof architectures)[number])) {
  throw new Error(
    `Monad Design Core releases must be built on macOS arm64 or x64, found ${process.platform}-${process.arch}.`
  );
}

for (const arch of architectures) {
  const outputDirectory = join(root, 'dist', `darwin-${arch}`);
  const outputPath = join(outputDirectory, 'monad-design');
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const build = Bun.spawn(
    [
      process.execPath,
      'build',
      '--compile',
      `--target=bun-darwin-${arch}`,
      '--minify',
      '--asset',
      'ui/dist',
      '--outfile',
      outputPath,
      'src/main.ts'
    ],
    { cwd: root, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }
  );
  if ((await build.exited) !== 0) throw new Error(`Could not build Monad Design Core for darwin-${arch}.`);
  await chmod(outputPath, 0o755);
}

const hostOutput = join(root, 'dist', `darwin-${process.arch}`, 'monad-design');
const localOutput = join(root, 'dist', 'monad-design');
await copyFile(hostOutput, localOutput);
await chmod(localOutput, 0o755);
