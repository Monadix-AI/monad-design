import type { ClientApi } from '@monaddesign/client-rtk/client-api';
import type { ActiveConnection } from '../desktop-model';
import type { AgentSessionSnapshot, AgentTurnContext, AXElement, AXSnapshot, IOSSimulator } from '../electron';

import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import { buildAgentTurnContext, serializeAgentTurn } from '@monaddesign/simulator';
import { useState } from 'react';

interface AgentRequestControllerOptions {
  activeSession: AgentSessionSnapshot | null;
  agentRequest: string;
  connected?: IOSSimulator;
  connection: ActiveConnection | null;
  runtimeClient: ClientApi | null;
  selectedElement?: AXElement;
  snapshot: AXSnapshot | null;
  onCopyStatusChanged: (status: 'copied' | 'error') => void;
  onRequestChanged: (request: string) => void;
  onSessionChanged: (session: AgentSessionSnapshot) => void;
  onSnapshotChanged: (snapshot: AXSnapshot) => void;
}

export const useAgentRequestController = ({
  activeSession,
  agentRequest,
  connected,
  connection,
  runtimeClient,
  selectedElement,
  snapshot,
  onCopyStatusChanged,
  onRequestChanged,
  onSessionChanged,
  onSnapshotChanged
}: AgentRequestControllerOptions) => {
  const [isSendingAgentRequest, setIsSendingAgentRequest] = useState(false);
  const [variantCount, setVariantCount] = useState(1);
  const [agentSessionError, setAgentSessionError] = useState<string | null>(null);
  const bundleIdentifier = connection?.bundleIdentifier ?? activeSession?.connection?.bundleIdentifier;
  const agentTurnContext =
    connected && bundleIdentifier
      ? buildAgentTurnContext({
          bundleIdentifier,
          element: selectedElement,
          snapshot: snapshot ?? undefined,
          simulator: connected
        })
      : null;
  const agentTurnPayload =
    agentTurnContext && agentRequest.trim() ? serializeAgentTurn(agentRequest, agentTurnContext) : '';

  const copyAgentTurnPayload = async () => {
    if (!agentTurnPayload) return;
    try {
      await navigator.clipboard.writeText(agentTurnPayload);
      onCopyStatusChanged('copied');
    } catch {
      onCopyStatusChanged('error');
    }
  };

  const submitAgentTurn = async ({
    annotationScreenshot,
    context,
    request,
    rethrow = false,
    session
  }: {
    annotationScreenshot?: string;
    context: () => AgentTurnContext | Promise<AgentTurnContext>;
    request: string;
    rethrow?: boolean;
    session: AgentSessionSnapshot;
  }) => {
    if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      const next = await runtimeClient.submitAgentRequest(session.id, {
        request,
        variantCount,
        context: await context(),
        ...(annotationScreenshot ? { annotationScreenshot } : {})
      });
      onSessionChanged(next);
      onRequestChanged('');
      setVariantCount(1);
    } catch (sessionError) {
      const message = errorMessage(sessionError);
      setAgentSessionError(message);
      if (rethrow) throw new Error(message);
    } finally {
      setIsSendingAgentRequest(false);
    }
  };

  const sendAgentRequest = async () => {
    if (activeSession?.status !== 'awaiting_request' || !agentRequest.trim() || !agentTurnContext || !runtimeClient) {
      return;
    }
    await submitAgentTurn({
      session: activeSession,
      request: agentRequest,
      context: async () => {
        if (selectedElement) return agentTurnContext;
        if (!connected) throw new Error('The current Simulator screen is not available.');
        const currentSnapshot = await runtimeClient.accessibility();
        onSnapshotChanged(currentSnapshot);
        return buildAgentTurnContext({
          bundleIdentifier: agentTurnContext.simulator.bundleIdentifier,
          snapshot: currentSnapshot,
          simulator: connected
        });
      }
    });
  };

  const sendAnnotatedAgentRequest = async (annotationScreenshot: string) => {
    const session = activeSession;
    if (session?.status !== 'awaiting_request' || !session.connection || !connected || !runtimeClient) {
      throw new Error('Start Live and wait until the agent is ready before finishing the annotation.');
    }
    const currentSnapshot = await runtimeClient.accessibility();
    onSnapshotChanged(currentSnapshot);
    await submitAgentTurn({
      annotationScreenshot,
      session,
      rethrow: true,
      request: agentRequest.trim() || 'Implement the changes shown in the attached annotated screenshot.',
      context: () =>
        buildAgentTurnContext({
          bundleIdentifier: session.connection?.bundleIdentifier ?? '',
          snapshot: currentSnapshot,
          simulator: connected
        })
    });
  };

  return {
    agentSessionError,
    agentTurnPayload,
    copyAgentTurnPayload,
    isSendingAgentRequest,
    sendAgentRequest,
    sendAnnotatedAgentRequest,
    setAgentSessionError,
    setVariantCount,
    variantCount
  };
};
