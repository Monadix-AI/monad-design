import { afterEach, describe, expect, test } from 'bun:test';

import { initialWorkspaceState, workspaceStore } from '../../src/workspace-store';

afterEach(() => workspaceStore.getState().resetWorkspaceState());

describe('workspace store', () => {
  test('keeps the shared workspace defaults platform-neutral', () => {
    expect(workspaceStore.getState()).toMatchObject(initialWorkspaceState);
  });

  test('preserves handoff text when the runtime selection changes', () => {
    const store = workspaceStore.getState();
    store.setSelectedElementPath('0.1');
    store.setAgentRequest('Make this action clearer');
    store.setCopyStatus('copied');

    workspaceStore.getState().setSelectedElementPath('0.2');

    expect(workspaceStore.getState()).toMatchObject({
      selectedElementPath: '0.2',
      agentRequest: 'Make this action clearer',
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

  test('preserves selection and written request when switching to annotation', () => {
    const store = workspaceStore.getState();
    store.setSelectionMode(true);
    store.setSelectedElementPath('0.1');
    store.setAgentRequest('Move this control');
    store.setSelectionMode(false);

    expect(workspaceStore.getState()).toMatchObject({
      selectionMode: false,
      selectedElementPath: '0.1',
      agentRequest: 'Move this control'
    });
    store.setSelectedElementPath(null);
    expect(workspaceStore.getState().agentRequest).toBe('Move this control');
    store.resetWorkspaceState();
    expect(workspaceStore.getState()).toMatchObject(initialWorkspaceState);
  });
});
