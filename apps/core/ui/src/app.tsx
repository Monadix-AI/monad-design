import type { VariantComparisonCapture } from '@monaddesign/ui/business/variant-comparison';

import { ClientApi } from '@monaddesign/client-rtk/client-api';
import { errorMessage as formatErrorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import {
  type AccessibilityElement,
  type AccessibilitySnapshot,
  accessibilityElementAtPoint,
  buildAgentTurnContext,
  canvasScaleStep,
  encodeSimulatorFrame,
  maximumCanvasScale,
  minimumCanvasScale,
  normalizedCanvasPoint,
  orientCanvasPoint,
  rotatedSimulatorOrientation,
  type SimulatorOrientation,
  type SimulatorVariantId,
  simulatorKeyUsage,
  simulatorVariantIdsForCount,
  simulatorVariantLabels
} from '@monaddesign/simulator';
import { LiveAnnotationSurface } from '@monaddesign/ui/business/annotation/live-surface';
import {
  CanvasZoomControls,
  canvasModeShowsSelectionOverlay,
  liveSimulatorDeviceFrame,
  liveWorkspaceCanvasPlacement,
  SimulatorDeviceControls
} from '@monaddesign/ui/business/canvas-controls';
import { useCanvasViewport } from '@monaddesign/ui/business/canvas-viewport';
import { LiveWorkspaceFrame, LiveWorkspaceHeading } from '@monaddesign/ui/business/live-session/app-frame';
import { LiveSessionSimulatorPicker } from '@monaddesign/ui/business/live-session/simulator-picker';
import { useClientTheme } from '@monaddesign/ui/business/live-session/theme';
import { LiveWorkspaceInspector } from '@monaddesign/ui/business/live-session/workspace-inspector';
import { SimulatorCanvas } from '@monaddesign/ui/business/simulator-canvas';
import { captureStableSimulatorScreen } from '@monaddesign/ui/business/variant-capture';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCoreLiveSession } from './use-core-live-session';
import { captureTargetFromContext } from './variant-capture-target';

type AXSnapshot = AccessibilitySnapshot;

const coreClient = new ClientApi({ origin: window.location.origin });
const loadVariantComparison = () => import('@monaddesign/ui/business/variant-comparison');
const VariantComparison = lazy(async () => ({ default: (await loadVariantComparison()).VariantComparison }));

export function App() {
  useClientTheme();
  const [errorMessage, setErrorMessage] = useState('');
  const { isScanning, refreshSession, session, setSession, simulators } = useCoreLiveSession(
    coreClient,
    setErrorMessage
  );
  const [isChoosingSimulator, setIsChoosingSimulator] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [selectedUdid, setSelectedUdid] = useState('');
  const [selectedBundleIdentifier, setSelectedBundleIdentifier] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [agentRequest, setAgentRequest] = useState('');
  const [variantCount, setVariantCount] = useState(1);
  const [isSendingAgentRequest, setIsSendingAgentRequest] = useState(false);
  const [variantTransition, setVariantTransition] = useState<'confirming' | 'discarding' | null>(null);
  const [variantCaptures, setVariantCaptures] = useState<VariantComparisonCapture[]>([]);
  const [capturingVariant, setCapturingVariant] = useState<SimulatorVariantId | null>(null);
  const [variantError, setVariantError] = useState('');
  const [isRestoringConnection, setIsRestoringConnection] = useState(false);
  const [isEndingLive, setIsEndingLive] = useState(false);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [axSnapshot, setAXSnapshot] = useState<AXSnapshot | null>(null);
  const [hoveredAXPath, setHoveredAXPath] = useState<string | null>(null);
  const [selectedAXPath, setSelectedAXPath] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<SimulatorOrientation>('portrait');
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light');
  const [isAppearanceChanging, setIsAppearanceChanging] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const screenImage = useRef<HTMLImageElement | null>(null);
  const orientationRef = useRef<SimulatorOrientation>('portrait');
  const restoredConnection = useRef<string | null>(null);
  const capturedRequest = useRef<string | null>(null);
  const connectingSimulator = useRef(false);
  const selectedSimulator = useMemo(
    () => simulators.find((simulator) => simulator.udid === selectedUdid),
    [selectedUdid, simulators]
  );
  const screen = selectedSimulator?.screen
    ? {
        width: selectedSimulator.screen.width / selectedSimulator.screen.scale,
        height: selectedSimulator.screen.height / selectedSimulator.screen.scale
      }
    : { width: 390, height: 844 };
  const deviceFrame = liveSimulatorDeviceFrame({
    deviceChrome: selectedSimulator?.deviceChrome,
    deviceHeight: screen.height,
    deviceName: selectedSimulator?.name ?? 'iPhone',
    deviceWidth: screen.width,
    orientation
  });
  const connectionUdid = session?.connection?.udid;
  const isReviewingVariants = session?.status === 'variants_ready' || session?.status === 'selection_confirmed';
  const reviewVariantIds = session?.changeRequest
    ? simulatorVariantIdsForCount(session.changeRequest.variantCount)
    : [];
  const canvasMode = isAnnotationMode
    ? 'annotate'
    : session?.status === 'variants_ready' || session?.status === 'selection_confirmed'
      ? 'variants'
      : 'interact';
  const canvasViewport = useCanvasViewport({ deviceFrame, mode: canvasMode, resetKey: connectionUdid });
  const {
    beginTemporaryView: beginAnnotationCanvasView,
    canvas,
    changeScale: changeCanvasScale,
    finishPointer: finishCanvasDrag,
    fit: fitCanvas,
    handlePointerDown: handleCanvasPointerDown,
    handlePointerMove: handleCanvasPointerMove,
    handleWheel: handleCanvasWheel,
    isDragging: isCanvasDragging,
    offset: canvasOffset,
    restoreTemporaryView: restoreAnnotationCanvasView,
    scale: canvasScale,
    viewChanged: canvasViewChanged
  } = canvasViewport;

  useEffect(() => {
    if (!connectionUdid) return;
    void coreClient
      .appearance()
      .then(({ appearance: nextAppearance }) => setAppearance(nextAppearance))
      .catch(() => undefined);
  }, [connectionUdid]);

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
    orientationRef.current = orientation;
  }, [orientation]);

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
  }, [isChoosingSimulator, refreshSession, session, simulators]);

  useEffect(
    () => () => {
      socket.current?.close();
    },
    []
  );

  const connectInput = useCallback(() => {
    socket.current?.close();
    const nextSocket = new WebSocket(`${window.location.origin.replace(/^http/, 'ws')}/v1/simulator/input`);
    nextSocket.binaryType = 'arraybuffer';
    nextSocket.addEventListener('message', (event) => {
      if (!(event.data instanceof ArrayBuffer) || new Uint8Array(event.data)[0] !== 130) return;
      try {
        const configuration = JSON.parse(new TextDecoder().decode(new Uint8Array(event.data).subarray(1)));
        if (typeof configuration.orientation === 'string') setOrientation(configuration.orientation);
      } catch {
        // Stream configuration is advisory; malformed frames do not block touch input.
      }
    });
    socket.current = nextSocket;
  }, []);

  useEffect(() => {
    if (connectionUdid) connectInput();
  }, [connectInput, connectionUdid]);

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
      socket.current?.close();
      await coreClient.disconnect();
      setIsStreamReady(false);
      setIsChoosingSimulator(true);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    }
  };

  const endLive = async () => {
    if (!session || isEndingLive) return;
    setIsEndingLive(true);
    try {
      await coreClient.closeAgentSession(session.id);
      socket.current?.close();
      setIsStreamReady(false);
      setSession(null);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsEndingLive(false);
    }
  };

  const submitChangeRequest = async () => {
    if (!session?.connection || !agentRequest.trim() || isSendingAgentRequest) return;
    const selectedElement = axSnapshot?.elements.find(({ path }) => path === selectedAXPath);
    setIsSendingAgentRequest(true);
    try {
      const nextSession = await coreClient.submitAgentRequest(session.id, {
        request: agentRequest.trim(),
        variantCount,
        context: buildAgentTurnContext({
          bundleIdentifier: session.connection.bundleIdentifier,
          element: selectedElement,
          snapshot: axSnapshot ?? undefined,
          simulator: selectedSimulator ?? { udid: session.connection.udid }
        })
      });
      setSession(nextSession);
      setAgentRequest('');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsSendingAgentRequest(false);
    }
  };

  const confirmVariant = async (variant: string, transition: 'confirming' | 'discarding') => {
    if (!session?.changeRequest || variantTransition) return;
    setVariantTransition(transition);
    try {
      const nextSession = await coreClient.confirmAgentSelection(session.id, {
        requestId: session.changeRequest.id,
        variant: variant as SimulatorVariantId
      });
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setVariantTransition(null);
    }
  };

  const captureStableSimulatorImage = useCallback(
    (variant: SimulatorVariantId, target?: AccessibilityElement) =>
      captureStableSimulatorScreen(coreClient, variant, target, {
        targetVisibilityError: (currentVariant, detail) =>
          `${simulatorVariantLabels[currentVariant]} did not restore the selected page and scroll target in the visible viewport.${detail}`,
        stableFrameError: () => 'The Simulator did not reach a stable frame for variant comparison.'
      }),
    []
  );

  useEffect(() => {
    const changeRequest = session?.changeRequest;
    const requestId = changeRequest?.id;
    if (
      session?.status !== 'variants_ready' ||
      !requestId ||
      isRestoringConnection ||
      !simulators.some(({ connected, udid }) => connected && udid === session.connection?.udid) ||
      capturedRequest.current === requestId
    ) {
      return;
    }
    capturedRequest.current = requestId;
    setVariantCaptures([]);
    setSelectedVariant('');
    setVariantError('');

    void (async () => {
      const captures: VariantComparisonCapture[] = [];
      let previewLaunchStarted = false;
      let failedVariant: SimulatorVariantId | undefined;
      const captureTarget = captureTargetFromContext(changeRequest.context);
      try {
        for (const variant of simulatorVariantIdsForCount(changeRequest.variantCount)) {
          failedVariant = variant;
          setCapturingVariant(variant);
          await coreClient.launchVariant(variant);
          previewLaunchStarted = true;
          captures.push({
            id: variant,
            image: await captureStableSimulatorImage(variant, captureTarget),
            orientation: orientationRef.current
          });
          setVariantCaptures([...captures]);
          failedVariant = undefined;
        }
      } catch (error) {
        const message = formatErrorMessage(error);
        setVariantError(message);
        if (failedVariant) {
          try {
            setSession(
              await coreClient.reportVariantCaptureFailure(session.id, { requestId, variant: failedVariant, message })
            );
            capturedRequest.current = null;
          } catch (reportError) {
            setVariantError(`${message} Could not notify the coding agent: ${formatErrorMessage(reportError)}`);
          }
        }
      } finally {
        if (previewLaunchStarted) {
          try {
            await coreClient.launchApp();
          } catch (error) {
            setVariantError((current) => {
              const message = `Could not restart the app normally: ${formatErrorMessage(error)}`;
              return current ? `${current} ${message}` : message;
            });
          }
        }
        setCapturingVariant(null);
      }
    })();
  }, [captureStableSimulatorImage, isRestoringConnection, session, setSession, simulators]);

  useEffect(() => {
    if (session?.status !== 'awaiting_request') return;
    capturedRequest.current = null;
    setVariantCaptures([]);
    setSelectedVariant('');
    setCapturingVariant(null);
    setVariantError('');
  }, [session?.status]);

  const openAnnotation = () => {
    if (isAnnotationMode) return;
    beginAnnotationCanvasView();
    setIsSelectionMode(false);
    setHoveredAXPath(null);
    setSelectedAXPath(null);
    setIsAnnotationMode(true);
  };

  const closeAnnotation = () => {
    setIsAnnotationMode(false);
    restoreAnnotationCanvasView();
  };

  const captureSimulatorImage = async () => (await coreClient.screenshot()).image;

  const sendAnnotation = async (annotationScreenshot: string) => {
    if (!session?.connection) throw new Error('The active Simulator session is unavailable.');
    const snapshot = axSnapshot ?? (await coreClient.accessibility());
    const nextSession = await coreClient.submitAgentRequest(session.id, {
      request: 'Implement the changes shown in the attached annotated screenshot.',
      variantCount: 1,
      context: buildAgentTurnContext({
        bundleIdentifier: session.connection.bundleIdentifier,
        snapshot,
        simulator: selectedSimulator ?? { udid: session.connection.udid }
      }),
      annotationScreenshot
    });
    setAXSnapshot(snapshot);
    setSession(nextSession);
    closeAnnotation();
  };

  const changeSelectionMode = async (next: boolean) => {
    setIsSelectionMode(next);
    setHoveredAXPath(null);
    if (!next) return;
    try {
      setErrorMessage('');
      setAXSnapshot(await coreClient.accessibility());
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
      setIsSelectionMode(false);
    }
  };

  const sendInputFrame = (tag: number, payload: object) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setErrorMessage('The Simulator input channel is still starting.');
      return false;
    }
    socket.current.send(encodeSimulatorFrame(tag, payload));
    return true;
  };

  const pointFromSimulatorEvent = (event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = screenImage.current?.getBoundingClientRect();
    return bounds ? normalizedCanvasPoint({ x: event.clientX, y: event.clientY }, bounds) : null;
  };

  const selectionPathFromEvent = (event: React.PointerEvent<HTMLButtonElement>) => {
    const point = pointFromSimulatorEvent(event);
    return point && axSnapshot ? (accessibilityElementAtPoint(axSnapshot, point)?.path ?? null) : null;
  };

  const sendTouch = (type: 'begin' | 'move' | 'end', event: React.PointerEvent<HTMLButtonElement>) => {
    const point = pointFromSimulatorEvent(event);
    if (!point) return;
    sendInputFrame(0x03, { type, ...orientCanvasPoint(point, orientation) });
  };

  const rotate = (direction: 'left' | 'right') => {
    const next = rotatedSimulatorOrientation(orientation, direction);
    if (sendInputFrame(0x07, { orientation: next })) setOrientation(next);
  };

  const changeAppearance = async () => {
    if (isAppearanceChanging) return;
    const nextAppearance = appearance === 'dark' ? 'light' : 'dark';
    setIsAppearanceChanging(true);
    try {
      await coreClient.setAppearance(nextAppearance);
      setAppearance(nextAppearance);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsAppearanceChanging(false);
    }
  };

  const handleKey = (event: React.KeyboardEvent<HTMLButtonElement>, type: 'down' | 'up') => {
    if (event.metaKey && event.code === 'KeyV') return;
    const usage = simulatorKeyUsage(event.code);
    if (usage === undefined) return;
    event.preventDefault();
    sendInputFrame(0x06, { type, usage });
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    if (!text) return;
    try {
      await coreClient.setPasteboard(text);
      sendInputFrame(0x06, { type: 'down', usage: 227 });
      sendInputFrame(0x06, { type: 'down', usage: 25 });
      sendInputFrame(0x06, { type: 'up', usage: 25 });
      sendInputFrame(0x06, { type: 'up', usage: 227 });
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    }
  };

  const error = errorMessage ? (
    <p
      className="error"
      role="alert"
    >
      {errorMessage}
    </p>
  ) : null;
  const canvasPlacement = liveWorkspaceCanvasPlacement(canvasMode);
  const isSelectionOverlayVisible = canvasModeShowsSelectionOverlay(canvasMode, isSelectionMode);
  const isSimulatorInputDisabled = isAnnotationMode || isSelectionMode;

  return (
    <div className="app-shell">
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
          <LiveWorkspaceFrame
            canvas={
              isReviewingVariants ? (
                <Suspense fallback={null}>
                  <VariantComparison
                    captures={variantCaptures}
                    capturingVariant={capturingVariant}
                    deviceChrome={selectedSimulator?.deviceChrome}
                    deviceFrame={deviceFrame}
                    deviceHeight={screen.height}
                    deviceWidth={screen.width}
                    framebufferMask={selectedSimulator?.framebufferMask}
                    labels={simulatorVariantLabels}
                    offset={canvasOffset}
                    onSelect={setSelectedVariant}
                    scale={canvasScale}
                    selectedVariant={selectedVariant}
                    variants={reviewVariantIds}
                  />
                </Suspense>
              ) : (
                <LiveAnnotationSurface
                  active={isAnnotationMode}
                  captureImage={captureSimulatorImage}
                  imageSize={screen}
                  onCancel={closeAnnotation}
                  onFinish={sendAnnotation}
                  orientation={orientation}
                >
                  {(annotationOverlay) => (
                    <section
                      aria-label="Live Simulator canvas"
                      className={`device-cluster canvas-mode-${canvasMode}`}
                      data-canvas-ui
                      style={{
                        left: `calc(${canvasPlacement.left} + ${canvasOffset.x}px)`,
                        top: `calc(50% + ${canvasOffset.y}px)`,
                        transform: `translate(-50%, -50%) scale(${canvasScale * canvasPlacement.scale})`
                      }}
                    >
                      <SimulatorCanvas
                        ariaLabel="Interact with the connected Simulator"
                        controls={
                          <SimulatorDeviceControls
                            appearance={appearance}
                            isAppearanceChanging={isAppearanceChanging}
                            onChangeAppearance={() => void changeAppearance()}
                            onHome={() => sendInputFrame(0x04, { button: 'home' })}
                            onRotateLeft={() => rotate('left')}
                            onRotateRight={() => rotate('right')}
                            scale={canvasScale}
                          />
                        }
                        deviceChrome={selectedSimulator?.deviceChrome}
                        deviceFrame={deviceFrame}
                        deviceHeight={screen.height}
                        deviceWidth={screen.width}
                        framebufferMask={selectedSimulator?.framebufferMask}
                        onKeyDown={isSimulatorInputDisabled ? undefined : (event) => handleKey(event, 'down')}
                        onKeyUp={isSimulatorInputDisabled ? undefined : (event) => handleKey(event, 'up')}
                        onPaste={isSimulatorInputDisabled ? undefined : (event) => void handlePaste(event)}
                        onPointerCancel={isSimulatorInputDisabled ? undefined : (event) => sendTouch('end', event)}
                        onPointerDown={
                          isAnnotationMode
                            ? undefined
                            : isSelectionMode
                              ? (event) => {
                                  event.stopPropagation();
                                  event.currentTarget.focus();
                                  const path = selectionPathFromEvent(event);
                                  setHoveredAXPath(path);
                                  setSelectedAXPath(path);
                                }
                              : (event) => {
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                  sendTouch('begin', event);
                                }
                        }
                        onPointerLeave={isSelectionMode ? () => setHoveredAXPath(null) : undefined}
                        onPointerMove={
                          isAnnotationMode
                            ? undefined
                            : isSelectionMode
                              ? (event) => setHoveredAXPath(selectionPathFromEvent(event))
                              : (event) => {
                                  if (event.currentTarget.hasPointerCapture(event.pointerId)) sendTouch('move', event);
                                }
                        }
                        onPointerUp={isSimulatorInputDisabled ? undefined : (event) => sendTouch('end', event)}
                        onStreamError={() => {
                          setIsStreamReady(false);
                          setErrorMessage('The Simulator video stream stopped.');
                        }}
                        onStreamLoad={() => setIsStreamReady(true)}
                        orientation={orientation}
                        overlay={
                          isAnnotationMode ? (
                            annotationOverlay
                          ) : isSelectionOverlayVisible && axSnapshot ? (
                            <span
                              aria-hidden="true"
                              className="ax-overlay"
                            >
                              {axSnapshot.elements.map((element) => (
                                <span
                                  className={`ax-element-box ${element.isContainer ? 'container' : ''} ${element.path === hoveredAXPath ? 'hovered' : ''} ${element.path === selectedAXPath ? 'selected' : ''}`}
                                  key={`${element.path}-${element.id}`}
                                  style={{
                                    left: `${(element.frame.x / axSnapshot.screen.width) * 100}%`,
                                    top: `${(element.frame.y / axSnapshot.screen.height) * 100}%`,
                                    width: `${(element.frame.width / axSnapshot.screen.width) * 100}%`,
                                    height: `${(element.frame.height / axSnapshot.screen.height) * 100}%`
                                  }}
                                />
                              ))}
                            </span>
                          ) : null
                        }
                        screenClassName={`phone-frame interactive canvas-phone device-${deviceFrame.kind} ${selectedSimulator?.deviceChrome ? 'native-device-chrome' : ''}`}
                        screenImageRef={screenImage}
                        streamUrl="/v1/simulator/stream"
                      />
                    </section>
                  )}
                </LiveAnnotationSurface>
              )
            }
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
            error={error}
            heading={
              <LiveWorkspaceHeading
                isLive={isStreamReady}
                name={selectedSimulator?.name ?? 'iOS Simulator'}
                onBack={() => void disconnectSimulator()}
                previewLabel={capturingVariant ? `Capturing ${simulatorVariantLabels[capturingVariant]}` : undefined}
              />
            }
            inspector={
              <>
                <LiveWorkspaceInspector
                  agentStatus={session.status}
                  confirmedVariant={session.confirmedSelection?.variant}
                  isEndingLive={isEndingLive}
                  isSendingRequest={isSendingAgentRequest}
                  mode={
                    isAnnotationMode
                      ? 'annotate'
                      : canvasMode === 'variants'
                        ? 'variants'
                        : isSelectionMode
                          ? 'select'
                          : 'interact'
                  }
                  onAcceptVariant={() => {
                    if (selectedVariant) void confirmVariant(selectedVariant, 'confirming');
                  }}
                  onBeginSelection={() => void changeSelectionMode(true)}
                  onClearSelection={() => setSelectedAXPath(null)}
                  onDiscardVariant={() => void confirmVariant('original', 'discarding')}
                  onEndLive={() => void endLive()}
                  onModeChange={(mode) => {
                    if (mode === 'annotate') {
                      openAnnotation();
                    } else {
                      if (isAnnotationMode) closeAnnotation();
                      void changeSelectionMode(mode === 'select');
                    }
                  }}
                  onRequestChange={setAgentRequest}
                  onSelectVariant={setSelectedVariant}
                  onSendRequest={() => void submitChangeRequest()}
                  onVariantCountChange={setVariantCount}
                  request={agentRequest}
                  requestInFlight={session.changeRequest?.request}
                  selectedElement={(() => {
                    const element = axSnapshot?.elements.find(({ path }) => path === selectedAXPath);
                    return element
                      ? {
                          frame: element.frame,
                          isContainer: element.isContainer,
                          name: element.label || element.value || element.role || element.type || 'Element',
                          role: element.role,
                          type: element.type
                        }
                      : null;
                  })()}
                  selectedVariant={selectedVariant}
                  variantCount={session.changeRequest?.variantCount ?? variantCount}
                  variantError={
                    variantError ? (
                      <p
                        className="variant-error"
                        role="alert"
                      >
                        {variantError}
                      </p>
                    ) : undefined
                  }
                  variants={reviewVariantIds.map((id) => ({
                    id,
                    label: simulatorVariantLabels[id],
                    ready: variantCaptures.some((capture) => capture.id === id)
                  }))}
                  variantTransition={variantTransition}
                />
                <CanvasZoomControls
                  maximumScale={maximumCanvasScale}
                  minimumScale={minimumCanvasScale}
                  mode={canvasMode}
                  onFit={() => {
                    canvasViewChanged.current = false;
                    fitCanvas();
                  }}
                  onZoomIn={() => changeCanvasScale(canvasScale + canvasScaleStep)}
                  onZoomOut={() => changeCanvasScale(canvasScale - canvasScaleStep)}
                  scale={canvasScale}
                />
              </>
            }
            mode={canvasMode}
          />
        )}
      </main>
    </div>
  );
}
