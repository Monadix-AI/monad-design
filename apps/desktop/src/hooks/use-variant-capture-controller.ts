import type { ClientApi } from '@monaddesign/client-rtk/client-api';
import type { ActiveConnection, VariantCapture } from '../desktop-model';
import type { AgentSessionSnapshot, AXElement } from '../electron';

import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import {
  type SimulatorOrientation,
  type SimulatorVariantId,
  simulatorVariantIds,
  simulatorVariantIdsForCount
} from '@monaddesign/simulator';
import { useCallback, useEffect, useState } from 'react';

import { captureStableSimulatorScreen } from '../lib/variant-capture';
import { createVariantOperationGate } from '../lib/variant-operation-gate';

export type VariantTransition = 'opening' | 'restoring' | 'confirming' | 'discarding' | null;

interface VariantCaptureControllerOptions {
  activeAgentSession: AgentSessionSnapshot | null;
  connection: ActiveConnection | null;
  onError: (message: string) => void;
  onSessionChanged: (session: AgentSessionSnapshot) => void;
  orientation: SimulatorOrientation;
  runtimeClient: ClientApi | null;
  selectedElement?: AXElement;
}

export const useVariantCaptureController = ({
  activeAgentSession,
  connection,
  onError,
  onSessionChanged,
  orientation,
  runtimeClient,
  selectedElement
}: VariantCaptureControllerOptions) => {
  const [variantCaptures, setVariantCaptures] = useState<VariantCapture[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SimulatorVariantId | null>(null);
  const [capturingVariant, setCapturingVariant] = useState<SimulatorVariantId | null>(null);
  const [isVariantPreviewOpen, setIsVariantPreviewOpen] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [activePreviewVariant, setActivePreviewVariant] = useState<SimulatorVariantId | null>(null);
  const [variantTransition, setVariantTransition] = useState<VariantTransition>(null);
  const [pendingAutoCapture, setPendingAutoCapture] = useState<{ requestId: string; count: number } | null>(null);
  const [operationGate] = useState(createVariantOperationGate);

  const resetVariantPreview = useCallback(() => {
    operationGate.reset();
    setPendingAutoCapture(null);
    setVariantCaptures([]);
    setSelectedVariant(null);
    setCapturingVariant(null);
    setIsVariantPreviewOpen(false);
    setVariantError(null);
    setActivePreviewVariant(null);
    setVariantTransition(null);
  }, [operationGate]);

  const captureVariants = useCallback(
    async (variants: SimulatorVariantId[] = simulatorVariantIds) => {
      if (!connection || !runtimeClient) return;
      const operationToken = operationGate.begin('capture');
      if (operationToken === null) return;
      setVariantError(null);
      setVariantCaptures([]);
      setSelectedVariant(null);
      setActivePreviewVariant(null);
      setIsVariantPreviewOpen(true);

      const captures: VariantCapture[] = [];
      let previewLaunchStarted = false;
      try {
        for (const variant of variants) {
          if (!operationGate.isCurrent(operationToken)) return;
          setCapturingVariant(variant);
          await runtimeClient.launchVariant(variant);
          previewLaunchStarted = true;
          const image = await captureStableSimulatorScreen(runtimeClient, variant, selectedElement);
          if (!operationGate.isCurrent(operationToken)) return;
          captures.push({ id: variant, image, orientation });
          setVariantCaptures([...captures]);
        }
      } catch (captureError) {
        if (operationGate.isCurrent(operationToken)) setVariantError(errorMessage(captureError));
      } finally {
        if (previewLaunchStarted) {
          try {
            await runtimeClient.launchApp();
          } catch (restoreError) {
            if (operationGate.isCurrent(operationToken)) {
              setVariantError((current) => {
                const message = `Could not restart the app normally: ${errorMessage(restoreError)}`;
                return current ? `${current} ${message}` : message;
              });
            }
          }
        }
        if (operationGate.finish(operationToken)) {
          setCapturingVariant(null);
        }
      }
    },
    [connection, operationGate, orientation, runtimeClient, selectedElement]
  );

  useEffect(() => {
    if (!pendingAutoCapture || !connection || !runtimeClient) return;
    setPendingAutoCapture(null);
    void captureVariants(simulatorVariantIdsForCount(pendingAutoCapture.count));
  }, [captureVariants, connection, pendingAutoCapture, runtimeClient]);

  const openSelectedVariant = async () => {
    if (!connection || !runtimeClient || !selectedVariant) return;
    const operationToken = operationGate.begin('opening');
    if (operationToken === null) return;
    setVariantError(null);
    setVariantTransition('opening');
    try {
      await runtimeClient.launchVariant(selectedVariant);
      if (!operationGate.isCurrent(operationToken)) return;
      setActivePreviewVariant(selectedVariant);
      setIsVariantPreviewOpen(false);
    } catch (launchError) {
      if (operationGate.isCurrent(operationToken)) setVariantError(errorMessage(launchError));
    } finally {
      if (operationGate.finish(operationToken)) setVariantTransition(null);
    }
  };

  const selectAgentVariant = async (variant: SimulatorVariantId, transition: Exclude<VariantTransition, null>) => {
    const requestId = activeAgentSession?.changeRequest?.id;
    if (activeAgentSession?.status !== 'variants_ready' || !requestId || !runtimeClient) return;
    const operationToken = operationGate.begin(transition);
    if (operationToken === null) return;
    setVariantError(null);
    if (variant === 'original') setSelectedVariant(variant);
    setVariantTransition(transition);
    try {
      const session = await runtimeClient.confirmAgentSelection(activeAgentSession.id, {
        requestId,
        variant
      });
      if (!operationGate.isCurrent(operationToken)) return;
      onSessionChanged(session);
      if (variant === 'original') setActivePreviewVariant(null);
      setIsVariantPreviewOpen(false);
    } catch (selectionError) {
      if (operationGate.isCurrent(operationToken)) setVariantError(errorMessage(selectionError));
    } finally {
      if (operationGate.finish(operationToken)) setVariantTransition(null);
    }
  };
  const confirmSelectedVariant = async () => {
    if (selectedVariant) await selectAgentVariant(selectedVariant, 'confirming');
  };
  const discardAgentChange = () => selectAgentVariant('original', 'discarding');

  const discardVariantPreview = async () => {
    if (!connection || !runtimeClient) return;
    const operationToken = operationGate.begin('restoring');
    if (operationToken === null) return;
    setVariantError(null);
    setVariantTransition('restoring');
    try {
      await runtimeClient.launchApp();
    } catch (discardError) {
      if (operationGate.isCurrent(operationToken)) {
        onError(`Could not restore the original app state: ${errorMessage(discardError)}`);
      }
    } finally {
      if (operationGate.isCurrent(operationToken)) resetVariantPreview();
    }
  };

  const toggleVariantPreview = async () => {
    if (!isVariantPreviewOpen) {
      setIsVariantPreviewOpen(true);
      return;
    }
    await discardVariantPreview();
  };

  return {
    activePreviewVariant,
    captureVariants,
    capturingVariant,
    confirmSelectedVariant,
    discardAgentChange,
    discardVariantPreview,
    isVariantPreviewOpen,
    openSelectedVariant,
    resetVariantPreview,
    selectedVariant,
    setIsVariantPreviewOpen,
    setPendingAutoCapture,
    setSelectedVariant,
    setVariantError,
    toggleVariantPreview,
    variantCaptures,
    variantError,
    variantTransition
  };
};
