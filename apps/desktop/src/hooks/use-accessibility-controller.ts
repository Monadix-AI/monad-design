import type { ClientApi } from '@monaddesign/client-rtk/client-api';
import type { ActiveConnection } from '../desktop-model';
import type { AXSnapshot } from '../electron';

import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import { workspaceStore } from '@monaddesign/state/workspace-store';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

export const useAccessibilityController = ({
  connection,
  isOpen,
  runtimeClient
}: {
  connection: ActiveConnection | null;
  isOpen: boolean;
  runtimeClient: ClientApi | null;
}) => {
  const [snapshot, setSnapshot] = useState<AXSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedPath = useStore(workspaceStore, (state) => state.selectedElementPath);
  const setSelectedPath = useStore(workspaceStore, (state) => state.setSelectedElementPath);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const selectedElement = useMemo(
    () => snapshot?.elements.find(({ path }) => path === selectedPath),
    [selectedPath, snapshot]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: The connection is the reset trigger.
  useEffect(() => {
    setSnapshot(null);
    setError(null);
    setSelectedPath(null);
    setHoveredPath(null);
  }, [connection, setSelectedPath]);

  useEffect(() => {
    if (!connection || !isOpen || !runtimeClient) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await runtimeClient.accessibility();
        if (cancelled) return;
        setSnapshot(next);
        setError(next.errors?.[0] ?? null);
        setSelectedPath((current) => (current && next.elements.some(({ path }) => path === current) ? current : null));
      } catch (snapshotError) {
        if (!cancelled) setError(errorMessage(snapshotError));
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [connection, isOpen, runtimeClient, setSelectedPath]);

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
};
