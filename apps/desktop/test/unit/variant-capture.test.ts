import type { AXElement, AXSnapshot } from '../../src/electron';

import { describe, expect, test } from 'bun:test';
import {
  captureTargetFramesAreStable,
  captureTargetIsVisible,
  findCaptureTarget
} from '@monaddesign/simulator/accessibility-target';

const target: AXElement = {
  id: 'settings-save-button',
  path: '0.2.7',
  label: 'Save settings',
  value: '',
  role: 'button',
  type: 'Button',
  enabled: true,
  isContainer: false,
  frame: { x: 24, y: 700, width: 342, height: 48 }
};

const snapshot = (elements: AXElement[], screen = { width: 390, height: 844 }): AXSnapshot => ({ screen, elements });

describe('variant capture target readiness', () => {
  test('matches a stable accessibility identifier across layout changes', () => {
    const moved = {
      ...target,
      path: '0.4.9',
      label: 'Localized save label',
      frame: { ...target.frame, y: 380 }
    };

    expect(findCaptureTarget(snapshot([moved]), target)).toEqual(moved);
  });

  test('falls back to semantic evidence when the runtime id is a path', () => {
    const pathTarget = { ...target, id: target.path };
    const decoy = {
      ...target,
      id: 'cancel',
      path: target.path,
      label: 'Cancel'
    };
    const moved = { ...target, id: '0.4.9', path: '0.4.9' };

    expect(findCaptureTarget(snapshot([decoy, moved]), pathTarget)).toEqual(moved);
  });

  test('requires most of the selected target to be visible', () => {
    expect(captureTargetIsVisible(snapshot([target]), target)).toBe(true);
    expect(
      captureTargetIsVisible(snapshot([target]), {
        ...target,
        frame: { ...target.frame, y: 830 }
      })
    ).toBe(false);
  });

  test('accepts only settled target geometry', () => {
    expect(
      captureTargetFramesAreStable(target, {
        ...target,
        frame: { ...target.frame, y: 701 }
      })
    ).toBe(true);
    expect(
      captureTargetFramesAreStable(target, {
        ...target,
        frame: { ...target.frame, y: 708 }
      })
    ).toBe(false);
  });
});
