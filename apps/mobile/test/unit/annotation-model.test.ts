import { describe, expect, test } from 'bun:test';

import {
  annotationIsVisible,
  calloutAnchor,
  calloutConnectorPath,
  containFrame,
  freehandIsVisible,
  imagePoint,
  isDrawnAnnotation
} from '../../src/annotation-model';

describe('mobile annotation geometry', () => {
  test('maps a contained preview back into source-image coordinates', () => {
    const frame = containFrame({ width: 1000, height: 700 }, { width: 400, height: 800 });
    expect(frame).toEqual({ x: 325, y: 0, width: 350, height: 700 });
    expect(imagePoint({ x: 175, y: 350 }, frame, { width: 400, height: 800 })).toEqual({ x: 200, y: 400 });
    expect(imagePoint({ x: -1, y: 20 }, frame, { width: 400, height: 800 })).toBeNull();
  });

  test('filters taps and numbers a drawn target at its outward edge', () => {
    const annotation = {
      id: 'one',
      type: 'rectangle' as const,
      start: { x: 40, y: 80 },
      end: { x: 240, y: 280 },
      note: 'Increase spacing.'
    };
    expect(annotationIsVisible(annotation)).toBe(true);
    expect(calloutAnchor(annotation)).toEqual({ x: 240, y: 180 });
    expect(annotationIsVisible({ ...annotation, end: { x: 42, y: 82 } })).toBe(false);
  });

  test('connects a numbered target to its implementation note with the desktop curve', () => {
    expect(calloutConnectorPath({ x: 240, y: 180 }, { x: 680, y: 84 })).toBe('M 240 180 C 424.8 180, 495.2 84, 680 84');
  });

  test('keeps Pencil freehand marks separate from numbered shape callouts', () => {
    const freehand = {
      id: 'pencil-one',
      type: 'freehand' as const,
      points: [
        { x: 20, y: 40 },
        { x: 22, y: 42 },
        { x: 60, y: 70 }
      ]
    };
    expect(freehandIsVisible(freehand)).toBe(true);
    expect(isDrawnAnnotation(freehand)).toBe(false);
    expect(freehandIsVisible({ ...freehand, points: freehand.points.slice(0, 2) })).toBe(false);
  });
});
