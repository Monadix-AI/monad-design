import type { AccessibilitySnapshotResponse, AgentSessionSnapshot, IOSSimulator } from '@monaddesign/client-contract';
import type { ClientApi } from './client-api';

import { agentSessionTransition } from '@monaddesign/client-contract/live-session';
import {
  accessibilityElementName,
  simulatorVariantIds,
  simulatorVariantIdsForCount,
  simulatorVariantLabels
} from '@monaddesign/simulator';
import { useCallback, useEffect, useState } from 'react';

import { type AccessibilityPathSetter, useAccessibility } from './use-accessibility';
import { useAgentRequest } from './use-agent-request';
import { type SimulatorRuntimeConnection, useSimulatorRuntime } from './use-simulator-runtime';
import { useVariantCapture, type VariantCaptureControllerOptions } from './use-variant-capture';

type AXElement = AccessibilitySnapshotResponse['elements'][number];

export interface LiveWorkspaceConnection extends SimulatorRuntimeConnection {
  bundleIdentifier: string;
  streamUrl?: string;
}

export interface LiveWorkspaceControllerOptions {
  agentRequest: string;
  canAutoCapture?: boolean;
  captureStableScreen: VariantCaptureControllerOptions['captureStableScreen'];
  client: ClientApi | null;
  connected?: IOSSimulator;
  connection: LiveWorkspaceConnection | null;
  connectionKey: string | null;
  onBeginAnnotation?: () => void;
  onCloseAnnotation?: () => void;
  onCopyStatusChanged?: (status: 'copied' | 'error') => void;
  onError: (message: string | null) => void;
  onRequestChanged: (request: string) => void;
  onSessionChanged: (session: AgentSessionSnapshot) => void;
  selectedPath: string | null;
  selectionMode: boolean;
  session: AgentSessionSnapshot | null;
  setSelectedPath: AccessibilityPathSetter;
  setSelectionMode: (active: boolean) => void;
  variantTarget?: AXElement;
}

export function useLiveWorkspaceController({
  agentRequest,
  canAutoCapture = true,
  captureStableScreen,
  client,
  connected,
  connection,
  connectionKey,
  onBeginAnnotation,
  onCloseAnnotation,
  onCopyStatusChanged,
  onError,
  onRequestChanged,
  onSessionChanged,
  selectedPath,
  selectionMode,
  session,
  setSelectedPath,
  setSelectionMode,
  variantTarget
}: LiveWorkspaceControllerOptions) {
  const [annotationMode, setAnnotationMode] = useState(false);
  const accessibility = useAccessibility({
    client,
    connectionKey,
    isOpen: selectionMode,
    selectedPath,
    setSelectedPath
  });
  const runtime = useSimulatorRuntime({
    axSnapshot: accessibility.snapshot,
    connection,
    hasConnectedSimulator: Boolean(connected?.connected),
    isSelectionMode: selectionMode,
    onError,
    onHoveredPathChange: accessibility.setHoveredPath,
    onSelectedPathChange: setSelectedPath,
    runtimeClient: client
  });
  const request = useAgentRequest({
    activeSession: session,
    agentRequest,
    connected,
    connection,
    runtimeClient: client,
    selectedElement: accessibility.selectedElement,
    snapshot: accessibility.snapshot,
    onCopyStatusChanged,
    onRequestChanged,
    onSessionChanged,
    onSnapshotChanged: accessibility.setSnapshot
  });
  const variants = useVariantCapture({
    activeAgentSession: session,
    captureStableScreen,
    connection,
    onError: (message) => onError(message),
    onSessionChanged,
    orientation: runtime.orientation,
    runtimeClient: client,
    selectedElement: variantTarget ?? accessibility.selectedElement
  });
  const sessionTransition = agentSessionTransition(session);
  const pendingAutoCapture = sessionTransition.pendingAutoCapture;
  const clearsPendingAutoCapture = pendingAutoCapture === null;
  const pendingAutoCaptureId = pendingAutoCapture?.requestId;
  const pendingAutoCaptureCount = pendingAutoCapture?.count;

  useEffect(() => {
    if (!connection) return;
    void client
      ?.appearance()
      .then(({ appearance }) => runtime.setAppearance(appearance))
      .catch(() => undefined);
  }, [client, connection, runtime.setAppearance]);

  useEffect(() => {
    if (!connected?.screen || connected.screen.scale <= 0) return;
    runtime.initializeScreen({
      width: connected.screen.width / connected.screen.scale,
      height: connected.screen.height / connected.screen.scale
    });
  }, [connected?.screen, runtime.initializeScreen]);

  useEffect(() => {
    if (accessibility.snapshot?.screen) runtime.setLogicalScreenSize(accessibility.snapshot.screen);
  }, [accessibility.snapshot?.screen, runtime.setLogicalScreenSize]);

  useEffect(() => {
    if (clearsPendingAutoCapture) variants.setPendingAutoCapture(null);
    else if (pendingAutoCaptureId && pendingAutoCaptureCount && connection && canAutoCapture) {
      variants.setPendingAutoCapture({ requestId: pendingAutoCaptureId, count: pendingAutoCaptureCount });
    }
    if (sessionTransition.closeVariantPreview) variants.setIsVariantPreviewOpen(false);
    if (sessionTransition.resetVariantPreview) variants.resetVariantPreview();
  }, [
    canAutoCapture,
    connection,
    sessionTransition.closeVariantPreview,
    clearsPendingAutoCapture,
    pendingAutoCaptureCount,
    pendingAutoCaptureId,
    sessionTransition.resetVariantPreview,
    variants.resetVariantPreview,
    variants.setIsVariantPreviewOpen,
    variants.setPendingAutoCapture
  ]);

  const openAnnotation = useCallback(() => {
    if (!connection || annotationMode) return;
    onBeginAnnotation?.();
    setSelectionMode(false);
    accessibility.setHoveredPath(null);
    setSelectedPath(null);
    setAnnotationMode(true);
  }, [accessibility.setHoveredPath, annotationMode, connection, onBeginAnnotation, setSelectedPath, setSelectionMode]);

  const closeAnnotation = useCallback(() => {
    setAnnotationMode(false);
    onCloseAnnotation?.();
  }, [onCloseAnnotation]);

  const changeWorkspaceMode = useCallback(
    (mode: string) => {
      if (!mode) return;
      if (mode === 'annotate') {
        openAnnotation();
        return;
      }
      if (annotationMode) closeAnnotation();
      accessibility.setHoveredPath(null);
      setSelectionMode(mode === 'select');
    },
    [accessibility.setHoveredPath, annotationMode, closeAnnotation, openAnnotation, setSelectionMode]
  );

  const captureSimulatorImage = useCallback(async () => {
    if (!connection || !client) throw new Error('The Simulator is not available.');
    return (await client.screenshot()).image;
  }, [client, connection]);

  const reviewingAgentVariants = session?.status === 'variants_ready' || session?.status === 'selection_confirmed';
  const variantIds = session?.changeRequest
    ? simulatorVariantIdsForCount(session.changeRequest.variantCount)
    : simulatorVariantIds;
  const workspaceMode = annotationMode
    ? 'annotate'
    : reviewingAgentVariants || variants.isVariantPreviewOpen
      ? 'variants'
      : selectionMode
        ? 'select'
        : 'interact';
  const isSimulatorInputDisabled = annotationMode || selectionMode;
  const inspector = {
    agentError: request.agentSessionError,
    agentStatus: session?.status,
    confirmedVariant: session?.confirmedSelection?.variant,
    isBusy: variants.capturingVariant !== null,
    isSendingRequest: request.isSendingAgentRequest,
    onAcceptVariant: () => void variants.confirmSelectedVariant(),
    onBeginSelection: () => changeWorkspaceMode('select'),
    onClearSelection: () => setSelectedPath(null),
    onDiscardVariant: () => void variants.discardAgentChange(),
    onModeChange: changeWorkspaceMode,
    onRequestChange: onRequestChanged,
    onSelectVariant: (variant: string) => variants.setSelectedVariant(variant as (typeof simulatorVariantIds)[number]),
    onSendRequest: () => void request.sendAgentRequest(),
    onVariantCountChange: request.setVariantCount,
    request: agentRequest,
    requestInFlight: session?.changeRequest?.request,
    selectedElement: accessibility.selectedElement
      ? {
          frame: accessibility.selectedElement.frame,
          isContainer: accessibility.selectedElement.isContainer,
          name: accessibilityElementName(accessibility.selectedElement),
          role: accessibility.selectedElement.role,
          type: accessibility.selectedElement.type
        }
      : null,
    selectedVariant: variants.selectedVariant,
    variantCount: session?.changeRequest?.variantCount ?? request.variantCount,
    variantError: variants.variantError,
    variants: variantIds.map((id) => ({
      id,
      label: simulatorVariantLabels[id],
      ready: variants.variantCaptures.some((capture) => capture.id === id)
    })),
    variantTransition: variants.variantTransition
  } as const;
  const simulator = {
    annotation: {
      captureImage: captureSimulatorImage,
      onCancel: closeAnnotation,
      onFinish: async (annotationScreenshot: string) => {
        await request.sendAnnotatedAgentRequest(annotationScreenshot);
        closeAnnotation();
      }
    },
    appearance: runtime.appearance ?? ('light' as const),
    deviceChrome: connected?.deviceChrome,
    deviceHeight: runtime.deviceHeight,
    deviceName: connected?.name ?? 'iOS Simulator',
    deviceWidth: runtime.deviceWidth,
    framebufferMask: connected?.framebufferMask,
    isAppearanceChanging: runtime.isAppearanceChanging,
    mode: workspaceMode,
    onChangeAppearance: () => void runtime.changeAppearance(runtime.appearance === 'dark' ? 'light' : 'dark'),
    onHome: () => runtime.sendFrame(0x04, { button: 'home' }),
    onKeyDown: isSimulatorInputDisabled
      ? undefined
      : (event: Parameters<typeof runtime.handleKey>[0]) => runtime.handleKey(event, 'down'),
    onKeyUp: isSimulatorInputDisabled
      ? undefined
      : (event: Parameters<typeof runtime.handleKey>[0]) => runtime.handleKey(event, 'up'),
    onPaste: isSimulatorInputDisabled ? undefined : runtime.handlePaste,
    onPointerCancel: annotationMode ? undefined : runtime.finishPointer,
    onPointerDown: annotationMode ? undefined : runtime.handlePointerDown,
    onPointerLeave: annotationMode ? undefined : runtime.leavePointer,
    onPointerMove: annotationMode ? undefined : runtime.handlePointerMove,
    onPointerUp: annotationMode ? undefined : runtime.finishPointer,
    onRotateLeft: () => runtime.rotate('left'),
    onRotateRight: () => runtime.rotate('right'),
    onStreamError: () => {
      runtime.setIsStreamReady(false);
      onError('The Simulator video stream stopped.');
    },
    onStreamLoad: () => runtime.setIsStreamReady(true),
    orientation: runtime.orientation,
    pointer: annotationMode ? null : runtime.pointer,
    screenImageRef: runtime.screenImage,
    selection: {
      elements: accessibility.snapshot?.elements,
      error: accessibility.error ?? undefined,
      hoveredPath: accessibility.hoveredPath,
      screen: accessibility.snapshot?.screen,
      selectedPath
    },
    streamUrl: connection?.streamUrl ?? ''
  } as const;
  const variantComparison = {
    captures: variants.variantCaptures,
    capturingVariant: variants.capturingVariant,
    deviceChrome: connected?.deviceChrome,
    deviceHeight: runtime.deviceHeight,
    deviceWidth: runtime.deviceWidth,
    framebufferMask: connected?.framebufferMask,
    labels: simulatorVariantLabels,
    onSelect: (variant: string) => variants.setSelectedVariant(variant as (typeof simulatorVariantIds)[number]),
    orientation: runtime.orientation,
    selectedVariant: variants.selectedVariant,
    variants: variantIds
  } as const;

  return {
    ...runtime,
    ...request,
    ...variants,
    annotationMode,
    axError: accessibility.error,
    axSnapshot: accessibility.snapshot,
    captureSimulatorImage,
    changeWorkspaceMode,
    closeAnnotation,
    hoveredAXPath: accessibility.hoveredPath,
    inspector,
    isSimulatorInputDisabled,
    openAnnotation,
    reviewingAgentVariants,
    selectedAXElement: accessibility.selectedElement,
    simulator,
    setAXSnapshot: accessibility.setSnapshot,
    setHoveredAXPath: accessibility.setHoveredPath,
    variantIds,
    variantComparison,
    workspaceMode
  } as const;
}
