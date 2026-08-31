import { describe, expect, test } from 'bun:test';
import { canvasOffsetForZoom, clampCanvasOffset } from '@monaddesign/simulator';

describe('mobile canvas position boundaries', () => {
  test('keeps part of a dragged device visible so it remains recoverable', () => {
    expect(
      clampCanvasOffset({ x: 10_000, y: -10_000 }, { width: 1_200, height: 800 }, { width: 400, height: 700 })
    ).toEqual({ x: 704, y: -654 });
  });

  test('keeps small content recoverable within the viewport', () => {
    expect(clampCanvasOffset({ x: -500, y: 500 }, { width: 320, height: 240 }, { width: 60, height: 80 })).toEqual({
      x: -130,
      y: 80
    });
  });
});

describe('mobile canvas zoom anchoring', () => {
  test('keeps the canvas point under a pinch center stationary while zooming', () => {
    expect(canvasOffsetForZoom({ x: 0, y: 0 }, { width: 1_000, height: 800 }, { x: 750, y: 300 }, 1, 2)).toEqual({
      x: -250,
      y: 100
    });
  });
});
