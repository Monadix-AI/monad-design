import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const readInstallerAssets = async (root: string, arch = process.arch) => {
  const manifest = JSON.parse(await readFile(join(root, 'release.json'), 'utf8')) as {
    schemaVersion: number;
    coreVersion: string;
    skillVersion: string;
    platform: string;
    arch: string;
    hashes: Record<string, string>;
  };
  if (
    manifest.schemaVersion !== 1 ||
    manifest.platform !== 'darwin' ||
    manifest.arch !== arch ||
    !/^\d+\.\d+\.\d+/.test(manifest.coreVersion) ||
    typeof manifest.skillVersion !== 'string'
  ) {
    throw new Error('The bundled installer does not match this Mac. Download the correct desktop build.');
  }
  for (const file of ['core/monad-design', 'core/native/serve-sim-native.node']) {
    const hash = createHash('sha256')
      .update(await readFile(join(root, file)))
      .digest('hex');
    if (hash !== manifest.hashes?.[file]) throw new Error(`Bundled runtime failed verification: ${file}`);
  }
  await readFile(join(root, 'skill/SKILL.md'), 'utf8');
  return {
    manifest,
    corePath: join(root, 'core/monad-design'),
    nativeAddonPath: join(root, 'core/native/serve-sim-native.node'),
    skillPath: join(root, 'skill')
  };
};
