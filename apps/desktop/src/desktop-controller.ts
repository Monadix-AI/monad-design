import type { ActiveConnection } from './desktop-model';
import type { AgentSessionSnapshot, IOSSimulator, MonadDesignProject } from './electron';

import { agentSessionVersion } from '@monaddesign/client-contract/agent-session-version';
import { ClientApi } from '@monaddesign/client-rtk/client-api';
import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import {
  accessibilityElementName as axElementName,
  simulatorVariantIds,
  simulatorVariantIdsForCount,
  simulatorVariantLabels
} from '@monaddesign/simulator';
import {
  parseSimulatorHistory,
  recordUsedSimulator,
  simulatorHistoryKey,
  sortSimulatorsForProject
} from '@monaddesign/simulator-history';
import { workspaceStore } from '@monaddesign/state/workspace-store';
import { liveSimulatorDeviceFrame } from '@monaddesign/ui/business/canvas-controls';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { useAccessibilityController } from './hooks/use-accessibility-controller';
import { useAgentRequestController } from './hooks/use-agent-request-controller';
import { useSimulatorRuntime } from './hooks/use-simulator-runtime';
import { useVariantCaptureController } from './hooks/use-variant-capture-controller';
import { agentSessionTransition } from './lib/agent-session-transition';

type ProjectTargetInput = Pick<MonadDesignProject['targetApps'][number], 'bundleIdentifier' | 'name' | 'sourcePath'>;

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
  const connected = orderedSimulators.find(({ udid }) => udid === connection?.udid);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const isAXTreeOpen = useStore(workspaceStore, (state) => state.selectionMode);
  const setIsAXTreeOpen = useStore(workspaceStore, (state) => state.setSelectionMode);
  const agentRequest = useStore(workspaceStore, (state) => state.agentRequest);
  const setAgentRequest = useStore(workspaceStore, (state) => state.setAgentRequest);
  const copyStatus = useStore(workspaceStore, (state) => state.copyStatus);
  const setCopyStatus = useStore(workspaceStore, (state) => state.setCopyStatus);
  const resetWorkspaceState = useStore(workspaceStore, (state) => state.resetWorkspaceState);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteClient, setRemoteClient] = useState<{
    port: number;
    pairingCode: string;
    addresses: string[];
  } | null>(null);
  const [runtimeClient, setRuntimeClient] = useState<ClientApi | null>(null);
  const [activeAgentSession, setActiveAgentSession] = useState<AgentSessionSnapshot | null>(null);
  const openedAgentSessionId = useRef<string | null>(null);
  const {
    error: axError,
    hoveredPath: hoveredAXPath,
    selectedElement: selectedAXElement,
    selectedPath: selectedAXPath,
    setHoveredPath: setHoveredAXPath,
    setSelectedPath: setSelectedAXPath,
    setSnapshot: setAXSnapshot,
    snapshot: axSnapshot
  } = useAccessibilityController({ connection, isOpen: isAXTreeOpen, runtimeClient });
  const {
    appearance,
    changeAppearance,
    deviceHeight,
    deviceWidth,
    finishPointer,
    handleKey,
    handlePaste,
    handlePointerDown,
    handlePointerMove,
    initializeScreen,
    isAppearanceChanging,
    isLandscape,
    isStreamReady,
    leavePointer,
    orientation,
    resetSimulatorRuntime,
    rotate,
    screenImage,
    screenSize,
    sendFrame,
    setAppearance,
    setIsStreamReady,
    setLogicalScreenSize,
    setOrientation
  } = useSimulatorRuntime({
    axSnapshot,
    connection,
    hasConnectedSimulator: Boolean(connected),
    isSelectionMode: isAXTreeOpen,
    onError: setError,
    onHoveredPathChange: setHoveredAXPath,
    onSelectedPathChange: setSelectedAXPath,
    runtimeClient
  });
  const {
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
  } = useVariantCaptureController({
    activeAgentSession,
    connection,
    onError: setError,
    onSessionChanged: setActiveAgentSession,
    orientation,
    runtimeClient,
    selectedElement: selectedAXElement
  });
  const {
    agentSessionError,
    agentTurnPayload,
    copyAgentTurnPayload,
    isSendingAgentRequest,
    sendAgentRequest,
    sendAnnotatedAgentRequest,
    setAgentSessionError,
    setVariantCount,
    variantCount
  } = useAgentRequestController({
    activeSession: activeAgentSession,
    agentRequest,
    connected,
    connection,
    runtimeClient,
    selectedElement: selectedAXElement,
    snapshot: axSnapshot,
    onCopyStatusChanged: setCopyStatus,
    onRequestChanged: setAgentRequest,
    onSessionChanged: setActiveAgentSession,
    onSnapshotChanged: setAXSnapshot
  });

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
        const client = new ClientApi(bootstrap);
        setProjects((await client.adminProjects()) as MonadDesignProject[]);
        setRuntimeClient(client);
      })
      .catch((startupError) => setError(errorMessage(startupError)))
      .finally(() => setIsLoadingProjects(false));
    void window.client?.core.status().then(setRemoteClient);
  }, []);

  const openProjectWorkspace = useCallback((project: MonadDesignProject) => {
    setActiveProject(project);
    setUsedSimulatorUdids(readSimulatorHistory()[project.id] ?? []);
    setSelectedTargetBundleIdentifier(project.targetApps[0]?.bundleIdentifier ?? '');
    setProjects((current) => [project, ...current.filter(({ id }) => id !== project.id)]);
    setSimulators([]);
    setSelectedUdid('');
  }, []);

  const activateProject = async (project: MonadDesignProject) => {
    setIsOpeningProject(true);
    setError(null);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      const opened = (await runtimeClient.openAdminProject(project.id)) as MonadDesignProject;
      openProjectWorkspace(opened);
      await scan();
    } catch (projectError) {
      setError(errorMessage(projectError));
    } finally {
      setIsOpeningProject(false);
    }
  };

  useEffect(() => {
    if (!runtimeClient) return;
    let lastSessionVersion: string | null | undefined;
    const receiveSession = (session: AgentSessionSnapshot | null) => {
      const version = agentSessionVersion(session);
      if (version === lastSessionVersion) return;
      lastSessionVersion = version;
      const transition = agentSessionTransition(session);
      setActiveAgentSession(transition.activeSession);
      if (transition.pendingAutoCapture !== undefined) setPendingAutoCapture(transition.pendingAutoCapture);
      if (transition.closeVariantPreview) setIsVariantPreviewOpen(false);
      if (transition.resetVariantPreview) resetVariantPreview();
      if (!session || !transition.shouldOpenProject || !runtimeClient || openedAgentSessionId.current === session.id) {
        return;
      }
      openedAgentSessionId.current = session.id;
      void (async () => {
        try {
          await runtimeClient.disconnect().catch(() => undefined);
          setConnection(null);
          setIsStreamReady(false);
          const project = (await runtimeClient.openAdminProject(session.project.id)) as MonadDesignProject;
          openProjectWorkspace(project);
          setError(null);
          await navigate({ to: '/' });
          await scan();
        } catch (sessionError) {
          setAgentSessionError(errorMessage(sessionError));
        }
      })();
    };

    let active = true;
    const poll = async () => {
      try {
        const { session } = await runtimeClient.activeAgentSession();
        if (active) receiveSession(session);
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
  }, [
    navigate,
    openProjectWorkspace,
    resetVariantPreview,
    runtimeClient,
    scan,
    setIsStreamReady,
    setIsVariantPreviewOpen,
    setPendingAutoCapture,
    setAgentSessionError
  ]);

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

  const saveProject = async (save: (client: ClientApi) => Promise<unknown>) => {
    setIsOpeningProject(true);
    setError(null);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      const project = (await save(runtimeClient)) as MonadDesignProject;
      openProjectWorkspace(project);
      await scan();
    } catch (projectError) {
      setError(errorMessage(projectError));
      throw projectError;
    } finally {
      setIsOpeningProject(false);
    }
  };
  const addProject = (path: string, targetApps: ProjectTargetInput[]) =>
    saveProject((client) => client.addAdminProject({ path, targetApps }));
  const configureProject = (id: string, targetApps: ProjectTargetInput[]) =>
    saveProject((client) => client.configureAdminProject(id, { targetApps }));

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
        initializeScreen({
          width: selectedSimulator.screen.width / selectedSimulator.screen.scale,
          height: selectedSimulator.screen.height / selectedSimulator.screen.scale
        });
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
      const appearancePromise = runtimeClient.appearance().catch(() => null);
      const snapshotPromise = runtimeClient.accessibility().catch(() => null);
      const [, nextAppearance, snapshot] = await Promise.all([
        navigate({ to: '/workspace' }),
        appearancePromise,
        snapshotPromise
      ]);
      setAppearance(nextAppearance?.appearance ?? null);
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

  const deviceFrame = liveSimulatorDeviceFrame({
    deviceChrome: connected?.deviceChrome,
    deviceHeight,
    deviceName: connected?.name ?? 'iOS Simulator',
    deviceWidth,
    orientation
  });
  const disconnect = () => {
    setConnection(null);
    void navigate({ to: '/' });
    setIsAXTreeOpen(false);
    resetVariantPreview();
    setIsAnnotationMode(false);
    resetSimulatorRuntime();
    if (runtimeClient) void runtimeClient.disconnect().catch(() => undefined);
  };
  const openAnnotation = () => {
    if (!connection || isAnnotationMode) return;
    setIsAnnotationMode(true);
    setIsAXTreeOpen(false);
    setSelectedAXPath(null);
  };
  const captureSimulatorImage = async () => {
    if (!connection || !runtimeClient) throw new Error('The Simulator is not available.');
    return (await runtimeClient.screenshot()).image;
  };
  const closeAnnotation = () => {
    setIsAnnotationMode(false);
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
    captureSimulatorImage,
    captureVariants,
    capturingVariant,
    changeAppearance,
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
    finishPointer,
    handleKey,
    handlePaste,
    handlePointerDown,
    handlePointerMove,
    hoveredAXPath,
    isAppearanceChanging,
    isAXTreeOpen,
    isAnnotationMode,
    isConnecting,
    isLandscape,
    isLoadingProjects,
    isOpeningProject,
    isRuntimeReady: runtimeClient !== null,
    isScanning,
    isSendingAgentRequest,
    isStreamReady,
    isVariantPreviewOpen,
    leavePointer,
    openSelectedVariant,
    orientation,
    projectIcons,
    projects,
    remoteClient,
    runtimeClient,
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
        ? simulatorVariantIdsForCount(activeAgentSession.changeRequest.variantCount)
        : simulatorVariantIds,
    variantLabels: simulatorVariantLabels,
    variantTransition,
    setVariantCount
  };
}
