import type { AgentSessionSnapshot, IOSSimulator } from '@monaddesign/client-contract';
import type { ClientApi } from '@monaddesign/client-rtk/client-api';

import { nextAgentSession } from '@monaddesign/client-contract/live-session';
import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useCoreLiveSession = (client: ClientApi, onError: (message: string) => void) => {
  const [session, setSession] = useState<AgentSessionSnapshot | null>(null);
  const [simulators, setSimulators] = useState<IOSSimulator[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const currentSimulatorsVersion = useRef('');

  const refresh = useCallback(async () => {
    try {
      const response = await client.activeAgentSession();
      setSession((current) => nextAgentSession(current, response.session));
      if (response.session) {
        const nextSimulators = await client.simulators();
        const nextSimulatorsVersion = JSON.stringify(nextSimulators);
        if (nextSimulatorsVersion !== currentSimulatorsVersion.current) {
          currentSimulatorsVersion.current = nextSimulatorsVersion;
          setSimulators(nextSimulators);
        }
        setIsScanning(false);
      }
    } catch (error) {
      onError(errorMessage(error));
    }
  }, [client, onError]);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    const poll = async () => {
      await refresh();
      if (!cancelled) timeout = window.setTimeout(() => void poll(), 800);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [refresh]);

  return { isScanning, refreshSession: refresh, session, setSession, simulators };
};
