import { describe, expect, test } from 'bun:test';

import { simulatorChromeLayout, simulatorFrameSize, simulatorMaskGeometry } from '../../src/workspace-layout';

const phoneScreen = { width: 1206, height: 2622 };
const deviceChrome = {
  image: 'data:image/png;base64,chrome',
  frame: { width: 454, height: 908 },
  body: { x: 9, y: 0, width: 436, height: 908 },
  screen: { x: 26, y: 17, width: 402, height: 874 },
  insets: { top: 17, right: 26, bottom: 17, left: 26 }
};

describe('Simulator workspace layout', () => {
  test('rotates the portrait framebuffer mask with the screen', () => {
    expect(
      simulatorMaskGeometry({
        frame: { width: 600, height: 276 },
        orientation: 'landscape_left'
      })
    ).toEqual({ width: 276, height: 600, rotation: '90deg' });
    expect(
      simulatorMaskGeometry({
        frame: { width: 276, height: 600 },
        orientation: 'portrait_upside_down'
      })
    ).toEqual({ width: 276, height: 600, rotation: '180deg' });
  });

  test('keeps the preferred portrait height when the canvas is spacious', () => {
    expect(
      simulatorFrameSize({
        screen: phoneScreen,
        deviceName: 'iPhone 17 Pro',
        orientation: 'portrait',
        viewport: { width: 900, height: 900 },
        scale: 1
      })
    ).toEqual({
      width: 600 * (1206 / 2622),
      height: 600
    });
  });

  test('keeps the same device scale after rotation', () => {
    const frame = simulatorFrameSize({
      screen: phoneScreen,
      deviceName: 'iPhone 17 Pro',
      orientation: 'landscape_right',
      viewport: { width: 900, height: 900 },
      scale: 1
    });

    expect(frame.width).toBeCloseTo(600);
    expect(frame.height).toBeCloseTo(600 / (2622 / 1206));
  });

  test('keeps the landscape frame aligned when runtime dimensions are already rotated', () => {
    const frame = simulatorFrameSize({
      screen: { width: phoneScreen.height, height: phoneScreen.width },
      deviceName: 'iPhone 17 Pro',
      orientation: 'landscape_right',
      viewport: { width: 900, height: 900 },
      scale: 1
    });

    expect(frame.width).toBeCloseTo(600);
    expect(frame.height).toBeCloseTo(600 * (1206 / 2622));
  });

  test('keeps the portrait frame aligned when runtime dimensions arrive in landscape order', () => {
    const frame = simulatorFrameSize({
      screen: { width: phoneScreen.height, height: phoneScreen.width },
      deviceName: 'iPhone 17 Pro',
      orientation: 'portrait',
      viewport: { width: 900, height: 900 },
      scale: 1
    });

    expect(frame.width).toBeCloseTo(600 * (1206 / 2622));
    expect(frame.height).toBeCloseTo(600);
  });

  test('fits small canvases before applying manual zoom', () => {
    const fitted = simulatorFrameSize({
      screen: phoneScreen,
      deviceName: 'iPhone 17 Pro',
      orientation: 'landscape_left',
      viewport: { width: 548, height: 900 },
      scale: 0.8
    });

    expect(fitted.width).toBeLessThan(500 * 0.8);
    expect(fitted.width).toBeGreaterThan(380);
  });

  test('uses the native DeviceKit chrome geometry around a portrait screen', () => {
    expect(
      simulatorChromeLayout({
        chrome: deviceChrome,
        screenFrame: { width: 201, height: 437 },
        orientation: 'portrait'
      })
    ).toEqual({
      frameWidth: 227,
      frameHeight: 454,
      insets: { top: 8.5, right: 13, bottom: 8.5, left: 13 },
      body: { left: 4.5, top: 0, width: 218, height: 454, rotation: '0deg' }
    });
  });

  test('rotates the native DeviceKit chrome and its screen insets together', () => {
    expect(
      simulatorChromeLayout({
        chrome: deviceChrome,
        screenFrame: { width: 437, height: 201 },
        orientation: 'landscape_left'
      })
    ).toEqual({
      frameWidth: 454,
      frameHeight: 227,
      insets: { top: 13, right: 8.5, bottom: 13, left: 8.5 },
      body: { left: 118, top: -113.5, width: 218, height: 454, rotation: '90deg' }
    });
  });
});
