import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveReleaseAssets } from '../../src/assets';

const temporaryDirectories: string[] = [];

const createRelease = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'monad-design-assets-'));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(
    join(directory, 'assets', 'release.json'),
    JSON.stringify({
      schemaVersion: 1,
      version: '0.0.1',
      targets: [
        {
          platform: 'darwin',
          arch: 'arm64',
          core: 'core/darwin-arm64/monad-design',
          coreNativeAddon: 'core/native/serve-sim-native.node'
        },
        {
          platform: 'darwin',
          arch: 'x64',
          core: 'core/darwin-x64/monad-design',
          coreNativeAddon: 'core/native/serve-sim-native.node'
        }
      ],
      skill: 'skill'
    })
  );
  return pathToFileURL(join(directory, 'cli.js')).href;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('release assets', () => {
  test('selects the matching arm64 and x64 Core distributions', async () => {
    const moduleUrl = await createRelease();
    const arm64 = await resolveReleaseAssets(moduleUrl, { platform: 'darwin', arch: 'arm64' });
    const x64 = await resolveReleaseAssets(moduleUrl, { platform: 'darwin', arch: 'x64' });

    expect(arm64.manifest.arch).toBe('arm64');
    expect(arm64.corePath).toEndWith('/assets/core/darwin-arm64/monad-design');
    expect(x64.manifest.arch).toBe('x64');
    expect(x64.corePath).toEndWith('/assets/core/darwin-x64/monad-design');
  });

  test('reports the available distributions for an unsupported runtime', async () => {
    const moduleUrl = await createRelease();

    await expect(resolveReleaseAssets(moduleUrl, { platform: 'linux', arch: 'x64' })).rejects.toThrow(
      'Monad Design does not support linux-x64. Available targets: darwin-arm64, darwin-x64.'
    );
  });
});
