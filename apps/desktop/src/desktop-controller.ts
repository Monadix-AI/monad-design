import type { ActiveConnection } from './desktop-model';
import type { AgentSessionSnapshot, MonadDesignProject } from './electron';

import { ClientApi } from '@monaddesign/client-rtk/client-api';
import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import { useLiveSession } from '@monaddesign/client-rtk/use-live-session';
import { useLiveWorkspaceController } from '@monaddesign/client-rtk/use-live-workspace';
import { useSimulators } from '@monaddesign/client-rtk/use-simulators';
import { accessibilityElementName as axElementName, simulatorVariantLabels } from '@monaddesign/simulator';
import {
  parseSimulatorHistory,
  recordUsedSimulator,
  simulatorHistoryKey,
  sortSimulatorsForProject
} from '@monaddesign/simulator-history';
import { workspaceStore } from '@monaddesign/state/workspace-store';
import { captureStableSimulatorScreen } from '@monaddesign/ui/business/variant-capture';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

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

const subscribeToAgentSession = (listener: (session: AgentSessionSnapshot | null) => void) =>
  window.client?.core.subscribeToAgentSession(listener);

export function useDesktopController() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MonadDesignProject[]>([]);
  const [activeProject, setActiveProject] = useState<MonadDesignProject | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [removingProjectId, setRemovingProjectId] = useState<string | null>(null);
  const [usedSimulatorUdids, setUsedSimulatorUdids] = useState<string[]>([]);
  const [selectedUdid, setSelectedUdid] = useState('');
  const [selectedTargetBundleIdentifier, setSelectedTargetBundleIdentifier] = useState('');
  const [connection, setConnection] = useState<ActiveConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const isAXTreeOpen = useStore(workspaceStore, (state) => state.selectionMode);
  const setIsAXTreeOpen = useStore(workspaceStore, (state) => state.setSelectionMode);
  const selectedAXPath = useStore(workspaceStore, (state) => state.selectedElementPath);
  const setSelectedAXPath = useStore(workspaceStore, (state) => state.setSelectedElementPath);
  const agentRequest = useStore(workspaceStore, (state) => state.agentRequest);
  const setAgentRequest = useStore(workspaceStore, (state) => state.setAgentRequest);
  const copyStatus = useStore(workspaceStore, (state) => state.copyStatus);
  const setCopyStatus = useStore(workspaceStore, (state) => state.setCopyStatus);
  const resetWorkspaceState = useStore(workspaceStore, (state) => state.resetWorkspaceState);
  const [error, setError] = useState<string | null>(null);
  const [remoteClient, setRemoteClient] = useState<{
    port: number;
    pairingCode: string;
    addresses: string[];
  } | null>(null);
  const [runtimeClient, setRuntimeClient] = useState<ClientApi | null>(null);
  const {
    endLive,
    isEndingLive,
    session: activeAgentSession,
    setSession: setActiveAgentSession
  } = useLiveSession({
    client: runtimeClient,
    onError: setError,
    subscribe: subscribeToAgentSession
  });
  const { isScanning, scan, simulators } = useSimulators({
    client: runtimeClient,
    enabled: Boolean(activeProject),
    onError: setError
  });
  const orderedSimulators = useMemo(
    () => sortSimulatorsForProject(simulators, usedSimulatorUdids),
    [simulators, usedSimulatorUdids]
  );
  const connected = orderedSimulators.find(({ udid }) => udid === connection?.udid);
  const openedAgentSessionId = useRef<string | null>(null);
  const captureStableScreen = useCallback(
    (
      variant: Parameters<typeof captureStableSimulatorScreen>[1],
      target?: Parameters<typeof captureStableSimulatorScreen>[2]
    ) => {
      if (!runtimeClient) throw new Error('The live runtime is not ready yet.');
      return captureStableSimulatorScreen(runtimeClient, variant, target);
    },
    [runtimeClient]
  );
  const workspace = useLiveWorkspaceController({
    agentRequest,
    captureStableScreen,
    client: runtimeClient,
    connected,
    connection,
    connectionKey: connection ? `${connection.projectId}:${connection.udid}:${connection.bundleIdentifier}` : null,
    onCopyStatusChanged: setCopyStatus,
    onError: setError,
    onRequestChanged: setAgentRequest,
    onSessionChanged: setActiveAgentSession,
    selectedPath: selectedAXPath,
    selectionMode: isAXTreeOpen,
    session: activeAgentSession,
    setSelectedPath: setSelectedAXPath,
    setSelectionMode: setIsAXTreeOpen
  });
  const {
    activePreviewVariant,
    agentSessionError,
    agentTurnPayload,
    annotationMode: isAnnotationMode,
    appearance,
    axError,
    axSnapshot,
    captureSimulatorImage,
    captureVariants,
    capturingVariant,
    changeAppearance,
    changeWorkspaceMode,
    closeAnnotation,
    confirmSelectedVariant,
    copyAgentTurnPayload,
    deviceHeight,
    deviceWidth,
    discardAgentChange,
    discardVariantPreview,
    finishPointer,
    handleKey,
    handlePaste,
    handlePointerDown,
    handlePointerMove,
    hoveredAXPath,
    initializeScreen,
    isAppearanceChanging,
    isLandscape,
    isSendingAgentRequest,
    isStreamReady,
    isVariantPreviewOpen,
    leavePointer,
    openSelectedVariant,
    orientation,
    pointer,
    resetSimulatorRuntime,
    resetVariantPreview,
    rotate,
    screenImage,
    screenSize,
    selectedAXElement,
    selectedVariant,
    sendAgentRequest,
    sendAnnotatedAgentRequest,
    sendFrame,
    setAgentSessionError,
    setAppearance,
    setIsStreamReady,
    setLogicalScreenSize,
    setOrientation,
    setSelectedVariant,
    setVariantCount,
    setVariantError,
    toggleVariantPreview,
    variantCaptures,
    variantCount,
    variantError,
    variantIds,
    variantComparison,
    variantTransition
  } = workspace;

  useEffect(() => {
    resetWorkspaceState();
    return resetWorkspaceState;
  }, [resetWorkspaceState]);

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
    if (
      activeAgentSession?.status !== 'selecting_simulator' ||
      !runtimeClient ||
      openedAgentSessionId.current === activeAgentSession.id
    ) {
      return;
    }
    openedAgentSessionId.current = activeAgentSession.id;
    void (async () => {
      try {
        await runtimeClient.disconnect().catch(() => undefined);
        setConnection(null);
        setIsStreamReady(false);
        const project = (await runtimeClient.openAdminProject(activeAgentSession.project.id)) as MonadDesignProject;
        openProjectWorkspace(project);
        setError(null);
        await navigate({ to: '/' });
        await scan();
      } catch (sessionError) {
        setAgentSessionError(errorMessage(sessionError));
      }
    })();
  }, [activeAgentSession, navigate, openProjectWorkspace, runtimeClient, scan, setIsStreamReady, setAgentSessionError]);

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

  const disconnect = () => {
    setConnection(null);
    void navigate({ to: '/' });
    setIsAXTreeOpen(false);
    resetVariantPreview();
    closeAnnotation();
    resetSimulatorRuntime();
    if (runtimeClient) void runtimeClient.disconnect().catch(() => undefined);
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
    deviceWidth,
    discardAgentChange,
    discardVariantPreview,
    disconnect,
    endLive,
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
    isEndingLive,
    isVariantPreviewOpen,
    leavePointer,
    openSelectedVariant,
    orientation,
    pointer,
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
    variantIds,
    variantComparison,
    variantLabels: simulatorVariantLabels,
    variantTransition,
    workspaceInspector: workspace.inspector,
    workspaceMode: workspace.workspaceMode,
    workspaceSimulator: workspace.simulator,
    setVariantCount
  };
}
