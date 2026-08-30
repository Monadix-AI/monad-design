import type { AgentSessionSnapshot } from '@monaddesign/client-rtk';

import { describe, expect, test } from 'bun:test';

import { agentPanelStatus } from '../../src/agent-panel-model';

const session = (status: AgentSessionSnapshot['status']): AgentSessionSnapshot => ({
  id: 'session-1',
  project: { id: 'project-1', name: 'Example', lastOpenedAt: '2026-08-28T00:00:00.000Z', targetApps: [] },
  status,
  revision: 1,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z'
});

describe('agent request panel states', () => {
  test('uses the same state language as the desktop request workbench', () => {
    expect(agentPanelStatus(null)).toBe('No responsive agent');
    expect(agentPanelStatus(session('awaiting_request'))).toBe('Agent connected · ready');
    expect(agentPanelStatus(session('change_requested'))).toBe('Request sent');
    expect(agentPanelStatus(session('working'))).toBe('Agent is applying changes');
    expect(agentPanelStatus(session('variants_ready'))).toBe('Variants ready for review');
    expect(agentPanelStatus(session('selection_confirmed'))).toBe('Selection sent · agent is finalizing');
  });
});
