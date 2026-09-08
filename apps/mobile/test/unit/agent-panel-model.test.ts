import { expect, test } from 'bun:test';

import { agentSessionForProject } from '../../src/agent-panel-model';

test('another project working cannot hide this workspace toolbar or open its variants', () => {
  for (const status of ['working', 'variants_ready', 'selection_confirmed']) {
    const session = { project: { id: 'other' }, status };
    expect(agentSessionForProject(session, 'current')).toBeNull();
    expect(agentSessionForProject(session, 'other')).toBe(session);
  }
  expect(agentSessionForProject(null, 'current')).toBeNull();
});
