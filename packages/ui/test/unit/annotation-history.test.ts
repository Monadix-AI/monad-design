import { describe, expect, test } from 'bun:test';

import {
  annotationHistoryReducer,
  initialAnnotationHistory,
  transformAnnotationWithKeyboard
} from '../../src/business/annotation/history';

const rectangle = {
  id: 'rectangle-1',
  type: 'rectangle' as const,
  start: { x: 10, y: 20 },
  end: { x: 80, y: 100 },
  note: ''
};

describe('annotation history', () => {
  test('undoes and redoes committed annotation changes', () => {
    const committed = annotationHistoryReducer(initialAnnotationHistory, { type: 'commit', next: [rectangle] });
    const undone = annotationHistoryReducer(committed, { type: 'undo' });
    const redone = annotationHistoryReducer(undone, { type: 'redo' });

    expect(undone.present).toEqual([]);
    expect(redone.present).toEqual([rectangle]);
  });

  test('clears redo history after a new edit', () => {
    const committed = annotationHistoryReducer(initialAnnotationHistory, { type: 'commit', next: [rectangle] });
    const undone = annotationHistoryReducer(committed, { type: 'undo' });
    const replaced = annotationHistoryReducer(undone, {
      type: 'commit',
      next: [{ ...rectangle, id: 'replacement' }]
    });

    expect(annotationHistoryReducer(replaced, { type: 'redo' })).toBe(replaced);
  });

  test('moves and resizes annotations with normal and accelerated keyboard steps', () => {
    expect(
      transformAnnotationWithKeyboard({
        accelerated: false,
        annotation: rectangle,
        imageSize: { width: 390, height: 844 },
        key: 'ArrowRight',
        resize: false
      })
    ).toMatchObject({ start: { x: 11, y: 20 }, end: { x: 81, y: 100 } });
    expect(
      transformAnnotationWithKeyboard({
        accelerated: true,
        annotation: rectangle,
        imageSize: { width: 390, height: 844 },
        key: 'ArrowDown',
        resize: true
      })
    ).toMatchObject({ start: { x: 10, y: 20 }, end: { x: 80, y: 110 } });
  });
});
