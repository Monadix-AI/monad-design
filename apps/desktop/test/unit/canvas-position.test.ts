import { describe, expect, test } from 'bun:test';
import { canvasOffsetForZoom, clampCanvasOffset } from '@monaddesign/simulator';

describe('canvas position boundaries', () => {
  test('preserves offsets that keep the device within the canvas boundary', () => {
    expect(clampCanvasOffset({ x: -150, y: 40 }, { width: 1200, height: 800 }, { width: 390, height: 700 })).toEqual({
      x: -150,
      y: 40
    });
  });

  test('keeps part of the device visible instead of allowing endless panning', () => {
    expect(
      clampCanvasOffset({ x: 10_000, y: -10_000 }, { width: 1200, height: 800 }, { width: 400, height: 700 })
    ).toEqual({ x: 704, y: -654 });
  });

  test('keeps small content fully recoverable', () => {
    expect(clampCanvasOffset({ x: -500, y: 500 }, { width: 320, height: 240 }, { width: 60, height: 80 })).toEqual({
      x: -130,
      y: 80
    });
  });
});

describe('canvas zoom anchoring', () => {
  test('keeps the canvas point under the pointer stationary while zooming', () => {
    expect(canvasOffsetForZoom({ x: 0, y: 0 }, { width: 1_000, height: 800 }, { x: 750, y: 300 }, 1, 2)).toEqual({
      x: -250,
      y: 100
    });
  });

  test('preserves the offset when zooming around the canvas content center', () => {
    expect(
      canvasOffsetForZoom({ x: 120, y: -40 }, { width: 1_000, height: 800 }, { x: 620, y: 360 }, 0.75, 1.5)
    ).toEqual({ x: 120, y: -40 });
  });
});
