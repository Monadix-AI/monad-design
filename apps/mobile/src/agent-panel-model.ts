import type { AgentSessionSnapshot } from '@monaddesign/client-contract';

export const agentPanelStatus = (session: AgentSessionSnapshot | null) => {
  if (!session) return 'No responsive agent';
  if (session.status === 'awaiting_request') return 'Agent connected · ready';
  if (session.status === 'change_requested') return 'Request sent';
  if (session.status === 'working') return 'Agent is applying changes';
  if (session.status === 'variants_ready') return 'Variants ready for review';
  if (session.status === 'selection_confirmed') return 'Selection sent · agent is finalizing';
  return 'Agent session active';
};
