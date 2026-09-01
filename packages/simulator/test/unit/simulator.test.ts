import { describe, expect, test } from 'bun:test';

import {
  canvasOffsetForZoom,
  clampCanvasOffset,
  encodeSimulatorFrame,
  fitCanvasScale,
  normalizedCanvasPoint,
  orientCanvasPoint,
  rotatedSimulatorOrientation,
  simulatorKeyUsage
} from '../../src';
import { annotationContainsPoint, calloutBadgeGeometry, translateAnnotation } from '../../src/annotation';

describe('shared canvas positioning', () => {
  test('keeps dragged content recoverable', () => {
    expect(
      clampCanvasOffset({ x: 10_000, y: -10_000 }, { width: 1_200, height: 800 }, { width: 400, height: 700 })
    ).toEqual({ x: 704, y: -654 });
  });

  test('keeps the pointer anchor stationary while zooming', () => {
    expect(canvasOffsetForZoom({ x: 0, y: 0 }, { width: 1_000, height: 800 }, { x: 750, y: 300 }, 1, 2)).toEqual({
      x: -250,
      y: 100
    });
  });

  test('fits content inside the reserved workspace area', () => {
    expect(
      fitCanvasScale(
        { width: 1_200, height: 800 },
        { width: 400, height: 764 },
        { horizontalReserve: 440, maximumScale: 2, verticalReserve: 180 }
      )
    ).toBeCloseTo(620 / 764);
  });

  test('normalizes against screen bounds and applies orientation', () => {
    const bounds = { height: 600, left: 100, top: 100, width: 300 };
    expect(normalizedCanvasPoint({ x: 250, y: 400 }, bounds)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizedCanvasPoint({ x: 80, y: 400 }, bounds)).toBeNull();
    expect(orientCanvasPoint({ x: 0.2, y: 0.7 }, 'landscape_left')).toEqual({ x: 0.7, y: 0.8 });
  });
});

describe('shared Simulator input protocol', () => {
  test('cycles orientation in control direction', () => {
    expect(rotatedSimulatorOrientation('portrait', 'left')).toBe('landscape_right');
    expect(rotatedSimulatorOrientation('portrait', 'right')).toBe('landscape_left');
  });

  test('encodes one-byte tagged frames', () => {
    const value = encodeSimulatorFrame(0x04, { button: 'home' });
    expect(value[0]).toBe(0x04);
    expect(new TextDecoder().decode(value.subarray(1))).toBe('{"button":"home"}');
  });

  test('maps browser keys to HID usages', () => {
    expect(simulatorKeyUsage('KeyA')).toBe(4);
    expect(simulatorKeyUsage('Digit0')).toBe(39);
    expect(simulatorKeyUsage('ArrowLeft')).toBe(80);
    expect(simulatorKeyUsage('F12')).toBeUndefined();
  });
});

describe('shared annotation interaction', () => {
  const rectangle = {
    id: 'rectangle-1',
    type: 'rectangle' as const,
    start: { x: 40, y: 80 },
    end: { x: 240, y: 280 },
    note: ''
  };

  test('places the number outside the shape and starts the connector after it', () => {
    const badge = calloutBadgeGeometry(rectangle, { width: 390, height: 844 }, 20);
    expect(badge.anchor).toEqual({ x: 240, y: 180 });
    expect(badge.center).toEqual({ x: 260, y: 180 });
    expect(badge.connector).toEqual({ x: 280, y: 180 });
  });

  test('hit-tests and drags annotations while keeping them in the image', () => {
    expect(annotationContainsPoint(rectangle, { x: 120, y: 160 })).toBe(true);
    expect(annotationContainsPoint(rectangle, { x: 300, y: 160 })).toBe(false);
    expect(translateAnnotation(rectangle, { x: 300, y: -200 }, { width: 390, height: 844 })).toMatchObject({
      start: { x: 190, y: 0 },
      end: { x: 390, y: 200 }
    });
  });
});
