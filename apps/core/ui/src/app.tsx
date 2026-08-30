import type { AgentSessionSnapshot, IOSSimulator } from '@monaddesign/client-contract';

import { deviceFrameMetrics } from '@monaddesign/device-frame';
import { AnnotationEditor, Button, Label, SimulatorCanvas, type SimulatorOrientation, Textarea } from '@monaddesign/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ActiveSessionResponse = { session: AgentSessionSnapshot | null };
type SimulatorsResponse = { simulators: IOSSimulator[] };
type ScreenshotResponse = { image: string };

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

const frame = (tag: number, payload: object) => {
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const value = new Uint8Array(body.length + 1);
  value[0] = tag;
  value.set(body, 1);
  return value;
};

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
  const [selectedUdid, setSelectedUdid] = useState('');
  const [selectedBundleIdentifier, setSelectedBundleIdentifier] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [annotationImage, setAnnotationImage] = useState<string | null>(null);
  const [isCapturingAnnotation, setIsCapturingAnnotation] = useState(false);
  const [orientation, setOrientation] = useState<SimulatorOrientation>('portrait');
  const [errorMessage, setErrorMessage] = useState(
    accessToken ? '' : 'Open this page from an active Design MCP session.'
  );
  const socket = useRef<WebSocket | null>(null);
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

  const refreshSession = useCallback(async () => {
    try {
      const response = await request<ActiveSessionResponse>('/v1/agent-session/active');
      setSession(response.session);
      if (response.session) {
        const simulatorResponse = await request<SimulatorsResponse>('/v1/simulators');
        setSimulators(simulatorResponse.simulators);
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
    if (session?.connection) connectInput();
  }, [connectInput, session?.connection]);

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

  const submitChangeRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.connection) return;
    const form = new FormData(event.currentTarget);
    try {
      const nextSession = await request<AgentSessionSnapshot>(
        `/v1/agent-session/${encodeURIComponent(session.id)}/request`,
        {
          method: 'POST',
          body: JSON.stringify({
            request: String(form.get('request') ?? '').trim(),
            variantCount: Number(form.get('variantCount') ?? 1),
            context: { simulator: session.connection }
          })
        }
      );
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const confirmVariant = async () => {
    if (!(session?.changeRequest && selectedVariant)) return;
    try {
      const nextSession = await request<AgentSessionSnapshot>(
        `/v1/agent-session/${encodeURIComponent(session.id)}/confirm-selection`,
        { method: 'POST', body: JSON.stringify({ requestId: session.changeRequest.id, variant: selectedVariant }) }
      );
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const captureAnnotation = async () => {
    try {
      setIsCapturingAnnotation(true);
      const response = await request<ScreenshotResponse>('/v1/simulator/screenshot');
      setAnnotationImage(response.image);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCapturingAnnotation(false);
    }
  };

  const sendTouch = (type: 'begin' | 'move' | 'end', event: React.PointerEvent<HTMLButtonElement>) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
    const normalized =
      orientation === 'landscape_left'
        ? { x: point.y, y: 1 - point.x }
        : orientation === 'landscape_right'
          ? { x: 1 - point.y, y: point.x }
          : orientation === 'portrait_upside_down'
            ? { x: 1 - point.x, y: 1 - point.y }
            : point;
    socket.current.send(frame(0x03, { type, ...normalized }));
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
      <header className="app-header">
        <div
          aria-hidden="true"
          className="brand-mark"
        >
          M
        </div>
        <div className="min-w-0">
          <strong>Monad Design Core</strong>
          <span>{session?.project.name ?? 'Waiting for a coding agent'}</span>
        </div>
        <output
          aria-live="polite"
          className="status"
        >
          {session ? sessionLabel(session.status) : 'Core online'}
        </output>
      </header>
      <main>
        {!session || session.status === 'configuring_project' ? (
          <section className="centered">
            <h1>Waiting for a coding agent</h1>
            <p className="lead">
              Connect any coding agent to the Design MCP. Core will bind the current workspace and open Simulator
              selection here when the session is ready.
            </p>
            {error}
          </section>
        ) : session.status === 'selecting_simulator' || !session.connection ? (
          <section className="centered">
            <h1>Choose the Simulator for {session.project.name}</h1>
            <p className="lead">
              This selection belongs to the active Design MCP session. Core will keep the canvas available even when the
              desktop client is closed.
            </p>
            <div className="picker-layout">
              <section
                aria-label="Available iOS Simulators"
                className="simulator-list"
              >
                {simulators.length ? (
                  simulators.map((simulator) => (
                    <Button
                      aria-pressed={simulator.udid === selectedUdid}
                      className="simulator-option"
                      key={simulator.udid}
                      onClick={() => setSelectedUdid(simulator.udid)}
                      type="button"
                      variant="outline"
                    >
                      <span className={`state-dot ${simulator.state === 'Booted' ? 'booted' : ''}`} />
                      <span>
                        <strong>{simulator.name}</strong>
                        <small>{simulator.runtime}</small>
                      </span>
                      <small>{simulator.state}</small>
                    </Button>
                  ))
                ) : (
                  <p className="secondary">
                    No iOS Simulators were found. Start one in Xcode, then keep this page open.
                  </p>
                )}
              </section>
              <div className="picker-actions">
                <Label htmlFor="target-app">Target app</Label>
                <select
                  id="target-app"
                  onChange={(event) => setSelectedBundleIdentifier(event.target.value)}
                  value={selectedBundleIdentifier}
                >
                  {session.project.targetApps.map((target) => (
                    <option
                      key={target.bundleIdentifier}
                      value={target.bundleIdentifier}
                    >
                      {target.name}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!selectedUdid || !selectedBundleIdentifier}
                  onClick={() => void connectSimulator()}
                >
                  Open canvas
                </Button>
                {error}
              </div>
            </div>
          </section>
        ) : (
          <div className="workspace">
            <section
              aria-label="Live Simulator canvas"
              className="canvas"
            >
              {annotationImage ? (
                <AnnotationEditor
                  image={annotationImage}
                  isRecapturing={isCapturingAnnotation}
                  onClose={() => setAnnotationImage(null)}
                  onRecapture={() => void captureAnnotation()}
                />
              ) : (
                <SimulatorCanvas
                  ariaLabel="Interact with the connected Simulator"
                  className="device"
                  deviceChrome={selectedSimulator?.deviceChrome}
                  deviceFrame={deviceFrame}
                  deviceHeight={screen.height}
                  deviceWidth={screen.width}
                  framebufferMask={selectedSimulator?.framebufferMask}
                  onPointerCancel={(event) => sendTouch('end', event)}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    sendTouch('begin', event);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) sendTouch('move', event);
                  }}
                  onPointerUp={(event) => sendTouch('end', event)}
                  orientation={orientation}
                  screenClassName="screen"
                  streamUrl={`/v1/simulator/stream?accessToken=${encodeURIComponent(accessToken ?? '')}`}
                />
              )}
            </section>
            <aside className="inspector">
              <section>
                <h2>{session.project.name}</h2>
                <p className="secondary">{session.connection.bundleIdentifier}</p>
                <p>{sessionLabel(session.status)}</p>
              </section>
              <Button
                disabled={isCapturingAnnotation}
                onClick={() => void captureAnnotation()}
                type="button"
                variant="secondary"
              >
                Annotate screen
              </Button>
              {session.status === 'awaiting_request' ? (
                <section>
                  <h2>Request a change</h2>
                  <form onSubmit={(event) => void submitChangeRequest(event)}>
                    <Label htmlFor="change-request">Describe the result</Label>
                    <Textarea
                      id="change-request"
                      name="request"
                      placeholder="Increase the title contrast…"
                      required
                    />
                    <Label htmlFor="variant-count">Variants</Label>
                    <select
                      defaultValue="1"
                      id="variant-count"
                      name="variantCount"
                    >
                      <option>1</option>
                      <option>2</option>
                      <option>3</option>
                      <option>4</option>
                      <option>5</option>
                    </select>
                    <Button type="submit">Send to agent</Button>
                  </form>
                </section>
              ) : null}
              {session.status === 'variants_ready' && session.changeRequest ? (
                <section>
                  <h2>Review variants</h2>
                  <p className="secondary">
                    Launch a variant in the live Simulator, then confirm the one the agent should apply.
                  </p>
                  <div className="variant-grid">
                    {[
                      'original',
                      ...Array.from({ length: session.changeRequest.variantCount }, (_, index) => `v${index + 1}`)
                    ].map((variant) => (
                      <Button
                        aria-pressed={variant === selectedVariant}
                        key={variant}
                        onClick={async () => {
                          try {
                            await request('/v1/simulator/variant', {
                              method: 'POST',
                              body: JSON.stringify({ variant })
                            });
                            setSelectedVariant(variant);
                          } catch (error) {
                            setErrorMessage(error instanceof Error ? error.message : String(error));
                          }
                        }}
                        type="button"
                        variant="outline"
                      >
                        {variant === 'original' ? 'Original' : `Variant ${variant.slice(1)}`}
                      </Button>
                    ))}
                  </div>
                  <Button
                    disabled={!selectedVariant}
                    onClick={() => void confirmVariant()}
                  >
                    Confirm selection
                  </Button>
                </section>
              ) : null}
              {session.status === 'working' || session.status === 'change_requested' ? (
                <p
                  aria-live="polite"
                  className="secondary"
                >
                  The coding agent is working. This page can remain open while other clients disconnect.
                </p>
              ) : null}
              {error}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
