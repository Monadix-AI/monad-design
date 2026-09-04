import type { AgentSessionSnapshot } from '@monaddesign/client-contract';
import type { ClientApi } from './client-api';

import { nextAgentSession } from '@monaddesign/client-contract/live-session';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from './endpoint-helpers';

export interface UseLiveSessionOptions {
  client: ClientApi | null;
  onError?: (message: string) => void;
  pollIntervalMs?: number | false;
  subscribe?: (listener: (session: AgentSessionSnapshot | null) => void) => (() => void) | undefined;
}

export function useLiveSession({ client, onError, pollIntervalMs = false, subscribe }: UseLiveSessionOptions) {
  const [session, setSessionState] = useState<AgentSessionSnapshot | null>(null);
  const [isEndingLive, setIsEndingLive] = useState(false);
  const isEndingLiveRef = useRef(false);
  const requestGeneration = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const setSession = useCallback((incoming: AgentSessionSnapshot | null) => {
    setSessionState((current) => nextAgentSession(current, incoming));
  }, []);

  const refresh = useCallback(async () => {
    if (!client || isEndingLiveRef.current) return null;
    const generation = ++requestGeneration.current;
    try {
      const response = await client.activeAgentSession();
      if (generation === requestGeneration.current) setSession(response.session);
      return response.session;
    } catch (error) {
      if (generation === requestGeneration.current) onError?.(errorMessage(error));
      return null;
    }
  }, [client, onError, setSession]);

  useEffect(() => {
    if (!client) {
      setSession(null);
      return;
    }
    let cancelled = false;
    const unsubscribe = subscribe?.((next) => {
      if (!cancelled && !isEndingLiveRef.current) setSession(next);
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await refresh();
      if (!cancelled && pollIntervalMs !== false) timeout = setTimeout(() => void poll(), pollIntervalMs);
    };
    void poll();
    return () => {
      cancelled = true;
      requestGeneration.current += 1;
      if (timeout !== undefined) clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [client, pollIntervalMs, refresh, setSession, subscribe]);

  const endLive = useCallback(async () => {
    const current = sessionRef.current;
    if (!client || !current || isEndingLiveRef.current) return;
    const generation = ++requestGeneration.current;
    isEndingLiveRef.current = true;
    setIsEndingLive(true);
    try {
      const closed = await client.closeAgentSession(current.id);
      if (generation === requestGeneration.current) setSession(closed);
    } catch (error) {
      if (generation === requestGeneration.current) onError?.(errorMessage(error));
    } finally {
      isEndingLiveRef.current = false;
      setIsEndingLive(false);
    }
  }, [client, onError, setSession]);

  return { endLive, isEndingLive, refresh, session, setSession };
}
