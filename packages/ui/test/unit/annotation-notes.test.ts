import type { DrawnAnnotation } from '@monaddesign/simulator/annotation';

import { describe, expect, test } from 'bun:test';

import { serializeAnnotationNotes } from '../../src/business/annotation/notes';

const callout = (id: string, note: string): DrawnAnnotation => ({
  id,
  note,
  type: 'rectangle',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 100 }
});

describe('annotation request notes', () => {
  test('preserves screenshot numbering across empty notes and text annotations', () => {
    expect(
      serializeAnnotationNotes([
        callout('first', '  调整间距\n保留颜色  '),
        { id: 'text', type: 'text', start: { x: 10, y: 10 }, text: 'On-image text' },
        callout('second', '  '),
        callout('third', 'Increase size')
      ])
    ).toBe('Implementation notes (numbers match the annotated screenshot):\n1. 调整间距\n保留颜色\n3. Increase size');
  });

  test('omits the notes section when there are no written notes', () => {
    expect(serializeAnnotationNotes([])).toBe('');
    expect(serializeAnnotationNotes([callout('empty', '  ')])).toBe('');
  });
});
