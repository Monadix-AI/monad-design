import type { AgentSessionSnapshot, SimulatorConnectionResponse } from './index';

import { agentSessionVersion } from './agent-session-version';

export interface AgentSessionTransition {
  activeSession: AgentSessionSnapshot | null;
  closeVariantPreview: boolean;
  pendingAutoCapture?: { requestId: string; count: number } | null;
  resetVariantPreview: boolean;
  shouldOpenProject: boolean;
}

export const normalizeAgentSession = (session: AgentSessionSnapshot | null) =>
  session?.status === 'closed' ? null : session;

export const nextAgentSession = (
  current: AgentSessionSnapshot | null,
  incoming: AgentSessionSnapshot | null
): AgentSessionSnapshot | null => {
  const next = normalizeAgentSession(incoming);
  return agentSessionVersion(current) === agentSessionVersion(next) ? current : next;
};

export const agentSessionTransition = (session: AgentSessionSnapshot | null): AgentSessionTransition => ({
  activeSession: normalizeAgentSession(session),
  closeVariantPreview: session?.status === 'selection_confirmed',
  ...(session?.status === 'variants_ready' && session.changeRequest
    ? {
        pendingAutoCapture: {
          requestId: session.changeRequest.id,
          count: session.changeRequest.variantCount
        }
      }
    : session === null || session.status === 'closed'
      ? { pendingAutoCapture: null }
      : {}),
  resetVariantPreview: session?.status === 'awaiting_request' && Boolean(session.lastResult),
  shouldOpenProject: session?.status === 'selecting_simulator'
});

export const agentSessionNeedsConnection = (
  session: AgentSessionSnapshot | null,
  connection: Pick<SimulatorConnectionResponse, 'bundleIdentifier' | 'projectId' | 'udid'>
): session is AgentSessionSnapshot & { status: 'selecting_simulator' } =>
  session?.status === 'selecting_simulator' &&
  session.project.id === connection.projectId &&
  session.project.targetApps.some(({ bundleIdentifier }) => bundleIdentifier === connection.bundleIdentifier);
