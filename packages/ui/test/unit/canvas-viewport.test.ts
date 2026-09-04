import { describe, expect, test } from 'bun:test';

import { canvasEventTargetsUi, canvasModeAllowsViewportNavigation } from '../../src/business/canvas-viewport';

describe('shared canvas viewport navigation', () => {
  test('keeps pan and zoom available while annotation owns the Simulator surface', () => {
    expect(canvasModeAllowsViewportNavigation('annotate')).toBe(true);
  });

  test('keeps viewport navigation consistent across every canvas mode', () => {
    expect(['interact', 'annotate', 'variants'].every(canvasModeAllowsViewportNavigation)).toBe(true);
  });
});

describe('canvas UI event isolation', () => {
  test('recognizes events originating inside floating canvas UI', () => {
    const floatingControl = { closest: (selector: string) => (selector === '[data-canvas-ui]' ? {} : null) };
    const artifact = { closest: () => null };

    expect(canvasEventTargetsUi(floatingControl as unknown as EventTarget)).toBe(true);
    expect(canvasEventTargetsUi(artifact as unknown as EventTarget)).toBe(false);
    expect(canvasEventTargetsUi(null)).toBe(false);
  });
});
