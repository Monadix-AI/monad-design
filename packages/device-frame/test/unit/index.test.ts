import { describe, expect, test } from 'bun:test';

import { deviceFrameKind, deviceFrameMetrics, simulatorDeviceGlyphMetrics } from '../../src';

describe('device frame profiles', () => {
  test('recognizes current, notched, legacy, and iPad hardware', () => {
    expect(deviceFrameKind('iPhone 16 Pro', { width: 402, height: 874 })).toBe('dynamic-island');
    expect(deviceFrameKind('iPhone 13 mini', { width: 375, height: 812 })).toBe('notch');
    expect(
      deviceFrameKind('iPhone SE (3rd generation)', {
        width: 375,
        height: 667
      })
    ).toBe('home-button');
    expect(deviceFrameKind('iPad Pro 13-inch (M4)', { width: 1032, height: 1376 })).toBe('tablet');
  });

  test('rotates physical hardware and asymmetric bezels with the device', () => {
    const portrait = deviceFrameMetrics({
      deviceName: 'iPhone SE (3rd generation)',
      screenWidth: 375,
      screenHeight: 667,
      orientation: 'portrait'
    });
    const landscape = deviceFrameMetrics({
      deviceName: 'iPhone SE (3rd generation)',
      screenWidth: 667,
      screenHeight: 375,
      orientation: 'landscape_left'
    });

    expect(portrait.hardware?.edge).toBe('bottom');
    expect(landscape.hardware?.edge).toBe('right');
    expect(landscape.insets.left).toBeCloseTo(portrait.insets.top);
    expect(landscape.insets.right).toBeCloseTo(portrait.insets.bottom);
  });

  test('keeps the rendered screen dimensions separate from the shell', () => {
    const metrics = deviceFrameMetrics({
      deviceName: 'iPhone 16 Pro',
      screenWidth: 402,
      screenHeight: 874,
      orientation: 'portrait'
    });

    expect(metrics.frameWidth).toBeGreaterThan(402);
    expect(metrics.frameHeight).toBeGreaterThan(874);
    expect(metrics.hardware?.kind).toBe('dynamic-island');
    expect(metrics.screenRadius).toBeGreaterThan(50);
  });

  test('describes the same simulator-list glyph for every renderer', () => {
    const phone = simulatorDeviceGlyphMetrics({
      deviceName: 'iPhone 16 Pro Max',
      runtime: 'iOS 18.5',
      screen: { width: 440, height: 956 }
    });
    const tablet = simulatorDeviceGlyphMetrics({
      deviceName: 'iPad Pro 13-inch (M5)',
      runtime: 'iOS 26.5',
      screen: { width: 1032, height: 1376 }
    });

    expect(phone.kind).toBe('dynamic-island');
    expect(phone.height).toBe(30);
    expect(phone.width).toBeCloseTo(13.81, 2);
    expect(tablet.kind).toBe('tablet');
    expect(tablet.height).toBeCloseTo(24.18, 2);
    expect(tablet.width).toBeCloseTo(18.135, 3);
  });

  test('gives watchOS and tvOS their own list silhouettes', () => {
    const watch = simulatorDeviceGlyphMetrics({
      deviceName: 'Apple Watch Series 11 (46mm)',
      runtime: 'watchOS 26.0',
      productFamily: 'Apple Watch',
      screen: { width: 416, height: 496 }
    });
    const tv = simulatorDeviceGlyphMetrics({
      deviceName: 'Apple TV 4K (3rd generation)',
      runtime: 'tvOS 26.0',
      productFamily: 'Apple TV',
      screen: { width: 3840, height: 2160 }
    });

    expect(watch.kind).toBe('watch');
    expect(watch.width).toBe(22);
    expect(watch.height).toBe(26);
    expect(tv.kind).toBe('tv');
    expect(tv.width).toBe(26);
    expect(tv.height).toBe(20);
  });
});
