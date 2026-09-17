import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readInstallerAssets } from '../../electron/installer-assets';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
test('installer validates payload identity, architecture and hashes independently of desktop version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'monad-desktop-assets-'));
  roots.push(root);
  await mkdir(join(root, 'core/native'), { recursive: true });
  await mkdir(join(root, 'skill'));
  const hashes: Record<string, string> = {};
  for (const path of ['core/monad-design', 'core/native/serve-sim-native.node']) {
    await writeFile(join(root, path), path);
    hashes[path] = createHash('sha256').update(path).digest('hex');
  }
  await writeFile(join(root, 'skill/SKILL.md'), 'skill');
  await writeFile(
    join(root, 'release.json'),
    JSON.stringify({
      schemaVersion: 1,
      coreVersion: '0.0.12',
      skillVersion: '0.0.12',
      platform: 'darwin',
      arch: 'arm64',
      hashes
    })
  );
  expect((await readInstallerAssets(root, 'arm64')).manifest.coreVersion).toBe('0.0.12');
  await expect(readInstallerAssets(root, 'x64')).rejects.toThrow('match');
  await writeFile(join(root, 'core/monad-design'), 'corrupt');
  await expect(readInstallerAssets(root, 'arm64')).rejects.toThrow('verification');
});
