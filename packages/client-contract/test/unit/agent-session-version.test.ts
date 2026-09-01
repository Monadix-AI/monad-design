import { describe, expect, test } from 'bun:test';

import { agentSessionVersion } from '../../src/agent-session-version';

describe('agent session version', () => {
  test('distinguishes sessions that have the same revision', () => {
    expect(agentSessionVersion({ id: 'session-a', revision: 1 })).not.toBe(
      agentSessionVersion({ id: 'session-b', revision: 1 })
    );
  });

  test('distinguishes revisions within one session and represents no active session', () => {
    expect(agentSessionVersion({ id: 'session-a', revision: 1 })).not.toBe(
      agentSessionVersion({ id: 'session-a', revision: 2 })
    );
    expect(agentSessionVersion(null)).toBeNull();
  });
});
