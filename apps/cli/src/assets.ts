import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ReleaseAsset {
  schemaVersion: 1;
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  core: string;
  skill: string;
}

export const resolveReleaseAssets = async (moduleUrl = import.meta.url) => {
  const directory = dirname(fileURLToPath(moduleUrl));
  const manifestPath = join(directory, 'assets', 'release.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReleaseAsset;
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.version !== 'string' ||
    typeof manifest.platform !== 'string' ||
    typeof manifest.arch !== 'string' ||
    typeof manifest.core !== 'string' ||
    typeof manifest.skill !== 'string'
  ) {
    throw new Error(`Invalid Monad Design release manifest: ${manifestPath}`);
  }
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) {
    throw new Error(
      `This Monad Design package contains ${manifest.platform}-${manifest.arch}, but this machine is ${process.platform}-${process.arch}.`
    );
  }
  return {
    manifest,
    corePath: join(directory, 'assets', manifest.core),
    skillPath: join(directory, 'assets', manifest.skill)
  };
};
