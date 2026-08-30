import type { AXSnapshot } from '../../src/types';

import { describe, expect, test } from 'bun:test';

import {
  axElementAtPoint,
  buildAgentTurnContext,
  encodeFrame,
  rotatedOrientation,
  simulatorPoint
} from '../../src/protocol';

describe('Simulator input protocol', () => {
  test('rotates normalized input into Simulator coordinates', () => {
    expect(simulatorPoint({ x: 0.2, y: 0.7 }, 'portrait')).toEqual({
      x: 0.2,
      y: 0.7
    });
    expect(simulatorPoint({ x: 0.2, y: 0.7 }, 'landscape_left')).toEqual({
      x: 0.7,
      y: 0.8
    });
    const right = simulatorPoint({ x: 0.2, y: 0.7 }, 'landscape_right');
    expect(right.x).toBeCloseTo(0.3);
    expect(right.y).toBeCloseTo(0.2);
  });

  test('cycles in the direction shown by the rotate controls', () => {
    expect(rotatedOrientation('portrait', 'left')).toBe('landscape_right');
    expect(rotatedOrientation('landscape_right', 'left')).toBe('portrait_upside_down');
    expect(rotatedOrientation('portrait_upside_down', 'left')).toBe('landscape_left');
    expect(rotatedOrientation('landscape_left', 'left')).toBe('portrait');

    expect(rotatedOrientation('portrait', 'right')).toBe('landscape_left');
    expect(rotatedOrientation('landscape_left', 'right')).toBe('portrait_upside_down');
    expect(rotatedOrientation('portrait_upside_down', 'right')).toBe('landscape_right');
    expect(rotatedOrientation('landscape_right', 'right')).toBe('portrait');
  });

  test('encodes the serve-sim one-byte tagged frame', () => {
    const frame = new Uint8Array(encodeFrame(0x04, { button: 'home' }));
    expect(frame[0]).toBe(0x04);
    expect(new TextDecoder().decode(frame.subarray(1))).toBe('{"button":"home"}');
  });
});

describe('Accessibility hit testing', () => {
  test('chooses the smallest element under a point', () => {
    const snapshot: AXSnapshot = {
      screen: { width: 100, height: 200 },
      elements: [
        {
          id: 'root',
          path: '0',
          label: '',
          value: '',
          role: 'screen',
          type: 'Screen',
          enabled: true,
          isContainer: true,
          frame: { x: 0, y: 0, width: 100, height: 200 }
        },
        {
          id: 'button',
          path: '0.0',
          label: 'Save',
          value: '',
          role: 'button',
          type: 'Button',
          enabled: true,
          isContainer: false,
          frame: { x: 20, y: 40, width: 30, height: 20 }
        }
      ]
    };
    expect(axElementAtPoint(snapshot, { x: 0.3, y: 0.25 })?.id).toBe('button');
  });

  test('builds either selected-element or whole-screen agent evidence', () => {
    const snapshot: AXSnapshot = {
      screen: { width: 100, height: 200 },
      elements: [
        {
          id: 'title',
          path: '0',
          label: 'Profile',
          value: '',
          role: 'heading',
          type: 'StaticText',
          enabled: true,
          isContainer: false,
          frame: { x: 10, y: 20, width: 80, height: 30 }
        }
      ],
      errors: ['Partial accessibility tree']
    };
    const simulator = { udid: 'sim-1', name: 'iPad Pro', runtime: 'iOS 26', state: 'Booted' as const, connected: true };
    const screen = buildAgentTurnContext({ bundleIdentifier: 'com.example', snapshot, simulator });
    expect(screen.currentScreen?.elements).toHaveLength(1);
    expect(screen.currentScreen?.accessibilityErrors).toEqual(['Partial accessibility tree']);

    const selection = buildAgentTurnContext({
      bundleIdentifier: 'com.example',
      element: snapshot.elements[0],
      snapshot,
      simulator
    });
    expect(selection.selection?.selectedElement).toMatchObject({ name: 'Profile', path: '0' });
    expect(selection.currentScreen).toBeUndefined();
  });
});
