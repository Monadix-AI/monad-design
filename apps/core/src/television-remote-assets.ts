import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const remoteAssetFiles = {
  chrome: 'Remote Chrome.pdf',
  ring: 'Remote BTN_Circle.pdf',
  menu: 'Remote Glyph_Menu.pdf',
  tv: 'Glyph_TV.pdf',
  playPause: 'Glyph_PlayPause.pdf'
} as const;

export type TelevisionRemoteAsset = keyof typeof remoteAssetFiles;

export const isTelevisionRemoteAsset = (name: string): name is TelevisionRemoteAsset =>
  Object.hasOwn(remoteAssetFiles, name);

const assetCache = new Map<TelevisionRemoteAsset, Promise<Buffer>>();

export const televisionRemoteAsset = (name: TelevisionRemoteAsset) => {
  const cached = assetCache.get(name);
  if (cached) return cached;
  const loading = (async () => {
    const { stdout } = await execFileAsync('xcode-select', ['-p'], { timeout: 5_000 });
    const simulatorResources = join(stdout.trim(), 'Applications', 'Simulator.app', 'Contents', 'Resources');
    const directory = await mkdtemp(join(tmpdir(), 'monaddesign-tv-remote-'));
    const output = join(directory, `${name}.png`);
    try {
      await execFileAsync(
        'sips',
        ['-s', 'format', 'png', join(simulatorResources, remoteAssetFiles[name]), '--out', output],
        { timeout: 10_000 }
      );
      return await readFile(output);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  })();
  assetCache.set(name, loading);
  void loading.catch(() => assetCache.delete(name));
  return loading;
};
