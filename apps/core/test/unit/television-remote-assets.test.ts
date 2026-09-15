import { expect, test } from 'bun:test';

import { isTelevisionRemoteAsset, televisionRemoteAsset } from '../../src/television-remote-assets';

test('remote artwork loads from the selected local Xcode installation', async () => {
  const image = await televisionRemoteAsset('chrome');
  expect(image.subarray(0, 8)).toEqual(Buffer.from('89504e470d0a1a0a', 'hex'));
  expect(await televisionRemoteAsset('chrome')).toBe(image);
});

test('remote asset names cannot traverse the local filesystem', () => {
  expect(isTelevisionRemoteAsset('chrome')).toBe(true);
  expect(isTelevisionRemoteAsset('../../Info.plist')).toBe(false);
});
