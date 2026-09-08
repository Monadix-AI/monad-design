import { describe, expect, test } from 'bun:test';

import {
  canvasEventTargetsUi,
  canvasModeAllowsViewportNavigation,
  measureCanvasFitInsets
} from '../../src/business/canvas-viewport';

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

describe('canvas fit obstacles', () => {
  test('measures visible controls relative to the canvas and adds breathing room', () => {
    const rect = (left: number, top: number, width: number, height: number) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    });
    const controls = [
      { selector: '.canvas-page-heading', bounds: rect(40, 100, 200, 120) },
      { selector: '.workspace-tool-rail', bounds: rect(38, 230, 44, 400) },
      { selector: '.floating-inspector', bounds: rect(1000, 100, 280, 700) },
      { selector: '.workspace-support-panel[data-state="open"]', bounds: rect(700, 100, 280, 700) },
      { selector: '.zoom-controls', bounds: rect(38, 800, 160, 40) },
      { selector: '.canvas-error', bounds: rect(0, 0, 0, 0) }
    ];
    const viewport = {
      getBoundingClientRect: () => rect(20, 60, 1280, 800),
      querySelectorAll: (selector: string) =>
        controls
          .filter((control) => selector.includes(control.selector))
          .map((control) => ({ getBoundingClientRect: () => control.bounds }))
    };
    expect(measureCanvasFitInsets(viewport as unknown as HTMLElement)).toEqual({
      top: 184,
      left: 86,
      right: 624,
      bottom: 84
    });
  });
});
