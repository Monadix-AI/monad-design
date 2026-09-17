import { chmod, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'native', 'serve-sim-native.node');
// Each executable must also work directly from its architecture directory.
for (const directory of ['dist', 'dist/darwin-arm64', 'dist/darwin-x64']) {
  const destination = join(root, directory, 'native', 'serve-sim-native.node');
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  await chmod(destination, 0o755);
}
