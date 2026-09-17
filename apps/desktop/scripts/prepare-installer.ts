import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(root, '../..');
const architecture = process.env.MONAD_DESIGN_DESKTOP_ARCH ?? process.arch;
if (!['arm64', 'x64'].includes(architecture)) throw new Error(`Unsupported Desktop architecture: ${architecture}`);
const output = join(root, 'dist-installer');
const version = (JSON.parse(await readFile(join(repository, 'apps/cli/package.json'), 'utf8')) as { version: string })
  .version;
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'core/native'), { recursive: true });
await cp(
  join(repository, 'apps/core/dist', `darwin-${architecture}`, 'monad-design'),
  join(output, 'core/monad-design')
);
await cp(
  join(repository, 'apps/core/dist/native/serve-sim-native.node'),
  join(output, 'core/native/serve-sim-native.node')
);
await cp(join(repository, '.agents/skills/monad-design'), join(output, 'skill'), { recursive: true });
const hashes: Record<string, string> = {};
for (const file of ['core/monad-design', 'core/native/serve-sim-native.node']) {
  hashes[file] = createHash('sha256')
    .update(await readFile(join(output, file)))
    .digest('hex');
}
await writeFile(
  join(output, 'release.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      coreVersion: version,
      skillVersion: version,
      platform: 'darwin',
      arch: architecture,
      hashes
    },
    null,
    2
  )}\n`
);
