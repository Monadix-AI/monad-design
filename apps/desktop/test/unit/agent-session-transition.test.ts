import type { AgentSessionSnapshot } from '../../src/electron';

import { describe, expect, test } from 'bun:test';

import { agentSessionTransition } from '../../src/lib/agent-session-transition';

const session = (status: AgentSessionSnapshot['status']): AgentSessionSnapshot => ({
  id: 'session-1',
  project: { id: 'project-1', name: 'Example', lastOpenedAt: '2026-09-01T00:00:00.000Z', targetApps: [] },
  status,
  revision: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z'
});

describe('desktop agent session transitions', () => {
  test('clears session-owned work when no live session remains', () => {
    expect(agentSessionTransition(null)).toEqual({
      activeSession: null,
      closeVariantPreview: false,
      pendingAutoCapture: null,
      resetVariantPreview: false,
      shouldOpenProject: false
    });
    expect(agentSessionTransition(session('closed'))).toMatchObject({
      activeSession: null,
      pendingAutoCapture: null
    });
  });

  test('derives capture, selection, completion, and project actions from the session state', () => {
    const variantsReady = {
      ...session('variants_ready'),
      changeRequest: {
        id: 'request-1',
        request: 'Polish the screen',
        variantCount: 3,
        context: { simulator: { udid: 'simulator-1', bundleIdentifier: 'com.example.app' } },
        createdAt: '2026-09-01T00:00:00.000Z'
      }
    };
    expect(agentSessionTransition(variantsReady).pendingAutoCapture).toEqual({ requestId: 'request-1', count: 3 });
    expect(agentSessionTransition(session('selection_confirmed')).closeVariantPreview).toBe(true);
    expect(
      agentSessionTransition({
        ...session('awaiting_request'),
        lastResult: {
          requestId: 'request-1',
          summary: 'Done',
          completedAt: '2026-09-01T00:00:00.000Z'
        }
      }).resetVariantPreview
    ).toBe(true);
    expect(agentSessionTransition(session('selecting_simulator')).shouldOpenProject).toBe(true);
  });
});
