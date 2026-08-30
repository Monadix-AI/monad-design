import type { AXElement, AXSnapshot } from '../../src/electron';

import { describe, expect, test } from 'bun:test';

import { buildAgentTurnContext, serializeAgentTurn } from '../../src/agent-turn-context';

const selected: AXElement = {
  id: 'message-title',
  path: '0.1.2',
  label: 'Conversation title',
  value: '',
  role: 'heading',
  type: 'StaticText',
  enabled: true,
  isContainer: false,
  frame: { x: 24, y: 80, width: 180, height: 28 }
};

const snapshot: AXSnapshot = {
  screen: { width: 390, height: 844 },
  elements: [
    { ...selected, id: 'screen', path: '0', label: 'Conversation', role: 'screen', isContainer: true },
    { ...selected, id: 'header', path: '0.1', label: 'Header', role: 'group', isContainer: true },
    selected,
    { ...selected, id: 'status', path: '0.1.3', label: 'Online', role: 'text' },
    { ...selected, id: 'unrelated', path: '0.8.1' }
  ]
};

describe('agent turn context', () => {
  test('contains only the request and turn-local runtime evidence', () => {
    const context = buildAgentTurnContext({
      bundleIdentifier: 'com.example.app',
      element: selected,
      snapshot,
      simulator: { udid: 'SIMULATOR', name: 'iPhone 17 Pro', runtime: 'iOS 26.5' }
    });
    const payload = serializeAgentTurn('Give the title stronger hierarchy.', context);

    expect(payload).toContain('Give the title stronger hierarchy.');
    expect(payload).toContain('"accessibilityId": "message-title"');
    expect(payload).toContain('"accessibilityId": "status"');
    expect(payload).not.toContain('"accessibilityId": "unrelated"');
    expect(payload).not.toContain('Required implementation');
    expect(payload).not.toContain('-MonadDesignVariant');
  });

  test('allows a request without an element selection', () => {
    const context = buildAgentTurnContext({
      bundleIdentifier: 'com.example.app',
      simulator: { udid: 'SIMULATOR', name: 'iPhone 17 Pro', runtime: 'iOS 26.5' }
    });

    expect(context.selection).toBeUndefined();
    expect(context.simulator.bundleIdentifier).toBe('com.example.app');
  });

  test('attaches the current screen when no element is selected', () => {
    const context = buildAgentTurnContext({
      bundleIdentifier: 'com.example.app',
      snapshot: { ...snapshot, errors: ['A partial accessibility tree was returned.'] },
      simulator: { udid: 'SIMULATOR', name: 'iPhone 17 Pro', runtime: 'iOS 26.5' }
    });

    expect(context.selection).toBeUndefined();
    expect(context.currentScreen?.screen).toEqual({ width: 390, height: 844 });
    expect(context.currentScreen?.elements).toHaveLength(snapshot.elements.length);
    expect(context.currentScreen?.elements[2]).toMatchObject({
      accessibilityId: 'message-title',
      label: 'Conversation title',
      frame: selected.frame
    });
    expect(context.currentScreen?.accessibilityErrors).toEqual(['A partial accessibility tree was returned.']);
  });
});
