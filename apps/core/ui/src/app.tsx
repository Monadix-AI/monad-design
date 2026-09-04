import { ClientApi } from '@monaddesign/client-rtk/client-api';
import { errorMessage as formatErrorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import { useLiveWorkspaceController } from '@monaddesign/client-rtk/use-live-workspace';
import {
  type AccessibilityElement,
  canvasScaleStep,
  maximumCanvasScale,
  minimumCanvasScale,
  type SimulatorVariantId,
  simulatorVariantLabels
} from '@monaddesign/simulator';
import { EdgeAtmosphere } from '@monaddesign/ui/business/edge-atmosphere';
import { LiveWorkspaceHeading } from '@monaddesign/ui/business/live-session/app-frame';
import { LiveSessionSimulatorPicker } from '@monaddesign/ui/business/live-session/simulator-picker';
import { useClientTheme } from '@monaddesign/ui/business/live-session/theme';
import { LiveWorkspace } from '@monaddesign/ui/business/live-session/workspace';
import { useLiveWorkspaceViewport } from '@monaddesign/ui/business/live-session/workspace-viewport';
import { captureStableSimulatorScreen } from '@monaddesign/ui/business/variant-capture';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCoreLiveSession } from './use-core-live-session';
import { captureTargetFromContext } from './variant-capture-target';

const coreClient = new ClientApi({ origin: window.location.origin });
const loadDesignDocumentCard = () => import('@monaddesign/ui/business/design-document-card');
const DesignDocumentCard = lazy(async () => ({ default: (await loadDesignDocumentCard()).DesignDocumentCard }));

export function App() {
  useClientTheme();
  const [errorMessage, setErrorMessage] = useState('');
  const {
    endLive,
    isEndingLive,
    isScanning,
    refresh: refreshSession,
    session,
    setSession,
    simulators
  } = useCoreLiveSession(coreClient, setErrorMessage);
  const [isChoosingSimulator, setIsChoosingSimulator] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedUdid, setSelectedUdid] = useState('');
  const [selectedBundleIdentifier, setSelectedBundleIdentifier] = useState('');
  const [agentRequest, setAgentRequest] = useState('');
  const [isRestoringConnection, setIsRestoringConnection] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAXPath, setSelectedAXPath] = useState<string | null>(null);
  const loadDesignDocument = useCallback((projectId: string) => coreClient.projectDesignDocument(projectId), []);
  const restoredConnection = useRef<string | null>(null);
  const connectingSimulator = useRef(false);
  const selectedSimulator = useMemo(
    () => simulators.find((simulator) => simulator.udid === selectedUdid),
    [selectedUdid, simulators]
  );
  const connectionUdid = session?.connection?.udid;
  const captureStableSimulatorImage = useCallback(
    (variant: SimulatorVariantId, target?: AccessibilityElement) =>
      captureStableSimulatorScreen(coreClient, variant, target, {
        targetVisibilityError: (currentVariant, detail) =>
          `${simulatorVariantLabels[currentVariant]} did not restore the selected page and scroll target in the visible viewport.${detail}`,
        stableFrameError: () => 'The Simulator did not reach a stable frame for variant comparison.'
      }),
    []
  );
  const handleWorkspaceError = useCallback((message: string | null) => setErrorMessage(message ?? ''), []);
  const workspaceConnection = useMemo(
    () =>
      session?.connection
        ? {
            bundleIdentifier: session.connection.bundleIdentifier,
            streamUrl: '/v1/simulator/stream',
            wsUrl: `${window.location.origin.replace(/^http/, 'ws')}/v1/simulator/input`
          }
        : null,
    [session?.connection]
  );
  const workspace = useLiveWorkspaceController({
    agentRequest,
    canAutoCapture:
      !isRestoringConnection &&
      Boolean(simulators.some(({ connected, udid }) => connected && udid === session?.connection?.udid)),
    captureStableScreen: captureStableSimulatorImage,
    client: coreClient,
    connected: selectedSimulator,
    connection: workspaceConnection,
    connectionKey: session?.connection
      ? `${session.project.id}:${session.connection.udid}:${session.connection.bundleIdentifier}`
      : null,
    onError: handleWorkspaceError,
    onRequestChanged: setAgentRequest,
    onSessionChanged: setSession,
    selectedPath: selectedAXPath,
    selectionMode: isSelectionMode,
    session,
    setSelectedPath: setSelectedAXPath,
    setSelectionMode: setIsSelectionMode,
    variantTarget: session?.changeRequest ? captureTargetFromContext(session.changeRequest.context) : undefined
  });
  const {
    annotationMode: isAnnotationMode,
    axError,
    capturingVariant,
    isStreamReady,
    resetSimulatorRuntime,
    reviewingAgentVariants: isReviewingVariants,
    setIsStreamReady
  } = workspace;
  const canvasViewport = useLiveWorkspaceViewport({
    deviceChrome: selectedSimulator?.deviceChrome,
    deviceHeight: workspace.deviceHeight,
    deviceName: selectedSimulator?.name ?? 'iPhone',
    deviceWidth: workspace.deviceWidth,
    mode: workspace.workspaceMode,
    orientation: workspace.orientation,
    resetKey: connectionUdid
  });
  const {
    canvas,
    changeScale: changeCanvasScale,
    deviceFrame,
    finishPointer: finishCanvasDrag,
    fit: fitCanvas,
    handlePointerDown: handleCanvasPointerDown,
    handlePointerMove: handleCanvasPointerMove,
    handleWheel: handleCanvasWheel,
    isDragging: isCanvasDragging,
    offset: canvasOffset,
    scale: canvasScale,
    viewChanged: canvasViewChanged
  } = canvasViewport;

  useEffect(() => {
    if (!session?.project.targetApps.length) return;
    setSelectedBundleIdentifier((current) => current || session.project.targetApps[0]?.bundleIdentifier || '');
  }, [session?.project.targetApps]);

  useEffect(() => {
    if (!simulators.length) return;
    setSelectedUdid(
      (current) =>
        current ||
        connectionUdid ||
        simulators.find(({ state }) => state === 'Booted')?.udid ||
        simulators[0]?.udid ||
        ''
    );
  }, [connectionUdid, simulators]);

  useEffect(() => {
    if (
      !session?.connection ||
      isChoosingSimulator ||
      simulators.some(({ connected, udid }) => connected && udid === session.connection?.udid)
    ) {
      return;
    }
    const key = `${session.id}:${session.connection.udid}:${session.connection.bundleIdentifier}`;
    if (restoredConnection.current === key) return;
    restoredConnection.current = key;
    setIsRestoringConnection(true);
    setSelectedUdid(session.connection.udid);
    setSelectedBundleIdentifier(session.connection.bundleIdentifier);
    void coreClient
      .connect(session.project.id, session.connection.udid, session.connection.bundleIdentifier)
      .then(() => {
        setIsStreamReady(false);
        setErrorMessage('');
        return refreshSession();
      })
      .catch((error) => setErrorMessage(formatErrorMessage(error)))
      .finally(() => setIsRestoringConnection(false));
  }, [isChoosingSimulator, refreshSession, session, setIsStreamReady, simulators]);

  const connectSimulator = async () => {
    if (!session || connectingSimulator.current) return;
    connectingSimulator.current = true;
    setIsConnecting(true);
    try {
      setErrorMessage('');
      await coreClient.connect(session.project.id, selectedUdid, selectedBundleIdentifier);
      const nextSession = await coreClient.connectAgentSession(session.id, {
        udid: selectedUdid,
        bundleIdentifier: selectedBundleIdentifier
      });
      setSession(nextSession);
      setIsChoosingSimulator(false);
      setIsStreamReady(false);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      connectingSimulator.current = false;
      setIsConnecting(false);
    }
  };

  const disconnectSimulator = async () => {
    try {
      await coreClient.disconnect();
      resetSimulatorRuntime();
      setIsChoosingSimulator(true);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    }
  };

  const visibleError = errorMessage || axError;
  const error = visibleError ? (
    <p
      className="error"
      role="alert"
    >
      {visibleError}
    </p>
  ) : null;
  const showEdgeAtmosphere = Boolean(
    session &&
      session.status !== 'configuring_project' &&
      (session.status === 'selecting_simulator' || !session.connection || isChoosingSimulator)
  );

  return (
    <div className="app-shell">
      <EdgeAtmosphere active={showEdgeAtmosphere} />
      <main>
        {!session || session.status === 'configuring_project' ? (
          <section className="core-waiting">
            <h1>Waiting for a coding agent</h1>
            <p className="lead">
              Connect any coding agent to the Design MCP. Core will bind the current workspace and open Simulator
              selection here when the session is ready.
            </p>
            {error}
          </section>
        ) : session.status === 'selecting_simulator' || !session.connection || isChoosingSimulator ? (
          <LiveSessionSimulatorPicker
            error={error}
            isConnecting={isConnecting}
            isScanning={isScanning}
            onConnect={() => void connectSimulator()}
            onSelectSimulator={setSelectedUdid}
            onSelectTarget={setSelectedBundleIdentifier}
            project={{ name: session.project.name }}
            selectedSimulatorUdid={selectedUdid}
            selectedTargetBundleIdentifier={selectedBundleIdentifier}
            simulators={simulators}
            targets={session.project.targetApps}
          />
        ) : (
          <LiveWorkspace
            activeSession={{ isEnding: isEndingLive, onEnd: () => void endLive() }}
            canvasProps={{
              className: isCanvasDragging ? 'dragging' : undefined,
              onLostPointerCapture: finishCanvasDrag,
              onPointerCancel: finishCanvasDrag,
              onPointerDown: handleCanvasPointerDown,
              onPointerMove: handleCanvasPointerMove,
              onPointerUp: finishCanvasDrag,
              onWheel: handleCanvasWheel,
              ref: canvas
            }}
            designDocument={
              <Suspense fallback={null}>
                <DesignDocumentCard
                  collapse={isAnnotationMode || isSelectionMode}
                  loadDocument={loadDesignDocument}
                  projectId={session.project.id}
                />
              </Suspense>
            }
            error={error}
            heading={
              <LiveWorkspaceHeading
                isLive={isStreamReady}
                name={selectedSimulator?.name ?? 'iOS Simulator'}
                onBack={() => void disconnectSimulator()}
                previewLabel={capturingVariant ? `Capturing ${simulatorVariantLabels[capturingVariant]}` : undefined}
              />
            }
            inspector={workspace.inspector}
            mode={workspace.workspaceMode}
            simulator={{ ...workspace.simulator, canvasOffset, canvasScale, deviceFrame }}
            variantComparison={
              isReviewingVariants
                ? {
                    ...workspace.variantComparison,
                    deviceFrame,
                    offset: canvasOffset,
                    scale: canvasScale
                  }
                : undefined
            }
            zoomControls={{
              maximumScale: maximumCanvasScale,
              minimumScale: minimumCanvasScale,
              onFit: () => {
                canvasViewChanged.current = false;
                fitCanvas();
              },
              onZoomIn: () => changeCanvasScale(canvasScale + canvasScaleStep),
              onZoomOut: () => changeCanvasScale(canvasScale - canvasScaleStep),
              scale: canvasScale
            }}
          />
        )}
      </main>
    </div>
  );
}
