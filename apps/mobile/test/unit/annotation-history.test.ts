import type { Annotation } from '@monaddesign/simulator/annotation';

import { expect, test } from 'bun:test';

import { initialAnnotationHistory as empty, annotationHistoryReducer as reduce } from '../../src/annotation-history';

const shape: Annotation = {
  id: 'target',
  type: 'rectangle',
  start: { x: 10, y: 20 },
  end: { x: 100, y: 120 },
  note: 'Keep content'
};
const pen: Annotation = {
  id: 'pen',
  type: 'freehand',
  points: [
    { x: 10, y: 20 },
    { x: 30, y: 40 }
  ]
};

test('clear can be undone and redone without losing notes or Pencil strokes', () => {
  const drawn = reduce(empty, { type: 'commit', next: [shape, pen] });
  const cleared = reduce(drawn, { type: 'commit', next: [] });
  const restored = reduce(cleared, { type: 'undo' });
  expect(restored.present).toEqual([shape, pen]);
  expect(reduce(restored, { type: 'redo' }).present).toEqual([]);
});

test('a drag records a single undo step and a new edit invalidates redo', () => {
  const drawn = reduce(empty, { type: 'commit', next: [shape] });
  const moving = reduce(drawn, { type: 'replace', next: [{ ...shape, start: { x: 20, y: 30 } }] });
  const moved = reduce(moving, { type: 'replace', next: [{ ...shape, start: { x: 40, y: 50 } }] });
  const committed = reduce(moved, { type: 'record', previous: drawn.present });
  expect(committed.past).toHaveLength(2);
  const undone = reduce(committed, { type: 'undo' });
  expect(undone.present).toEqual([shape]);
  const edited = reduce(undone, { type: 'commit', next: [shape, pen] });
  expect(edited.future).toEqual([]);
  expect(reduce(edited, { type: 'reset' })).toEqual(empty);
});
