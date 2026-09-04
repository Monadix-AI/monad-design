import type { AccessibilitySnapshotResponse } from '@monaddesign/client-contract';
import type { ClientApi } from './client-api';

import { useEffect, useMemo, useState } from 'react';

import { errorMessage } from './endpoint-helpers';

export type AccessibilityPathSetter = (next: string | null | ((current: string | null) => string | null)) => void;

export interface UseAccessibilityOptions {
  client: ClientApi | null;
  connectionKey: string | null;
  isOpen: boolean;
  pollIntervalMs?: number;
  selectedPath: string | null;
  setSelectedPath: AccessibilityPathSetter;
}

export function useAccessibility({
  client,
  connectionKey,
  isOpen,
  pollIntervalMs = 1_000,
  selectedPath,
  setSelectedPath
}: UseAccessibilityOptions) {
  const [snapshot, setSnapshot] = useState<AccessibilitySnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const selectedElement = useMemo(
    () => snapshot?.elements.find(({ path }) => path === selectedPath),
    [selectedPath, snapshot]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: The connection key is the reset trigger.
  useEffect(() => {
    setSnapshot(null);
    setError(null);
    setSelectedPath(null);
    setHoveredPath(null);
  }, [connectionKey, setSelectedPath]);

  useEffect(() => {
    if (isOpen) return;
    setHoveredPath(null);
  }, [isOpen]);

  useEffect(() => {
    if (!client || !connectionKey || !isOpen) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await client.accessibility();
        if (cancelled) return;
        setSnapshot(next);
        setError(next.errors?.[0] ?? null);
        setSelectedPath((current) => (current && next.elements.some(({ path }) => path === current) ? current : null));
      } catch (snapshotError) {
        if (!cancelled) setError(errorMessage(snapshotError));
      } finally {
        if (!cancelled) timer = setTimeout(poll, pollIntervalMs);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [client, connectionKey, isOpen, pollIntervalMs, setSelectedPath]);

  return {
    error,
    hoveredPath,
    selectedElement,
    selectedPath,
    setHoveredPath,
    setSelectedPath,
    setSnapshot,
    snapshot
  };
}
