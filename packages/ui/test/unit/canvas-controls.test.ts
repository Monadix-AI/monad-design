import { describe, expect, test } from 'bun:test';

import {
  canvasModeShowsSelectionOverlay,
  fitLiveWorkspaceCanvas,
  liveSimulatorDeviceFrame,
  webDeviceControlsReservedHeight
} from '../../src/business/canvas-controls';

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
      deviceHeight: 800,
      deviceName: 'iPhone',
      deviceWidth: 400,
      orientation: 'landscape_left'
    });

    expect(frame.frameWidth).toBe(1000);
    expect(frame.frameHeight).toBe(500);
    expect(frame.insets).toEqual({ top: 50, right: 100, bottom: 50, left: 100 });
  });

  test('rotates fallback frame dimensions from the portrait screen size', () => {
    const frame = liveSimulatorDeviceFrame({
      deviceHeight: 800,
      deviceName: 'iPhone 16 Pro',
      deviceWidth: 400,
      orientation: 'landscape_right'
    });

    expect(frame.frameWidth).toBeGreaterThan(800);
    expect(frame.frameHeight).toBeGreaterThan(400);
    expect(frame.frameWidth).toBeGreaterThan(frame.frameHeight);
  });
});

describe('live Simulator selection overlay', () => {
  test('only renders selection bounds in the interactive canvas', () => {
    expect(canvasModeShowsSelectionOverlay('interact', true)).toBe(true);
    expect(canvasModeShowsSelectionOverlay('annotate', true)).toBe(false);
    expect(canvasModeShowsSelectionOverlay('variants', true)).toBe(false);
    expect(canvasModeShowsSelectionOverlay('interact', false)).toBe(false);
  });
});

describe('default Simulator size', () => {
  test('keeps native logical size on a large canvas', () => {
    expect(fitLiveWorkspaceCanvas({ width: 2000, height: 1600 }, { width: 430, height: 920 }).scale).toBe(1);
  });
  for (const device of [
    { width: 430, height: 920 },
    { width: 920, height: 430 },
    { width: 2000, height: 2000 }
  ]) {
    test(`keeps ${device.width}x${device.height} inside the unobstructed canvas`, () => {
      const viewport = { width: 1280, height: 800 };
      const insets = { top: 190, left: 100, right: 400, bottom: 90 };
      const { scale, offset } = fitLiveWorkspaceCanvas(viewport, device, insets);
      const center = { x: viewport.width / 2 + offset.x, y: viewport.height / 2 + offset.y };
      expect(center.x - (device.width * scale) / 2).toBeGreaterThanOrEqual(insets.left);
      expect(center.x + (device.width * scale) / 2).toBeLessThanOrEqual(viewport.width - insets.right);
      expect(center.y - (device.height * scale) / 2).toBeGreaterThanOrEqual(insets.top);
      expect(center.y + (device.height * scale) / 2 + webDeviceControlsReservedHeight).toBeLessThanOrEqual(
        viewport.height - insets.bottom
      );
    });
  }
  test('can fit below manual minimum zoom instead of covering controls', () => {
    expect(fitLiveWorkspaceCanvas({ width: 800, height: 560 }, { width: 2000, height: 2000 }).scale).toBeLessThan(0.25);
  });
  test('recenters and shrinks when a support panel consumes more space', () => {
    const viewport = { width: 1440, height: 900 };
    const device = { width: 920, height: 430 };
    const closed = fitLiveWorkspaceCanvas(viewport, device);
    const open = fitLiveWorkspaceCanvas(viewport, device, { top: 190, left: 88, right: 744, bottom: 80 });
    expect(open.scale).toBeLessThan(closed.scale);
    expect(open.offset.x).toBeLessThan(closed.offset.x);
  });
});
