import { describe, expect, test } from 'bun:test';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compareCoreVersions, installCoreExecutable, resolveCorePaths } from '../../src';

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'monad-design-core-installation-'));
  const sourcePath = join(root, 'source-core');
  await writeFile(sourcePath, 'core-v1');
  await chmod(sourcePath, 0o755);
  return {
    environment: { MONAD_DESIGN_CORE_STATE_DIR: join(root, 'state') },
    sourcePath
  };
};

describe('core installation', () => {
  test('installs a versioned executable and stable machine copy', async () => {
    const { environment, sourcePath } = await fixture();
    const result = await installCoreExecutable({
      sourcePath,
      version: '1.2.3',
      source: 'cli',
      environment,
      platform: 'darwin',
      arch: 'arm64'
    });
    const paths = resolveCorePaths(environment);

    expect(result.status).toBe('installed');
    expect(await readFile(paths.executablePath, 'utf8')).toBe('core-v1');
    expect(await readFile(join(paths.versionsDirectory, '1.2.3-darwin-arm64', 'monad-design'), 'utf8')).toBe('core-v1');
    expect(JSON.parse(await readFile(paths.installManifestPath, 'utf8'))).toMatchObject({
      schemaVersion: 1,
      version: '1.2.3',
      source: 'cli'
    });
  });

  test('preserves a newer machine Core', async () => {
    const { environment, sourcePath } = await fixture();
    await installCoreExecutable({ sourcePath, version: '2.0.0', source: 'cli', environment });
    await writeFile(sourcePath, 'older-core');

    const result = await installCoreExecutable({ sourcePath, version: '1.9.0', source: 'desktop', environment });

    expect(result.status).toBe('newer-preserved');
    expect(await readFile(resolveCorePaths(environment).executablePath, 'utf8')).toBe('core-v1');
  });

  test('repairs a missing stable executable from the preserved newer version', async () => {
    const { environment, sourcePath } = await fixture();
    await installCoreExecutable({ sourcePath, version: '2.0.0', source: 'cli', environment });
    const executablePath = resolveCorePaths(environment).executablePath;
    await rm(executablePath);
    await writeFile(sourcePath, 'older-core');

    const result = await installCoreExecutable({ sourcePath, version: '1.0.0', source: 'desktop', environment });

    expect(result.status).toBe('newer-preserved');
    expect(await readFile(executablePath, 'utf8')).toBe('core-v1');
  });

  test('compares semantic release versions and rejects unknown shapes', () => {
    expect(compareCoreVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareCoreVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareCoreVersions('0.9.0', '1.0.0')).toBe(-1);
    expect(compareCoreVersions('development', '1.0.0')).toBeNull();
  });
});
