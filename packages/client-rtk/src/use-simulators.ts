import type { IOSSimulator } from '@monaddesign/client-contract';
import type { ClientApi } from './client-api';

import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from './endpoint-helpers';
import { startPolling } from './polling';

export interface UseSimulatorsOptions {
  autoScan?: boolean;
  client: ClientApi | null;
  enabled?: boolean;
  onError?: (message: string) => void;
  pollIntervalMs?: number | false;
  pauseWhenHidden?: boolean;
}

export function useSimulators({
  autoScan = false,
  client,
  enabled = true,
  onError,
  pollIntervalMs = false,
  pauseWhenHidden = false
}: UseSimulatorsOptions) {
  const [simulators, setSimulators] = useState<IOSSimulator[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const requestGeneration = useRef(0);
  const simulatorsVersion = useRef('');

  const scan = useCallback(async () => {
    if (!client) return [];
    const generation = ++requestGeneration.current;
    setIsScanning(true);
    try {
      const next = await client.simulators();
      const version = JSON.stringify(next);
      if (generation === requestGeneration.current && version !== simulatorsVersion.current) {
        simulatorsVersion.current = version;
        setSimulators(next);
      }
      return next;
    } catch (error) {
      if (generation === requestGeneration.current) onError?.(errorMessage(error));
      return [];
    } finally {
      if (generation === requestGeneration.current) setIsScanning(false);
    }
  }, [client, onError]);

  useEffect(() => {
    requestGeneration.current += 1;
    if (!client) {
      simulatorsVersion.current = '';
      setSimulators([]);
      setIsScanning(false);
    }
  }, [client]);

  useEffect(() => {
    if (!enabled) {
      requestGeneration.current += 1;
      simulatorsVersion.current = '';
      setSimulators([]);
      setIsScanning(false);
    }
  }, [enabled]);

  useEffect(
    () => () => {
      requestGeneration.current += 1;
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;
    if (!autoScan) return;
    const stopPolling = startPolling(scan, {
      intervalMs: pollIntervalMs,
      visibility: pauseWhenHidden && typeof document !== 'undefined' ? document : undefined
    });
    return () => {
      requestGeneration.current += 1;
      stopPolling();
    };
  }, [autoScan, enabled, pauseWhenHidden, pollIntervalMs, scan]);

  return { isScanning, scan, simulators };
}
