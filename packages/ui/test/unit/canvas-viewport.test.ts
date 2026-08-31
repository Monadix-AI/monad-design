import { describe, expect, test } from 'bun:test';

import { canvasModeAllowsViewportNavigation } from '../../src/business/canvas-viewport';

describe('shared canvas viewport navigation', () => {
  test('keeps pan and zoom available while annotation owns the Simulator surface', () => {
    expect(canvasModeAllowsViewportNavigation('annotate')).toBe(true);
  });

  test('keeps viewport navigation consistent across every canvas mode', () => {
    expect(['interact', 'annotate', 'variants'].every(canvasModeAllowsViewportNavigation)).toBe(true);
  });
});
