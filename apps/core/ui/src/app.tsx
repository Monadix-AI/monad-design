import type { AgentSessionSnapshot, IOSSimulator } from '@monaddesign/client-contract';

import { deviceFrameMetrics } from '@monaddesign/device-frame';
import {
  type AccessibilitySnapshot,
  buildAgentTurnContext,
  canvasOffsetForZoom,
  canvasScaleStep,
  clampCanvasOffset,
  encodeSimulatorFrame,
  maximumCanvasScale,
  minimumCanvasScale,
  normalizedCanvasPoint,
  orientCanvasPoint,
  rotatedSimulatorOrientation,
  type SimulatorOrientation,
  simulatorKeyUsage,
  simulatorVariantIdsForCount,
  simulatorVariantLabels
} from '@monaddesign/simulator';
import {
  AnnotationEditor,
  AppHeaderFrame,
  CanvasZoomControls,
  fitLiveWorkspaceCanvas,
  LiveSessionSimulatorPicker,
  LiveWorkspaceFrame,
  LiveWorkspaceInspector,
  SimulatorCanvas,
  SimulatorDeviceControls,
  webDeviceControlsReservedHeight
} from '@monaddesign/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ActiveSessionResponse = { session: AgentSessionSnapshot | null };
type SimulatorsResponse = { simulators: IOSSimulator[] };
type ScreenshotResponse = { image: string };
type AXSnapshot = AccessibilitySnapshot;

const accessTokenKey = 'monad-design-core-access-token';

const sessionLabel = (status: AgentSessionSnapshot['status']) =>
  ({
    configuring_project: 'Preparing project',
    selecting_simulator: 'Choose a Simulator',
    awaiting_request: 'Ready for a change',
    change_requested: 'Waiting for agent',
    working: 'Agent is generating',
    variants_ready: 'Variants ready',
    selection_confirmed: 'Applying selection',
    closed: 'Session closed'
  })[status] ?? 'Core online';

export function App() {
  const accessToken = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const queryAccessToken = query.get('accessToken');
    if (queryAccessToken) {
      window.sessionStorage.setItem(accessTokenKey, queryAccessToken);
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
    return queryAccessToken ?? window.sessionStorage.getItem(accessTokenKey);
  }, []);
  const [session, setSession] = useState<AgentSessionSnapshot | null>(null);
  const [simulators, setSimulators] = useState<IOSSimulator[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [selectedUdid, setSelectedUdid] = useState('');
  const [selectedBundleIdentifier, setSelectedBundleIdentifier] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [agentRequest, setAgentRequest] = useState('');
  const [variantCount, setVariantCount] = useState(1);
  const [isSendingAgentRequest, setIsSendingAgentRequest] = useState(false);
  const [variantTransition, setVariantTransition] = useState<'confirming' | 'discarding' | null>(null);
  const [annotationImage, setAnnotationImage] = useState<string | null>(null);
  const [isCapturingAnnotation, setIsCapturingAnnotation] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [axSnapshot, setAXSnapshot] = useState<AXSnapshot | null>(null);
  const [selectedAXPath, setSelectedAXPath] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<SimulatorOrientation>('portrait');
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light');
  const [isAppearanceChanging, setIsAppearanceChanging] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState(
    accessToken ? '' : 'Open this page from an active Design MCP session.'
  );
  const socket = useRef<WebSocket | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const screenImage = useRef<HTMLImageElement | null>(null);
  const canvasScaleRef = useRef(canvasScale);
  const canvasViewChanged = useRef(false);
  const canvasDrag = useRef<{
    offsetX: number;
    offsetY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  canvasScaleRef.current = canvasScale;
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
  const deviceFrame = deviceFrameMetrics({
    deviceName: selectedSimulator?.name ?? 'iPhone',
    screenWidth: screen.width,
    screenHeight: screen.height,
    orientation
  });
  const canvasMode = annotationImage
    ? 'annotate'
    : session?.status === 'variants_ready' || session?.status === 'selection_confirmed'
      ? 'variants'
      : 'interact';
  const connectionUdid = session?.connection?.udid;

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (!accessToken) throw new Error('The local Core access token is missing.');
      const response = await fetch(path, {
        ...options,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...options.headers }
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `Core request failed (${response.status}).`);
      return body as T;
    },
    [accessToken]
  );

  const constrainCanvasOffset = useCallback(
    (offset: { x: number; y: number }, scale: number) => {
      const viewport = canvas.current;
      if (!viewport) return offset;
      return clampCanvasOffset(
        offset,
        { width: viewport.clientWidth, height: viewport.clientHeight },
        {
          width: deviceFrame.frameWidth * scale,
          height: deviceFrame.frameHeight * scale + webDeviceControlsReservedHeight
        }
      );
    },
    [deviceFrame.frameHeight, deviceFrame.frameWidth]
  );

  const fitCanvas = useCallback(() => {
    const viewport = canvas.current;
    if (!viewport) return;
    const nextView = fitLiveWorkspaceCanvas(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      { width: deviceFrame.frameWidth, height: deviceFrame.frameHeight }
    );
    canvasScaleRef.current = nextView.scale;
    setCanvasScale(nextView.scale);
    setCanvasOffset(nextView.offset);
  }, [deviceFrame.frameHeight, deviceFrame.frameWidth]);

  const changeCanvasScale = (nextScale: number) => {
    canvasViewChanged.current = true;
    const boundedScale = Math.min(maximumCanvasScale, Math.max(minimumCanvasScale, nextScale));
    canvasScaleRef.current = boundedScale;
    setCanvasScale(boundedScale);
    setCanvasOffset((current) => constrainCanvasOffset(current, boundedScale));
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (canvasMode !== 'interact') return;
    event.preventDefault();
    canvasViewChanged.current = true;
    const bounds = canvas.current?.getBoundingClientRect();
    if (!bounds) return;
    const deltaPixels =
      event.deltaY *
      (event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? bounds.height
          : 1);
    const currentScale = canvasScaleRef.current;
    const nextScale = Math.min(
      maximumCanvasScale,
      Math.max(minimumCanvasScale, currentScale * Math.exp(-deltaPixels * 0.0025))
    );
    if (nextScale === currentScale) return;
    canvasScaleRef.current = nextScale;
    setCanvasScale(nextScale);
    setCanvasOffset((current) =>
      constrainCanvasOffset(
        canvasOffsetForZoom(
          current,
          { width: bounds.width, height: bounds.height },
          { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
          currentScale,
          nextScale
        ),
        nextScale
      )
    );
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (canvasMode !== 'interact' || (event.target as HTMLElement).closest('[data-canvas-ui]')) return;
    canvasViewChanged.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: canvasOffset.x,
      offsetY: canvasOffset.y
    };
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = canvasDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCanvasOffset(
      constrainCanvasOffset(
        { x: drag.offsetX + event.clientX - drag.startX, y: drag.offsetY + event.clientY - drag.startY },
        canvasScaleRef.current
      )
    );
  };

  const finishCanvasDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (canvasDrag.current?.pointerId === event.pointerId) canvasDrag.current = null;
  };

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
    if (!accessToken) return;
    void refreshSession();
    const interval = window.setInterval(() => void refreshSession(), 800);
    return () => window.clearInterval(interval);
  }, [accessToken, refreshSession]);

  useEffect(() => {
    if (!connectionUdid) return;
    canvasViewChanged.current = false;
    const frameId = window.requestAnimationFrame(fitCanvas);
    const observer = new ResizeObserver(() => {
      if (!canvasViewChanged.current) fitCanvas();
      else setCanvasOffset((current) => constrainCanvasOffset(current, canvasScaleRef.current));
    });
    if (canvas.current) observer.observe(canvas.current);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [connectionUdid, constrainCanvasOffset, fitCanvas]);

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
      (current) => current || simulators.find(({ state }) => state === 'Booted')?.udid || simulators[0]?.udid || ''
    );
  }, [simulators]);

  useEffect(
    () => () => {
      socket.current?.close();
    },
    []
  );

  const connectInput = useCallback(() => {
    if (!accessToken) return;
    socket.current?.close();
    const nextSocket = new WebSocket(
      `${window.location.origin.replace(/^http/, 'ws')}/v1/simulator/input?accessToken=${encodeURIComponent(accessToken)}`
    );
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
  }, [accessToken]);

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

  const selectVariant = async (variant: string) => {
    try {
      await request('/v1/simulator/variant', {
        method: 'POST',
        body: JSON.stringify({ variant })
      });
      setSelectedVariant(variant);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const captureAnnotation = async () => {
    try {
      setIsCapturingAnnotation(true);
      setIsSelectionMode(false);
      setSelectedAXPath(null);
      const response = await request<ScreenshotResponse>('/v1/simulator/screenshot');
      setAnnotationImage(response.image);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCapturingAnnotation(false);
    }
  };

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
    setAnnotationImage(null);
  };

  const changeSelectionMode = async (next: boolean) => {
    setIsSelectionMode(next);
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

  const sendTouch = (type: 'begin' | 'move' | 'end', event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = screenImage.current?.getBoundingClientRect();
    if (!bounds) return;
    const point = normalizedCanvasPoint({ x: event.clientX, y: event.clientY }, bounds);
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

  return (
    <div className="app-shell">
      <AppHeaderFrame
        actions={
          <output
            aria-live="polite"
            className="status"
          >
            {session ? sessionLabel(session.status) : 'Core online'}
          </output>
        }
        center={
          <div className="core-session-heading">
            <strong>Monad Design Core</strong>
            <span>{session?.project.name ?? 'Waiting for a coding agent'}</span>
          </div>
        }
      />
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
        ) : session.status === 'selecting_simulator' || !session.connection ? (
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
            task={session.task}
          />
        ) : (
          <LiveWorkspaceFrame
            canvas={
              <section
                aria-label="Live Simulator canvas"
                className={annotationImage ? 'core-annotation-surface' : `device-cluster canvas-mode-${canvasMode}`}
                data-canvas-ui={!annotationImage ? true : undefined}
                style={
                  annotationImage
                    ? undefined
                    : {
                        left: `calc(50% + ${canvasOffset.x}px)`,
                        top: `calc(50% + ${canvasOffset.y}px)`,
                        transform: `translate(-50%, -50%) scale(${canvasScale})`
                      }
                }
              >
                {annotationImage ? (
                  <AnnotationEditor
                    image={annotationImage}
                    isRecapturing={isCapturingAnnotation}
                    onClose={() => setAnnotationImage(null)}
                    onFinish={sendAnnotation}
                    onRecapture={() => void captureAnnotation()}
                  />
                ) : (
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
                    onKeyDown={isSelectionMode ? undefined : (event) => handleKey(event, 'down')}
                    onKeyUp={isSelectionMode ? undefined : (event) => handleKey(event, 'up')}
                    onPaste={isSelectionMode ? undefined : (event) => void handlePaste(event)}
                    onPointerCancel={isSelectionMode ? undefined : (event) => sendTouch('end', event)}
                    onPointerDown={
                      isSelectionMode
                        ? undefined
                        : (event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            sendTouch('begin', event);
                          }
                    }
                    onPointerMove={
                      isSelectionMode
                        ? undefined
                        : (event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) sendTouch('move', event);
                          }
                    }
                    onPointerUp={isSelectionMode ? undefined : (event) => sendTouch('end', event)}
                    onStreamError={() => {
                      setErrorMessage('The Simulator video stream stopped.');
                    }}
                    orientation={orientation}
                    overlay={
                      isSelectionMode && axSnapshot ? (
                        <div
                          className="core-ax-overlay"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {axSnapshot.elements.map((element) => (
                            <button
                              aria-label={`Select ${element.label || element.role || 'element'}`}
                              className="core-ax-element"
                              key={element.path}
                              onClick={() => setSelectedAXPath(element.path)}
                              style={{
                                left: `${(element.frame.x / axSnapshot.screen.width) * 100}%`,
                                top: `${(element.frame.y / axSnapshot.screen.height) * 100}%`,
                                width: `${(element.frame.width / axSnapshot.screen.width) * 100}%`,
                                height: `${(element.frame.height / axSnapshot.screen.height) * 100}%`,
                                pointerEvents: 'auto',
                                ...(selectedAXPath === element.path ? { borderWidth: 2 } : {})
                              }}
                              type="button"
                            />
                          ))}
                        </div>
                      ) : null
                    }
                    screenClassName={`phone-frame interactive canvas-phone device-${deviceFrame.kind} ${selectedSimulator?.deviceChrome ? 'native-device-chrome' : ''}`}
                    screenImageRef={screenImage}
                    streamUrl={`/v1/simulator/stream?accessToken=${encodeURIComponent(accessToken ?? '')}`}
                  />
                )}
              </section>
            }
            canvasProps={{
              className: canvasDrag.current ? 'dragging' : undefined,
              onPointerCancel: finishCanvasDrag,
              onPointerDown: handleCanvasPointerDown,
              onPointerMove: handleCanvasPointerMove,
              onPointerUp: finishCanvasDrag,
              onWheel: handleCanvasWheel,
              ref: canvas
            }}
            inspector={
              annotationImage ? null : (
                <>
                  <LiveWorkspaceInspector
                    agentError={error}
                    agentStatus={session.status}
                    confirmedVariant={session.confirmedSelection?.variant}
                    isBusy={isCapturingAnnotation}
                    isSendingRequest={isSendingAgentRequest}
                    mode={canvasMode === 'variants' ? 'variants' : isSelectionMode ? 'select' : 'interact'}
                    onAcceptVariant={() => {
                      if (selectedVariant) void confirmVariant(selectedVariant, 'confirming');
                    }}
                    onBeginSelection={() => void changeSelectionMode(true)}
                    onClearSelection={() => setSelectedAXPath(null)}
                    onDiscardVariant={() => void confirmVariant('original', 'discarding')}
                    onModeChange={(mode) => {
                      if (mode === 'annotate') {
                        setIsSelectionMode(false);
                        setSelectedAXPath(null);
                        void captureAnnotation();
                      } else {
                        void changeSelectionMode(mode === 'select');
                      }
                    }}
                    onRequestChange={setAgentRequest}
                    onSelectVariant={(variant) => void selectVariant(variant)}
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
                    variants={(session.changeRequest
                      ? simulatorVariantIdsForCount(session.changeRequest.variantCount)
                      : []
                    ).map((id) => ({ id, label: simulatorVariantLabels[id], ready: true }))}
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
              )
            }
            mode={canvasMode}
          />
        )}
      </main>
    </div>
  );
}
