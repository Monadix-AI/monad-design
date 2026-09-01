import type { AgentSessionSnapshot, SimulatorConnectionResponse } from '@monaddesign/client-contract';
import type { ClientApi } from '@monaddesign/client-rtk/client-api';

import { agentSessionNeedsConnection, nextAgentSession } from '@monaddesign/client-contract/live-session';
import { useEffect, useState } from 'react';

export const useLiveAgentSession = (api: ClientApi, connection: SimulatorConnectionResponse) => {
  const [session, setSession] = useState<AgentSessionSnapshot | null>(null);
  const { bundleIdentifier, projectId, udid } = connection;

  useEffect(() => {
    let cancelled = false;
    let connecting = false;
    const refresh = async () => {
      try {
        let { session: incoming } = await api.activeAgentSession();
        const activeConnection = { bundleIdentifier, projectId, udid };
        if (agentSessionNeedsConnection(incoming, activeConnection) && !connecting) {
          connecting = true;
          incoming = await api.connectAgentSession(incoming.id, {
            udid,
            bundleIdentifier
          });
          connecting = false;
        }
        if (!cancelled) setSession((current) => nextAgentSession(current, incoming));
      } catch {
        connecting = false;
        if (!cancelled) setSession((current) => (current ? null : current));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1_200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, bundleIdentifier, projectId, udid]);

  return [session, setSession] as const;
};
