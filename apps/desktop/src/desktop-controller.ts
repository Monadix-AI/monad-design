import type {
  AgentSessionSnapshot,
  AXSnapshot,
  IOSSimulator,
  MonadDesignProject,
  SimulatorVariantId
} from './electron';

import { ClientApi } from '@monaddesign/client-rtk';
import {
  accessibilityElementAtPoint,
  accessibilityElementName as axElementName,
  buildAgentTurnContext,
  encodeSimulatorFrame,
  normalizedCanvasPoint,
  orientCanvasPoint,
  rotatedSimulatorOrientation,
  serializeAgentTurn,
  simulatorKeyUsage
} from '@monaddesign/simulator';
import {
  parseSimulatorHistory,
  recordUsedSimulator,
  simulatorHistoryKey,
  sortSimulatorsForProject
} from '@monaddesign/simulator-history';
import { workspaceStore } from '@monaddesign/state';
import { liveSimulatorDeviceFrame, useCanvasViewport } from '@monaddesign/ui';
import { useNavigate } from '@tanstack/react-router';
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useStore } from 'zustand';

import {
  type ActiveConnection,
  canvasScaleStep,
  maximumCanvasScale,
  minimumCanvasScale,
  orientations,
  type SimulatorAppearance,
  type SimulatorOrientation,
  type VariantCapture,
  variantIds,
  variantIdsForCount,
  variantLabels
} from './desktop-model';
import { captureStableSimulatorScreen } from './lib/variant-capture';

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Something went wrong.';
};

const readSimulatorHistory = () => {
  try {
    return parseSimulatorHistory(window.localStorage.getItem(simulatorHistoryKey));
  } catch {
    return {};
  }
};

const writeSimulatorHistory = (history: ReturnType<typeof readSimulatorHistory>) => {
  try {
    window.localStorage.setItem(simulatorHistoryKey, JSON.stringify(history));
  } catch {
    // History should never block an otherwise successful connection.
  }
};

export function useDesktopController() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MonadDesignProject[]>([]);
  const [activeProject, setActiveProject] = useState<MonadDesignProject | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [removingProjectId, setRemovingProjectId] = useState<string | null>(null);
  const [simulators, setSimulators] = useState<IOSSimulator[]>([]);
  const [usedSimulatorUdids, setUsedSimulatorUdids] = useState<string[]>([]);
  const orderedSimulators = useMemo(
    () => sortSimulatorsForProject(simulators, usedSimulatorUdids),
    [simulators, usedSimulatorUdids]
  );
  const [selectedUdid, setSelectedUdid] = useState('');
  const [selectedTargetBundleIdentifier, setSelectedTargetBundleIdentifier] = useState('');
  const [connection, setConnection] = useState<ActiveConnection | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const isAXTreeOpen = useStore(workspaceStore, (state) => state.selectionMode);
  const setIsAXTreeOpen = useStore(workspaceStore, (state) => state.setSelectionMode);
  const [axSnapshot, setAXSnapshot] = useState<AXSnapshot | null>(null);
  const [axError, setAXError] = useState<string | null>(null);
  const selectedAXPath = useStore(workspaceStore, (state) => state.selectedElementPath);
  const setSelectedAXPath = useStore(workspaceStore, (state) => state.setSelectedElementPath);
  const [hoveredAXPath, setHoveredAXPath] = useState<string | null>(null);
  const agentRequest = useStore(workspaceStore, (state) => state.agentRequest);
  const setAgentRequest = useStore(workspaceStore, (state) => state.setAgentRequest);
  const copyStatus = useStore(workspaceStore, (state) => state.copyStatus);
  const setCopyStatus = useStore(workspaceStore, (state) => state.setCopyStatus);
  const resetWorkspaceState = useStore(workspaceStore, (state) => state.resetWorkspaceState);
  const [appearance, setAppearance] = useState<SimulatorAppearance | null>(null);
  const [isAppearanceChanging, setIsAppearanceChanging] = useState(false);
  const [orientation, setOrientation] = useState<SimulatorOrientation>('portrait');
  const [screenSize, setScreenSize] = useState({ width: 390, height: 844 });
  const [logicalScreenSize, setLogicalScreenSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [variantCaptures, setVariantCaptures] = useState<VariantCapture[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SimulatorVariantId | null>(null);
  const [capturingVariant, setCapturingVariant] = useState<SimulatorVariantId | null>(null);
  const [isVariantPreviewOpen, setIsVariantPreviewOpen] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [activePreviewVariant, setActivePreviewVariant] = useState<SimulatorVariantId | null>(null);
  const [variantTransition, setVariantTransition] = useState<
    'opening' | 'restoring' | 'confirming' | 'discarding' | null
  >(null);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [pointerPosition, setPointerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteClient, setRemoteClient] = useState<{
    port: number;
    pairingCode: string;
    addresses: string[];
  } | null>(null);
  const [runtimeClient, setRuntimeClient] = useState<ClientApi | null>(null);
  const [activeAgentSession, setActiveAgentSession] = useState<AgentSessionSnapshot | null>(null);
  const [isSendingAgentRequest, setIsSendingAgentRequest] = useState(false);
  const [variantCount, setVariantCount] = useState(1);
  const [agentSessionError, setAgentSessionError] = useState<string | null>(null);
  const [pendingAutoCapture, setPendingAutoCapture] = useState<{ requestId: string; count: number } | null>(null);
  const pointerActive = useRef(false);
  const lastPointerMove = useRef(0);
  const screenImage = useRef<HTMLImageElement | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const openedAgentSessionId = useRef<string | null>(null);

  useEffect(() => {
    resetWorkspaceState();
    return resetWorkspaceState;
  }, [resetWorkspaceState]);

  const scan = useCallback(async () => {
    if (!runtimeClient) return;
    setIsScanning(true);
    setError(null);
    try {
      const detected = await runtimeClient.simulators();
      setSimulators(detected);
    } catch (scanError) {
      setError(errorMessage(scanError));
    } finally {
      setIsScanning(false);
    }
  }, [runtimeClient]);

  useEffect(() => {
    setSelectedUdid((current) =>
      orderedSimulators.some(({ udid }) => udid === current) ? current : (orderedSimulators[0]?.udid ?? '')
    );
  }, [orderedSimulators]);

  useEffect(() => {
    const bootstrap = async () => {
      if (window.client?.core) return window.client.core.bootstrap();
      throw new Error('The Electron client bridge is not available.');
    };

    void bootstrap()
      .then(async (bootstrap) => {
        const client = new ClientApi(bootstrap, 'desktop');
        setProjects((await client.adminProjects()) as MonadDesignProject[]);
        setRuntimeClient(client);
      })
      .catch((startupError) => setError(errorMessage(startupError)))
      .finally(() => setIsLoadingProjects(false));
    void window.client?.core.status().then(setRemoteClient);
  }, []);

  const activateProject = async (project: MonadDesignProject) => {
    setIsOpeningProject(true);
    setError(null);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      const opened = (await runtimeClient.openAdminProject(project.id)) as MonadDesignProject;
      setActiveProject(opened);
      setUsedSimulatorUdids(readSimulatorHistory()[opened.id] ?? []);
      setSelectedTargetBundleIdentifier(opened.targetApps[0]?.bundleIdentifier ?? '');
      setProjects((current) => [opened, ...current.filter(({ id }) => id !== opened.id)]);
      setSimulators([]);
      setSelectedUdid('');
      await scan();
    } catch (projectError) {
      setError(errorMessage(projectError));
    } finally {
      setIsOpeningProject(false);
    }
  };

  useEffect(() => {
    if (!runtimeClient) return;
    const receiveSession = (session: AgentSessionSnapshot) => {
      setActiveAgentSession(session.status === 'closed' ? null : session);
      if (session.status === 'variants_ready' && session.changeRequest) {
        setPendingAutoCapture({ requestId: session.changeRequest.id, count: session.changeRequest.variantCount });
      }
      if (session.status === 'selection_confirmed') {
        setIsVariantPreviewOpen(false);
      }
      if (session.status === 'awaiting_request' && session.lastResult) {
        setVariantCaptures([]);
        setSelectedVariant(null);
        setActivePreviewVariant(null);
        setIsVariantPreviewOpen(false);
      }
      if (session.status !== 'selecting_simulator' || !runtimeClient || openedAgentSessionId.current === session.id) {
        return;
      }
      openedAgentSessionId.current = session.id;
      void (async () => {
        try {
          await runtimeClient.disconnect().catch(() => undefined);
          setConnection(null);
          setIsStreamReady(false);
          const project = (await runtimeClient.openAdminProject(session.project.id)) as MonadDesignProject;
          setActiveProject(project);
          setProjects((current) => [project, ...current.filter(({ id }) => id !== project.id)]);
          setUsedSimulatorUdids(readSimulatorHistory()[project.id] ?? []);
          setSelectedTargetBundleIdentifier(project.targetApps[0]?.bundleIdentifier ?? '');
          setSimulators([]);
          setSelectedUdid('');
          setError(null);
          await navigate({ to: '/' });
          await scan();
        } catch (sessionError) {
          setAgentSessionError(errorMessage(sessionError));
        }
      })();
    };

    let active = true;
    let lastRevision = 0;
    const poll = async () => {
      try {
        const { session } = await runtimeClient.activeAgentSession();
        if (active && session && session.revision !== lastRevision) {
          lastRevision = session.revision;
          receiveSession(session);
        }
      } catch {
        // Core restarts and transient session gaps are retried by the next poll.
      }
    };
    const unsubscribe = window.client?.core.subscribeToAgentSession(receiveSession);
    void poll();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [navigate, runtimeClient, scan]);

  const chooseProject = async () => {
    setIsOpeningProject(true);
    setError(null);
    try {
      return await window.client.projects.choose();
    } catch (projectError) {
      setError(errorMessage(projectError));
      return null;
    } finally {
      setIsOpeningProject(false);
    }
  };

  const detectProjectTargets = useCallback(
    async (path: string) => {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      return runtimeClient.detectProjectTargets(path);
    },
    [runtimeClient]
  );

  const projectIcons = useCallback(
    async (id: string) => {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      return runtimeClient.projectIcons(id);
    },
    [runtimeClient]
  );

  const addProject = async (
    path: string,
    targetApps: Array<{
      bundleIdentifier: string;
      name: string;
      sourcePath?: string;
    }>
  ) => {
    setIsOpeningProject(true);
    setError(null);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      const project = (await runtimeClient.addAdminProject({ path, targetApps })) as MonadDesignProject;
      setActiveProject(project);
      setUsedSimulatorUdids(readSimulatorHistory()[project.id] ?? []);
      setSelectedTargetBundleIdentifier(project.targetApps[0]?.bundleIdentifier ?? '');
      setProjects((current) => [project, ...current.filter(({ id }) => id !== project.id)]);
      setSimulators([]);
      setSelectedUdid('');
      await scan();
    } catch (projectError) {
      setError(errorMessage(projectError));
      throw projectError;
    } finally {
      setIsOpeningProject(false);
    }
  };

  const configureProject = async (
    id: string,
    targetApps: Array<{
      bundleIdentifier: string;
      name: string;
      sourcePath?: string;
    }>
  ) => {
    setIsOpeningProject(true);
    setError(null);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      const project = (await runtimeClient.configureAdminProject(id, { targetApps })) as MonadDesignProject;
      setProjects((current) => [project, ...current.filter(({ id: projectId }) => projectId !== project.id)]);
      setActiveProject(project);
      setUsedSimulatorUdids(readSimulatorHistory()[project.id] ?? []);
      setSelectedTargetBundleIdentifier(project.targetApps[0]?.bundleIdentifier ?? '');
      setSimulators([]);
      setSelectedUdid('');
      await scan();
    } catch (projectError) {
      setError(errorMessage(projectError));
      throw projectError;
    } finally {
      setIsOpeningProject(false);
    }
  };

  const removeProject = async (project: MonadDesignProject) => {
    setRemovingProjectId(project.id);
    setError(null);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      await runtimeClient.removeAdminProject(project.id);
      setProjects((current) => current.filter(({ id }) => id !== project.id));
    } catch (projectError) {
      setError(errorMessage(projectError));
    } finally {
      setRemovingProjectId(null);
    }
  };

  const closeProject = () => {
    setActiveProject(null);
    setSimulators([]);
    setUsedSimulatorUdids([]);
    setSelectedUdid('');
    setSelectedTargetBundleIdentifier('');
    setError(null);
  };

  useEffect(() => {
    setAXSnapshot(null);
    setAXError(null);
    setSelectedAXPath(null);
    setHoveredAXPath(null);
    if (!connection) return;
    const ws = new WebSocket(connection.wsUrl);
    ws.binaryType = 'arraybuffer';
    socket.current = ws;
    ws.addEventListener('open', () => setError(null));
    ws.addEventListener('error', () => setError('The simulator input channel could not be opened.'));
    ws.addEventListener('message', (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const frame = new Uint8Array(event.data);
      if (frame[0] !== 130) return;
      try {
        const config = JSON.parse(new TextDecoder().decode(frame.subarray(1))) as {
          height?: unknown;
          orientation?: unknown;
          width?: unknown;
        };
        if (
          typeof config.width === 'number' &&
          typeof config.height === 'number' &&
          config.width > 0 &&
          config.height > 0
        ) {
          setScreenSize({ width: config.width, height: config.height });
        }
        if (
          typeof config.orientation === 'string' &&
          orientations.includes(config.orientation as SimulatorOrientation)
        ) {
          setOrientation(config.orientation as SimulatorOrientation);
        }
      } catch {
        // Ignore malformed stream configuration frames.
      }
    });
    return () => {
      socket.current = null;
      ws.close();
    };
  }, [connection, setSelectedAXPath]);

  useEffect(() => {
    if (!connection || !isAXTreeOpen || !runtimeClient) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const snapshot = await runtimeClient.accessibility();
        if (cancelled) return;
        setAXSnapshot(snapshot);
        setAXError(snapshot.errors?.[0] ?? null);
        setSelectedAXPath((current) =>
          current && snapshot.elements.some(({ path }) => path === current) ? current : null
        );
      } catch (snapshotError) {
        if (!cancelled) setAXError(errorMessage(snapshotError));
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [connection, isAXTreeOpen, runtimeClient, setSelectedAXPath]);

  const connect = async () => {
    if (!selectedUdid || !activeProject || !selectedTargetBundleIdentifier || !runtimeClient) return;
    setIsConnecting(true);
    setIsStreamReady(false);
    setError(null);
    try {
      const selectedSimulator = orderedSimulators.find(({ udid }) => udid === selectedUdid);
      const connectedRuntime = await runtimeClient.connect(
        activeProject.id,
        selectedUdid,
        selectedTargetBundleIdentifier
      );
      if (selectedSimulator?.screen && selectedSimulator.screen.scale > 0) {
        setScreenSize({
          width: selectedSimulator.screen.width / selectedSimulator.screen.scale,
          height: selectedSimulator.screen.height / selectedSimulator.screen.scale
        });
        setDevicePixelRatio(1);
      }
      const nextHistory = recordUsedSimulator(readSimulatorHistory(), activeProject.id, selectedUdid);
      setUsedSimulatorUdids(nextHistory[activeProject.id] ?? []);
      writeSimulatorHistory(nextHistory);
      const nextConnection: ActiveConnection = {
        udid: connectedRuntime.udid,
        projectId: connectedRuntime.projectId,
        bundleIdentifier: connectedRuntime.bundleIdentifier,
        streamUrl: runtimeClient.streamUrl(connectedRuntime.streamPath),
        wsUrl: runtimeClient.inputUrl(connectedRuntime.inputPath),
        orientation: connectedRuntime.orientation ?? 'portrait'
      };
      setOrientation(nextConnection.orientation);
      setConnection(nextConnection);
      if (
        activeAgentSession?.status === 'selecting_simulator' &&
        activeAgentSession.project.id === nextConnection.projectId
      ) {
        setActiveAgentSession(
          await runtimeClient.connectAgentSession(activeAgentSession.id, {
            udid: nextConnection.udid,
            bundleIdentifier: nextConnection.bundleIdentifier
          })
        );
      }
      await navigate({ to: '/workspace' });
      setAppearance((await runtimeClient.appearance().catch(() => null))?.appearance ?? null);
      const snapshot = await runtimeClient.accessibility().catch(() => null);
      if (snapshot && snapshot.screen.width > 1 && snapshot.screen.height > 1) {
        setLogicalScreenSize(snapshot.screen);
      }
    } catch (connectError) {
      await runtimeClient.disconnect().catch(() => undefined);
      setConnection(null);
      setError(errorMessage(connectError));
      void navigate({ to: '/' });
      void scan();
    } finally {
      setIsConnecting(false);
    }
  };

  const connected = orderedSimulators.find(({ udid }) => udid === connection?.udid);
  const isLandscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  useEffect(() => {
    if (!logicalScreenSize || devicePixelRatio !== 1 || screenSize.width < 500) return;
    const widthRatio = screenSize.width / logicalScreenSize.width;
    const heightRatio = screenSize.height / logicalScreenSize.height;
    const ratio = (widthRatio + heightRatio) / 2;
    if (ratio > 1.25 && ratio < 4.25) setDevicePixelRatio(ratio);
  }, [devicePixelRatio, logicalScreenSize, screenSize]);
  const deviceWidth = (isLandscape ? screenSize.height : screenSize.width) / devicePixelRatio;
  const deviceHeight = (isLandscape ? screenSize.width : screenSize.height) / devicePixelRatio;
  const deviceFrame = liveSimulatorDeviceFrame({
    deviceChrome: connected?.deviceChrome,
    deviceHeight,
    deviceName: connected?.name ?? 'iOS Simulator',
    deviceWidth,
    orientation
  });
  const canvasMode = isAnnotationMode ? 'annotate' : isVariantPreviewOpen ? 'variants' : 'interact';
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
  } = useCanvasViewport({ deviceFrame, mode: canvasMode, resetKey: connection?.udid });
  const sendFrame = (tag: number, payload: object) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('The simulator input channel is not ready yet.');
      return false;
    }
    ws.send(encodeSimulatorFrame(tag, payload));
    return true;
  };
  const pointFromEvent = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = screenImage.current?.getBoundingClientRect();
    if (!bounds) return null;
    return normalizedCanvasPoint({ x: event.clientX, y: event.clientY }, bounds);
  };
  const sendTouch = (type: 'begin' | 'move' | 'end', event: PointerEvent<HTMLButtonElement>) => {
    const point = pointFromEvent(event);
    if (!point) return false;
    const simulatorPoint = orientCanvasPoint(point, orientation);
    return sendFrame(0x03, { type, ...simulatorPoint });
  };
  const updatePointer = (event: PointerEvent<HTMLButtonElement>) => {
    const point = pointFromEvent(event);
    setPointerPosition(point);
    if (isAXTreeOpen && axSnapshot && point) {
      setHoveredAXPath(accessibilityElementAtPoint(axSnapshot, point)?.path ?? null);
    } else {
      setHoveredAXPath(null);
    }
    return point;
  };
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!connected) return;
    event.currentTarget.focus();
    const point = updatePointer(event);
    if (isAXTreeOpen) {
      setSelectedAXPath(point && axSnapshot ? (accessibilityElementAtPoint(axSnapshot, point)?.path ?? null) : null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActive.current = sendTouch('begin', event);
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    updatePointer(event);
    if (isAXTreeOpen || !pointerActive.current || performance.now() - lastPointerMove.current < 8) return;
    lastPointerMove.current = performance.now();
    sendTouch('move', event);
  };
  const finishPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerActive.current) sendTouch('end', event);
    pointerActive.current = false;
    setPointerPosition(pointFromEvent(event));
  };
  const leavePointer = () => {
    if (!pointerActive.current) setPointerPosition(null);
    setHoveredAXPath(null);
  };
  const sendKey = (usage: number, type: 'down' | 'up') => sendFrame(0x06, { type, usage });
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, type: 'down' | 'up') => {
    if (!connected || (event.metaKey && event.code === 'KeyV')) return;
    const usage = simulatorKeyUsage(event.code);
    if (usage === undefined) return;
    event.preventDefault();
    sendKey(usage, type);
  };
  const pasteText = async (text: string) => {
    if (!text) return;
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      await runtimeClient.setPasteboard(text);
      sendKey(227, 'down');
      sendKey(25, 'down');
      sendKey(25, 'up');
      sendKey(227, 'up');
      setError(null);
    } catch (pasteError) {
      setError(errorMessage(pasteError));
    }
  };
  const handlePaste = (event: ClipboardEvent<HTMLButtonElement>) => {
    if (!connected) return;
    event.preventDefault();
    void pasteText(event.clipboardData.getData('text'));
  };
  const disconnect = () => {
    setConnection(null);
    void navigate({ to: '/' });
    setIsStreamReady(false);
    setIsAXTreeOpen(false);
    setVariantCaptures([]);
    setSelectedVariant(null);
    setCapturingVariant(null);
    setIsVariantPreviewOpen(false);
    setVariantError(null);
    setActivePreviewVariant(null);
    setVariantTransition(null);
    setIsAnnotationMode(false);
    setAppearance(null);
    setOrientation('portrait');
    setScreenSize({ width: 390, height: 844 });
    setLogicalScreenSize(null);
    setDevicePixelRatio(1);
    setPointerPosition(null);
    if (runtimeClient) void runtimeClient.disconnect().catch(() => undefined);
  };
  const rotate = (direction: 'left' | 'right') => {
    const nextOrientation = rotatedSimulatorOrientation(orientation, direction);
    if (sendFrame(0x07, { orientation: nextOrientation })) {
      setOrientation(nextOrientation);
    }
  };
  const changeAppearance = async (nextAppearance: SimulatorAppearance) => {
    if (nextAppearance === appearance || isAppearanceChanging) return;
    setIsAppearanceChanging(true);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      await runtimeClient.setAppearance(nextAppearance);
      setAppearance(nextAppearance);
      setError(null);
    } catch (appearanceError) {
      setError(errorMessage(appearanceError));
    } finally {
      setIsAppearanceChanging(false);
    }
  };
  const selectedAXElement = axSnapshot?.elements.find(({ path }) => path === selectedAXPath);
  const agentTurnContext =
    connected && (connection?.bundleIdentifier ?? activeAgentSession?.connection?.bundleIdentifier)
      ? buildAgentTurnContext({
          bundleIdentifier: connection?.bundleIdentifier ?? activeAgentSession?.connection?.bundleIdentifier ?? '',
          element: selectedAXElement,
          snapshot: axSnapshot ?? undefined,
          simulator: connected
        })
      : null;
  const agentTurnPayload =
    agentTurnContext && agentRequest.trim() ? serializeAgentTurn(agentRequest, agentTurnContext) : '';
  const copyAgentTurnPayload = async () => {
    if (!agentTurnPayload) return;
    try {
      await navigator.clipboard.writeText(agentTurnPayload);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };
  const sendAgentRequest = async () => {
    if (
      activeAgentSession?.status !== 'awaiting_request' ||
      !agentRequest.trim() ||
      !agentTurnContext ||
      !runtimeClient
    ) {
      return;
    }
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      let context = agentTurnContext;
      if (!selectedAXElement) {
        if (!runtimeClient || !connected) throw new Error('The current Simulator screen is not available.');
        const currentSnapshot = await runtimeClient.accessibility();
        setAXSnapshot(currentSnapshot);
        context = buildAgentTurnContext({
          bundleIdentifier: context.simulator.bundleIdentifier,
          snapshot: currentSnapshot,
          simulator: connected
        });
      }
      setActiveAgentSession(
        await runtimeClient.submitAgentRequest(activeAgentSession.id, {
          request: agentRequest,
          variantCount,
          context
        })
      );
      setAgentRequest('');
      setVariantCount(1);
    } catch (sessionError) {
      setAgentSessionError(errorMessage(sessionError));
    } finally {
      setIsSendingAgentRequest(false);
    }
  };
  const sendAnnotatedAgentRequest = async (annotationScreenshot: string) => {
    const session = activeAgentSession;
    if (session?.status !== 'awaiting_request' || !session.connection || !connected || !runtimeClient) {
      throw new Error('Start Live and wait until the agent is ready before finishing the annotation.');
    }
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      const currentSnapshot = await runtimeClient.accessibility();
      setAXSnapshot(currentSnapshot);
      const context = buildAgentTurnContext({
        bundleIdentifier: session.connection.bundleIdentifier,
        snapshot: currentSnapshot,
        simulator: connected
      });
      const next = await runtimeClient.submitAgentRequest(session.id, {
        request: agentRequest.trim() || 'Implement the changes shown in the attached annotated screenshot.',
        variantCount,
        context,
        annotationScreenshot
      });
      setActiveAgentSession(next);
      setAgentRequest('');
      setVariantCount(1);
    } catch (sessionError) {
      const message = errorMessage(sessionError);
      setAgentSessionError(message);
      throw new Error(message);
    } finally {
      setIsSendingAgentRequest(false);
    }
  };
  const captureVariants = useCallback(
    async (variants: SimulatorVariantId[] = variantIds) => {
      if (!connection || !runtimeClient || capturingVariant || variantTransition) return;
      setVariantError(null);
      setVariantCaptures([]);
      setSelectedVariant(null);
      setActivePreviewVariant(null);
      setIsVariantPreviewOpen(true);

      const captures: VariantCapture[] = [];
      let previewLaunchStarted = false;
      try {
        for (const variant of variants) {
          setCapturingVariant(variant);
          await runtimeClient.launchVariant(variant);
          previewLaunchStarted = true;
          captures.push({
            id: variant,
            image: await captureStableSimulatorScreen(runtimeClient, variant, selectedAXElement),
            orientation
          });
          setVariantCaptures([...captures]);
        }
      } catch (captureError) {
        setVariantError(errorMessage(captureError));
      } finally {
        if (previewLaunchStarted) {
          try {
            await runtimeClient.launchApp();
          } catch (restoreError) {
            setVariantError((current) => {
              const message = `Could not restart the app normally: ${errorMessage(restoreError)}`;
              return current ? `${current} ${message}` : message;
            });
          }
        }
        setCapturingVariant(null);
      }
    },
    [capturingVariant, connection, orientation, runtimeClient, selectedAXElement, variantTransition]
  );
  useEffect(() => {
    if (!pendingAutoCapture || !connection || !runtimeClient) return;
    setPendingAutoCapture(null);
    void captureVariants(variantIdsForCount(pendingAutoCapture.count));
  }, [captureVariants, connection, pendingAutoCapture, runtimeClient]);
  const openSelectedVariant = async () => {
    if (!connection || !runtimeClient || !selectedVariant || variantTransition) return;
    setVariantError(null);
    setVariantTransition('opening');
    try {
      await runtimeClient.launchVariant(selectedVariant);
      setActivePreviewVariant(selectedVariant);
      setIsVariantPreviewOpen(false);
    } catch (launchError) {
      setVariantError(errorMessage(launchError));
    } finally {
      setVariantTransition(null);
    }
  };
  const confirmSelectedVariant = async () => {
    const requestId = activeAgentSession?.changeRequest?.id;
    if (
      activeAgentSession?.status !== 'variants_ready' ||
      !requestId ||
      !selectedVariant ||
      variantTransition ||
      !runtimeClient
    ) {
      return;
    }
    setVariantError(null);
    setVariantTransition('confirming');
    try {
      setActiveAgentSession(
        await runtimeClient.confirmAgentSelection(activeAgentSession.id, { requestId, variant: selectedVariant })
      );
      setIsVariantPreviewOpen(false);
    } catch (selectionError) {
      setVariantError(errorMessage(selectionError));
    } finally {
      setVariantTransition(null);
    }
  };
  const discardAgentChange = async () => {
    const requestId = activeAgentSession?.changeRequest?.id;
    if (activeAgentSession?.status !== 'variants_ready' || !requestId || variantTransition || !runtimeClient) return;
    setVariantError(null);
    setSelectedVariant('original');
    setVariantTransition('discarding');
    try {
      setActiveAgentSession(
        await runtimeClient.confirmAgentSelection(activeAgentSession.id, { requestId, variant: 'original' })
      );
      setActivePreviewVariant(null);
      setIsVariantPreviewOpen(false);
    } catch (selectionError) {
      setVariantError(errorMessage(selectionError));
    } finally {
      setVariantTransition(null);
    }
  };
  const discardVariantPreview = async () => {
    if (!connection || !runtimeClient || variantTransition) return;
    setVariantError(null);
    setVariantTransition('restoring');
    try {
      await runtimeClient.launchApp();
    } catch (discardError) {
      setError(`Could not restore the original app state: ${errorMessage(discardError)}`);
    } finally {
      setVariantCaptures([]);
      setSelectedVariant(null);
      setActivePreviewVariant(null);
      setIsVariantPreviewOpen(false);
      setVariantTransition(null);
    }
  };
  const toggleVariantPreview = async () => {
    if (!isVariantPreviewOpen) {
      setIsVariantPreviewOpen(true);
      return;
    }

    await discardVariantPreview();
  };
  const openAnnotation = () => {
    if (!connection || isAnnotationMode) return;
    beginAnnotationCanvasView();
    setIsAnnotationMode(true);
    setIsAXTreeOpen(false);
    setSelectedAXPath(null);
    setPointerPosition(null);
  };
  const captureSimulatorImage = async () => {
    if (!connection || !runtimeClient) throw new Error('The Simulator is not available.');
    return (await runtimeClient.screenshot()).image;
  };
  const closeAnnotation = () => {
    setIsAnnotationMode(false);
    restoreAnnotationCanvasView();
  };
  const changeWorkspaceMode = (value: string) => {
    if (!value) return;
    if (value === 'annotate') {
      openAnnotation();
      return;
    }
    if (isAnnotationMode) closeAnnotation();
    setIsAXTreeOpen(value === 'select');
  };

  return {
    activeProject,
    activeAgentSession,
    activateProject,
    addProject,
    activePreviewVariant,
    agentRequest,
    agentSessionError,
    appearance,
    axElementName,
    axError,
    axSnapshot,
    canvas,
    canvasOffset,
    canvasScale,
    canvasScaleStep,
    canvasViewChanged,
    captureSimulatorImage,
    captureVariants,
    capturingVariant,
    changeAppearance,
    changeCanvasScale,
    changeWorkspaceMode,
    confirmSelectedVariant,
    closeAnnotation,
    chooseProject,
    agentTurnPayload,
    closeProject,
    connect,
    configureProject,
    connected,
    connection,
    copyAgentTurnPayload,
    copyStatus,
    detectProjectTargets,
    deviceHeight,
    deviceFrame,
    deviceWidth,
    discardAgentChange,
    discardVariantPreview,
    disconnect,
    error,
    finishCanvasDrag,
    finishPointer,
    fitCanvas,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasWheel,
    handleKey,
    handlePaste,
    handlePointerDown,
    handlePointerMove,
    hoveredAXPath,
    isAppearanceChanging,
    isAXTreeOpen,
    isAnnotationMode,
    isCanvasDragging,
    isConnecting,
    isLandscape,
    isLoadingProjects,
    isOpeningProject,
    isScanning,
    isSendingAgentRequest,
    isStreamReady,
    isVariantPreviewOpen,
    leavePointer,
    maximumCanvasScale,
    minimumCanvasScale,
    openSelectedVariant,
    orientation,
    pointerActive,
    pointerPosition,
    projectIcons,
    projects,
    remoteClient,
    removeProject,
    removingProjectId,
    rotate,
    scan,
    screenImage,
    screenSize,
    selectedAXElement,
    selectedAXPath,
    selectedUdid,
    selectedTargetBundleIdentifier,
    selectedVariant,
    sendAnnotatedAgentRequest,
    sendAgentRequest,
    sendFrame,
    setAgentRequest,
    setAXTreeOpen: setIsAXTreeOpen,
    setCopyStatus,
    setError,
    setIsStreamReady,
    setSelectedAXPath,
    setSelectedUdid,
    setSelectedTargetBundleIdentifier,
    setSelectedVariant,
    setVariantError,
    simulators: orderedSimulators,
    toggleVariantPreview,
    variantCaptures,
    variantCount,
    variantError,
    variantIds:
      activeAgentSession?.changeRequest !== undefined
        ? variantIdsForCount(activeAgentSession.changeRequest.variantCount)
        : variantIds,
    variantLabels,
    variantTransition,
    setVariantCount
  };
}
