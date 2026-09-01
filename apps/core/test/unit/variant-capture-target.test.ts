import type { AccessibilityElement, AccessibilitySnapshot } from '@monaddesign/simulator';

import { describe, expect, test } from 'bun:test';

import {
  captureTargetFramesAreStable,
  captureTargetFromContext,
  captureTargetFromSelection,
  captureTargetIsVisible,
  findCaptureTarget
} from '../../ui/src/variant-capture-target';

const element = (input: Partial<AccessibilityElement> = {}): AccessibilityElement => ({
  id: 'message-42',
  path: '0.1.2',
  label: 'Unread message',
  value: '',
  role: 'button',
  type: 'Button',
  enabled: true,
  isContainer: false,
  frame: { x: 20, y: 300, width: 160, height: 44 },
  ...input
});

const snapshot = (elements: AccessibilityElement[]): AccessibilitySnapshot => ({
  screen: { width: 390, height: 844 },
  elements
});

describe('Core variant capture target', () => {
  test('restores the persisted selection summary into an accessibility target', () => {
    expect(
      captureTargetFromSelection({
        selectedElement: {
          accessibilityId: 'message-42',
          path: '0.1.2',
          label: 'Unread message',
          role: 'button',
          type: 'Button',
          enabled: true,
          container: false,
          frame: { x: 20, y: 300, width: 160, height: 44 }
        }
      })
    ).toEqual(element());
  });

  test('uses a stable visible page anchor when the request has no explicit selection', () => {
    expect(
      captureTargetFromContext({
        currentScreen: {
          screen: { width: 390, height: 844 },
          elements: [
            {
              accessibilityId: 'navigation-title',
              path: '0.1',
              label: 'Messages',
              role: 'header',
              type: 'StaticText',
              enabled: true,
              container: false,
              frame: { x: 20, y: 60, width: 160, height: 44 }
            },
            {
              accessibilityId: 'message-42',
              path: '0.4.2',
              label: 'Unread message',
              role: 'button',
              type: 'Button',
              enabled: true,
              container: false,
              frame: { x: 20, y: 400, width: 160, height: 44 }
            }
          ]
        }
      })
    ).toEqual(element({ path: '0.4.2', frame: { x: 20, y: 400, width: 160, height: 44 } }));
  });

  test('prefers a stable id and falls back to semantic identity', () => {
    const target = element();
    const exact = element({ path: '9.9', frame: { x: 20, y: 302, width: 160, height: 44 } });
    expect(findCaptureTarget(snapshot([element({ id: 'other' }), exact]), target)).toBe(exact);

    const semantic = element({ id: 'runtime-path', path: '7.4' });
    expect(findCaptureTarget(snapshot([semantic]), element({ id: '0.1.2' }))).toBe(semantic);
  });

  test('requires the target to be visible and settled', () => {
    const target = element();
    expect(captureTargetIsVisible(snapshot([target]), target)).toBe(true);
    expect(captureTargetIsVisible(snapshot([]), element({ frame: { x: 20, y: 830, width: 160, height: 44 } }))).toBe(
      false
    );
    expect(captureTargetFramesAreStable(target, element({ frame: { x: 21, y: 300, width: 160, height: 44 } }))).toBe(
      true
    );
    expect(captureTargetFramesAreStable(target, element({ frame: { x: 24, y: 300, width: 160, height: 44 } }))).toBe(
      false
    );
  });
});
