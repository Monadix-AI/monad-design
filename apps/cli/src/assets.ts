import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ReleaseTarget {
  platform: NodeJS.Platform;
  arch: string;
  core: string;
  coreNativeAddon: string;
}

interface ReleaseAsset {
  schemaVersion: 1;
  version: string;
  targets: ReleaseTarget[];
  skill: string;
}

interface RuntimeTarget {
  platform: NodeJS.Platform;
  arch: string;
}

const isReleaseTarget = (value: unknown): value is ReleaseTarget => {
  const target = value as Partial<ReleaseTarget>;
  return (
    typeof target?.platform === 'string' &&
    typeof target.arch === 'string' &&
    typeof target.core === 'string' &&
    typeof target.coreNativeAddon === 'string'
  );
};

export const resolveReleaseAssets = async (
  moduleUrl = import.meta.url,
  runtime: RuntimeTarget = { platform: process.platform, arch: process.arch }
) => {
  const directory = dirname(fileURLToPath(moduleUrl));
  const manifestPath = join(directory, 'assets', 'release.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReleaseAsset;
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.version !== 'string' ||
    !Array.isArray(manifest.targets) ||
    !manifest.targets.every(isReleaseTarget) ||
    typeof manifest.skill !== 'string'
  ) {
    throw new Error(`Invalid Monad Design release manifest: ${manifestPath}`);
  }
  const target = manifest.targets.find(
    (candidate) => candidate.platform === runtime.platform && candidate.arch === runtime.arch
  );
  if (!target) {
    const available = manifest.targets.map(({ platform, arch }) => `${platform}-${arch}`).join(', ');
    throw new Error(
      `Monad Design does not support ${runtime.platform}-${runtime.arch}. Available targets: ${available}.`
    );
  }
  return {
    manifest: { schemaVersion: manifest.schemaVersion, version: manifest.version, ...target },
    corePath: join(directory, 'assets', target.core),
    coreNativeAddonPath: join(directory, 'assets', target.coreNativeAddon),
    skillPath: join(directory, 'assets', manifest.skill)
  };
};
