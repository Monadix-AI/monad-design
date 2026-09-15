import { expect, test } from 'bun:test';

import { fitLiveWorkspaceCanvas, televisionRemoteReservedWidth } from '../../src/business/canvas-controls';

test('tvOS fit reserves space for the inspector-docked remote at the minimum window size', () => {
  const viewport = { width: 800, height: 560 };
  const insets = { top: 112, right: 352, bottom: 80, left: 88 };
  const device = { width: 1944, height: 1092 };
  const fit = fitLiveWorkspaceCanvas(viewport, device, insets, televisionRemoteReservedWidth);
  const deviceRight = viewport.width / 2 + fit.offset.x + (device.width * fit.scale) / 2;
  const remoteLeft = viewport.width - 18 - 310 - 12 - 110;

  expect(deviceRight + 24).toBeLessThanOrEqual(remoteLeft);
  expect(fit.offset.x).toBeLessThan(0);
});
