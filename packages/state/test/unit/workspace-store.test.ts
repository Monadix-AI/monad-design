import { afterEach, describe, expect, test } from 'bun:test';

import { initialWorkspaceState, workspaceStore } from '../../src/workspace-store';

afterEach(() => workspaceStore.getState().resetWorkspaceState());

describe('workspace store', () => {
  test('keeps the shared workspace defaults platform-neutral', () => {
    expect(workspaceStore.getState()).toMatchObject(initialWorkspaceState);
  });

  test('clears handoff text when the runtime selection changes', () => {
    const store = workspaceStore.getState();
    store.setSelectedElementPath('0.1');
    store.setAgentRequest('Make this action clearer');
    store.setCopyStatus('copied');

    workspaceStore.getState().setSelectedElementPath('0.2');

    expect(workspaceStore.getState()).toMatchObject({
      selectedElementPath: '0.2',
      agentRequest: '',
      copyStatus: 'idle'
    });
  });

  test('resets copy feedback when the request changes', () => {
    workspaceStore.getState().setCopyStatus('error');
    workspaceStore.getState().setAgentRequest('Try another layout');

    expect(workspaceStore.getState()).toMatchObject({
      agentRequest: 'Try another layout',
      copyStatus: 'idle'
    });
  });

  test('clears selection state when leaving selection mode', () => {
    const store = workspaceStore.getState();
    store.setSelectionMode(true);
    store.setSelectedElementPath('0.1');
    store.setAgentRequest('Move this control');
    store.setSelectionMode(false);

    expect(workspaceStore.getState()).toMatchObject(initialWorkspaceState);
  });
});
