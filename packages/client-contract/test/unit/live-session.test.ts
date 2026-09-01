import type { AgentSessionSnapshot, SimulatorConnectionResponse } from '../../src';

import { describe, expect, test } from 'bun:test';

import {
  agentSessionNeedsConnection,
  agentSessionTransition,
  nextAgentSession,
  normalizeAgentSession
} from '../../src/live-session';

const session = (status: AgentSessionSnapshot['status'], revision = 1): AgentSessionSnapshot => ({
  id: 'session-1',
  project: {
    id: 'project-1',
    name: 'Example',
    lastOpenedAt: '2026-09-01T00:00:00.000Z',
    targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example' }]
  },
  status,
  revision,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z'
});

const connection: SimulatorConnectionResponse = {
  projectId: 'project-1',
  udid: 'simulator-1',
  bundleIdentifier: 'com.example.app',
  streamPath: '/v1/simulator/stream',
  inputPath: '/v1/simulator/input'
};

describe('live session workflow', () => {
  test('normalizes closed sessions and preserves identity for duplicate revisions', () => {
    const current = session('awaiting_request');
    expect(normalizeAgentSession(session('closed'))).toBeNull();
    expect(nextAgentSession(current, { ...current })).toBe(current);
    expect(nextAgentSession(current, session('awaiting_request', 2))).not.toBe(current);
  });

  test('derives connection and UI transitions from protocol state', () => {
    expect(agentSessionNeedsConnection(session('selecting_simulator'), connection)).toBe(true);
    expect(agentSessionNeedsConnection(session('working'), connection)).toBe(false);
    expect(agentSessionTransition(session('selection_confirmed')).closeVariantPreview).toBe(true);
  });
});
