import { describe, expect, test } from 'bun:test';

import { liveSimulatorDeviceFrame } from '../../src/business/canvas-controls';

const deviceChrome = {
  frame: { width: 500, height: 1000 },
  screen: { x: 50, y: 100, width: 400, height: 800 },
  insets: { top: 100, right: 50, bottom: 100, left: 50 }
};

describe('shared live Simulator geometry', () => {
  test('uses native chrome frame and insets in portrait', () => {
    const frame = liveSimulatorDeviceFrame({
      deviceChrome,
      deviceHeight: 800,
      deviceName: 'iPhone',
      deviceWidth: 400,
      orientation: 'portrait'
    });

    expect(frame.frameWidth).toBe(500);
    expect(frame.frameHeight).toBe(1000);
    expect(frame.insets).toEqual({ top: 100, right: 50, bottom: 100, left: 50 });
  });

  test('rotates native chrome geometry with the Simulator', () => {
    const frame = liveSimulatorDeviceFrame({
      deviceChrome,
      deviceHeight: 400,
      deviceName: 'iPhone',
      deviceWidth: 800,
      orientation: 'landscape_left'
    });

    expect(frame.frameWidth).toBe(1000);
    expect(frame.frameHeight).toBe(500);
    expect(frame.insets).toEqual({ top: 50, right: 100, bottom: 50, left: 100 });
  });
});
