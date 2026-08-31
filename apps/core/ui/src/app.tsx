import type { AgentSessionSnapshot, IOSSimulator } from '@monaddesign/client-contract';

import {
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
import {
  CanvasZoomControls,
  canvasModeShowsSelectionOverlay,
  LiveAnnotationSurface,
  LiveSessionSimulatorPicker,
  LiveWorkspaceFrame,
  LiveWorkspaceHeading,
  LiveWorkspaceInspector,
  liveSimulatorDeviceFrame,
  liveWorkspaceCanvasPlacement,
  SimulatorCanvas,
  SimulatorDeviceControls,
  useCanvasViewport,
  useClientTheme,
  VariantComparison,
  type VariantComparisonCapture
} from '@monaddesign/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ActiveSessionResponse = { session: AgentSessionSnapshot | null };
type SimulatorsResponse = { simulators: IOSSimulator[] };
type ScreenshotResponse = { image: string };
type AXSnapshot = AccessibilitySnapshot;

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const loadCaptureImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not inspect the captured frame.'));
    image.src = source;
  });

const capturesAreVisuallyStable = async (left: string, right: string) => {
  const [leftImage, rightImage] = await Promise.all([loadCaptureImage(left), loadCaptureImage(right)]);
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 96;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not compare the captured frames.');

  context.drawImage(leftImage, 0, 0, canvas.width, canvas.height);
  const leftPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(rightImage, 0, 0, canvas.width, canvas.height);
  const rightPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  let difference = 0;
  for (let index = 0; index < leftPixels.length; index += 4) {
    difference += Math.abs((leftPixels[index] ?? 0) - (rightPixels[index] ?? 0));
    difference += Math.abs((leftPixels[index + 1] ?? 0) - (rightPixels[index + 1] ?? 0));
    difference += Math.abs((leftPixels[index + 2] ?? 0) - (rightPixels[index + 2] ?? 0));
  }

  return difference / (canvas.width * canvas.height * 3) < 1.5;
};

export function App() {
  useClientTheme();
  const [session, setSession] = useState<AgentSessionSnapshot | null>(null);
  const [simulators, setSimulators] = useState<IOSSimulator[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [isChoosingSimulator, setIsChoosingSimulator] = useState(false);
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
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [axSnapshot, setAXSnapshot] = useState<AXSnapshot | null>(null);
  const [hoveredAXPath, setHoveredAXPath] = useState<string | null>(null);
  const [selectedAXPath, setSelectedAXPath] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<SimulatorOrientation>('portrait');
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light');
  const [isAppearanceChanging, setIsAppearanceChanging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const screenImage = useRef<HTMLImageElement | null>(null);
  const orientationRef = useRef<SimulatorOrientation>('portrait');
  const restoredConnection = useRef<string | null>(null);
  const capturedRequest = useRef<string | null>(null);
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

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...options.headers }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? `Core request failed (${response.status}).`);
    return body as T;
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await request<ActiveSessionResponse>('/v1/agent-session/active');
      setSession(response.session);
      if (response.session) {
        const simulatorResponse = await request<SimulatorsResponse>('/v1/simulators');
        setSimulators(simulatorResponse.simulators);
        setIsScanning(false);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [request]);

  useEffect(() => {
    void refreshSession();
    const interval = window.setInterval(() => void refreshSession(), 800);
    return () => window.clearInterval(interval);
  }, [refreshSession]);

  useEffect(() => {
    if (!connectionUdid) return;
    void request<{ appearance: 'light' | 'dark' }>('/v1/simulator/appearance')
      .then(({ appearance: nextAppearance }) => setAppearance(nextAppearance))
      .catch(() => undefined);
  }, [connectionUdid, request]);

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
    void request('/v1/simulators/connect', {
      method: 'POST',
      body: JSON.stringify({
        projectId: session.project.id,
        udid: session.connection.udid,
        bundleIdentifier: session.connection.bundleIdentifier
      })
    })
      .then(() => {
        setIsStreamReady(false);
        setErrorMessage('');
        return refreshSession();
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setIsRestoringConnection(false));
  }, [isChoosingSimulator, refreshSession, request, session, simulators]);

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
    if (!session) return;
    try {
      setErrorMessage('');
      await request('/v1/simulators/connect', {
        method: 'POST',
        body: JSON.stringify({
          projectId: session.project.id,
          udid: selectedUdid,
          bundleIdentifier: selectedBundleIdentifier
        })
      });
      const nextSession = await request<AgentSessionSnapshot>(
        `/v1/agent-session/${encodeURIComponent(session.id)}/connected`,
        {
          method: 'POST',
          body: JSON.stringify({ udid: selectedUdid, bundleIdentifier: selectedBundleIdentifier })
        }
      );
      setSession(nextSession);
      setIsChoosingSimulator(false);
      setIsStreamReady(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const disconnectSimulator = async () => {
    try {
      socket.current?.close();
      await request('/v1/simulator/connection', { method: 'DELETE' });
      setIsStreamReady(false);
      setIsChoosingSimulator(true);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const submitChangeRequest = async () => {
    if (!session?.connection || !agentRequest.trim() || isSendingAgentRequest) return;
    const selectedElement = axSnapshot?.elements.find(({ path }) => path === selectedAXPath);
    setIsSendingAgentRequest(true);
    try {
      const nextSession = await request<AgentSessionSnapshot>(
        `/v1/agent-session/${encodeURIComponent(session.id)}/request`,
        {
          method: 'POST',
          body: JSON.stringify({
            request: agentRequest.trim(),
            variantCount,
            context: buildAgentTurnContext({
              bundleIdentifier: session.connection.bundleIdentifier,
              element: selectedElement,
              snapshot: axSnapshot ?? undefined,
              simulator: selectedSimulator ?? { udid: session.connection.udid }
            })
          })
        }
      );
      setSession(nextSession);
      setAgentRequest('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSendingAgentRequest(false);
    }
  };

  const confirmVariant = async (variant: string, transition: 'confirming' | 'discarding') => {
    if (!session?.changeRequest || variantTransition) return;
    setVariantTransition(transition);
    try {
      const nextSession = await request<AgentSessionSnapshot>(
        `/v1/agent-session/${encodeURIComponent(session.id)}/confirm-selection`,
        { method: 'POST', body: JSON.stringify({ requestId: session.changeRequest.id, variant }) }
      );
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setVariantTransition(null);
    }
  };

  const captureStableSimulatorImage = useCallback(async () => {
    await wait(700);
    let previous = (await request<ScreenshotResponse>('/v1/simulator/screenshot')).image;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await wait(450);
      const current = (await request<ScreenshotResponse>('/v1/simulator/screenshot')).image;
      if (await capturesAreVisuallyStable(previous, current)) return current;
      previous = current;
    }
    throw new Error('The Simulator did not reach a stable frame for variant comparison.');
  }, [request]);

  useEffect(() => {
    const requestId = session?.changeRequest?.id;
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
      try {
        for (const variant of simulatorVariantIdsForCount(session.changeRequest?.variantCount ?? 0)) {
          setCapturingVariant(variant);
          await request('/v1/simulator/variant', {
            method: 'POST',
            body: JSON.stringify({ variant })
          });
          previewLaunchStarted = true;
          captures.push({
            id: variant,
            image: await captureStableSimulatorImage(),
            orientation: orientationRef.current
          });
          setVariantCaptures([...captures]);
        }
      } catch (error) {
        setVariantError(error instanceof Error ? error.message : String(error));
      } finally {
        if (previewLaunchStarted) {
          try {
            await request('/v1/simulator/app', { method: 'POST' });
          } catch (error) {
            setVariantError((current) => {
              const message = `Could not restart the app normally: ${error instanceof Error ? error.message : String(error)}`;
              return current ? `${current} ${message}` : message;
            });
          }
        }
        setCapturingVariant(null);
      }
    })();
  }, [captureStableSimulatorImage, isRestoringConnection, request, session, simulators]);

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

  const captureSimulatorImage = async () => (await request<ScreenshotResponse>('/v1/simulator/screenshot')).image;

  const sendAnnotation = async (annotationScreenshot: string) => {
    if (!session?.connection) throw new Error('The active Simulator session is unavailable.');
    const snapshot = axSnapshot ?? (await request<AXSnapshot>('/v1/simulator/accessibility'));
    const nextSession = await request<AgentSessionSnapshot>(
      `/v1/agent-session/${encodeURIComponent(session.id)}/request`,
      {
        method: 'POST',
        body: JSON.stringify({
          request: 'Implement the changes shown in the attached annotated screenshot.',
          variantCount: 1,
          context: buildAgentTurnContext({
            bundleIdentifier: session.connection.bundleIdentifier,
            snapshot,
            simulator: selectedSimulator ?? { udid: session.connection.udid }
          }),
          annotationScreenshot
        })
      }
    );
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
      setAXSnapshot(await request<AXSnapshot>('/v1/simulator/accessibility'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
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
      await request('/v1/simulator/appearance', {
        method: 'PUT',
        body: JSON.stringify({ appearance: nextAppearance })
      });
      setAppearance(nextAppearance);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
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
      await request('/v1/simulator/pasteboard', { method: 'POST', body: JSON.stringify({ text }) });
      sendInputFrame(0x06, { type: 'down', usage: 227 });
      sendInputFrame(0x06, { type: 'down', usage: 25 });
      sendInputFrame(0x06, { type: 'up', usage: 25 });
      sendInputFrame(0x06, { type: 'up', usage: 227 });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
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
            isConnecting={false}
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
                <VariantComparison
                  captures={variantCaptures}
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
