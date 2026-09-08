import type {
  AccessibilitySnapshotResponse as AXSnapshot,
  IOSSimulator,
  SimulatorConnectionResponse as SimulatorConnection
} from '@monaddesign/client-contract';
import type { SimulatorVariantId } from '@monaddesign/simulator';

import { resolveAdjustmentRequest } from '@monaddesign/client-contract';
import { ClientApi } from '@monaddesign/client-rtk/client-api';

import { createThemedStyles, useColors } from '../theme';

type AXElement = AXSnapshot['elements'][number];

import Ionicons from '@expo/vector-icons/Ionicons';
import { FitToScreenIcon, ZoomInIcon, ZoomOutIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  useDisconnectSimulatorMutation,
  useGetAccessibilitySnapshotQuery,
  useGetSimulatorAppearanceQuery,
  useLazyCaptureSimulatorScreenshotQuery,
  useSetSimulatorAppearanceMutation,
  useSetSimulatorPasteboardMutation
} from '@monaddesign/client-rtk/endpoints';
import { deviceFrameMetrics } from '@monaddesign/device-frame';
import {
  accessibilityScreenMatchesOrientation,
  accessibilityElementAtPoint as axElementAtPoint,
  buildAgentTurnContext,
  canvasOffsetForZoom,
  canvasScaleStep,
  clampCanvasOffset,
  maximumCanvasScale,
  minimumCanvasScale,
  rotatedSimulatorOrientation as rotatedOrientation,
  orientCanvasPoint as simulatorPoint,
  simulatorVariantIdsForCount
} from '@monaddesign/simulator';
import { workspaceStore } from '@monaddesign/state/workspace-store';
import MaskedView from '@react-native-masked-view/masked-view';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { useStore } from 'zustand';

import { AgentRequestPanel } from '../components/AgentRequestPanel';
import { AnnotationWorkspace, type AnnotationWorkspaceParts } from '../components/AnnotationWorkspace';
import { BackButton } from '../components/BackButton';
import { DesignDocumentPanel } from '../components/DesignDocumentPanel';
import { GlassControl, GlassSurface } from '../components/GlassControl';
import { GlassToolGroup } from '../components/GlassToolGroup';
import { VariantModal } from '../components/VariantModal';
import { CanvasControl } from '../components/WorkspaceControls';
import { useDesignGuidance } from '../hooks/use-design-guidance';
import { useLiveAgentSession } from '../hooks/use-live-agent-session';
import { useSimulatorInput } from '../hooks/use-simulator-input';
import { useSimulatorLifecycle } from '../hooks/use-simulator-lifecycle';
import { useStyles } from '../styles';
import { errorMessage } from '../theme';
import { simulatorChromeLayout, simulatorFrameSize, simulatorMaskGeometry } from '../workspace-layout';
import { useWorkspaceColors } from '../workspace-theme';

const displayFrame = (element: AXElement, snapshot: AXSnapshot) => {
  const x = element.frame.x / snapshot.screen.width;
  const y = element.frame.y / snapshot.screen.height;
  const width = element.frame.width / snapshot.screen.width;
  const height = element.frame.height / snapshot.screen.height;
  return {
    left: `${x * 100}%` as const,
    top: `${y * 100}%` as const,
    width: `${width * 100}%` as const,
    height: `${height * 100}%` as const
  };
};

const deviceControlsReservedHeight = 68;

const touchPoint = (touch: { locationX: number; locationY: number }) => ({
  x: touch.locationX,
  y: touch.locationY
});
const touchDistance = (first: { locationX: number; locationY: number }, second: typeof first) =>
  Math.hypot(second.locationX - first.locationX, second.locationY - first.locationY);
const touchMidpoint = (first: { locationX: number; locationY: number }, second: typeof first) => ({
  x: (first.locationX + second.locationX) / 2,
  y: (first.locationY + second.locationY) / 2
});

function CanvasGrid() {
  const colors = useColors();
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <Svg
        height="100%"
        width="100%"
      >
        <Defs>
          <Pattern
            height="24"
            id="canvas-grid"
            patternUnits="userSpaceOnUse"
            width="24"
          >
            <Circle
              cx="1"
              cy="1"
              fill={colors.grid}
              r="1"
            />
          </Pattern>
        </Defs>
        <Rect
          fill="url(#canvas-grid)"
          height="100%"
          width="100%"
        />
      </Svg>
    </View>
  );
}

export function Workspace({
  api,
  simulator,
  connection,
  onExit
}: {
  api: ClientApi;
  simulator: IOSSimulator;
  connection: SimulatorConnection;
  onExit: () => void;
}) {
  const colors = useColors();
  const workspaceColors = useWorkspaceColors();
  const parityStyles = useParityStyles();
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const [workspaceSize, setWorkspaceSize] = useState({ width, height });
  const dockInspector = workspaceSize.width >= 760 && workspaceSize.height >= 560;
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEndingLive, setIsEndingLive] = useState(false);
  const touchActive = useRef(false);
  const [, setStreamReady] = useState(false);
  const simulatorLifecycle = useSimulatorLifecycle();
  const [streamRevision, setStreamRevision] = useState(0);
  const { data: appearanceData } = useGetSimulatorAppearanceQuery();
  const appearance = appearanceData?.appearance ?? null;
  const selectionMode = useStore(workspaceStore, (state) => state.selectionMode);
  const setSelectionMode = useStore(workspaceStore, (state) => state.setSelectionMode);
  const { data: snapshot = null, error: snapshotError } = useGetAccessibilitySnapshotQuery(undefined, {
    skip: !selectionMode,
    pollingInterval: 1_000
  });
  const selectedPath = useStore(workspaceStore, (state) => state.selectedElementPath);
  const setSelectedPath = useStore(workspaceStore, (state) => state.setSelectedElementPath);
  const request = useStore(workspaceStore, (state) => state.agentRequest);
  const setRequest = useStore(workspaceStore, (state) => state.setAgentRequest);
  const resetWorkspaceState = useStore(workspaceStore, (state) => state.resetWorkspaceState);
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasViewport, setCanvasViewport] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [inspectorVisible, setInspectorVisible] = useState(dockInspector);
  const autoOpenedAgentRequest = useRef<string | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [pasteVisible, setPasteVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [annotationImage, setAnnotationImage] = useState<string | null>(null);
  const [variantCaptureBusy, setVariantCaptureBusy] = useState(false);
  const [variantVisible, setVariantVisible] = useState(false);
  const [, setActiveVariant] = useState<SimulatorVariantId | null>(null);
  const [agentSession, setAgentSession] = useLiveAgentSession(api, connection);
  const [agentSessionError, setAgentSessionError] = useState<string | null>(null);
  const [isSendingAgentRequest, setIsSendingAgentRequest] = useState(false);
  const [variantCount, setVariantCount] = useState(1);
  const [selectedAgentVariant, setSelectedAgentVariant] = useState<SimulatorVariantId | null>(null);
  const [agentVariantTransition, setAgentVariantTransition] = useState<
    'previewing' | 'accepting' | 'discarding' | null
  >(null);
  const [setSimulatorAppearance, appearanceState] = useSetSimulatorAppearanceMutation();
  const [setSimulatorPasteboard, pasteboardState] = useSetSimulatorPasteboardMutation();
  const [captureScreenshot, captureState] = useLazyCaptureSimulatorScreenshotQuery();
  const [disconnectSimulator] = useDisconnectSimulatorMutation();
  const [error, setError] = useState<string | null>(null);
  const { orientation, screenSize, send, setOrientation } = useSimulatorInput({
    active: simulatorLifecycle.active,
    reconnectRevision: simulatorLifecycle.revision,
    initialOrientation: connection.orientation ?? 'portrait',
    initialScreenSize: simulator.screen
      ? { width: simulator.screen.width, height: simulator.screen.height }
      : { width: 390, height: 844 },
    inputUrl: api.inputUrl(connection.inputPath),
    onError: setError
  });
  const canvasScaleRef = useRef(canvasScale);
  const canvasOffsetRef = useRef(canvasOffset);
  const canvasGesture = useRef<
    | {
        mode: 'pan';
        start: { x: number; y: number };
        offset: { x: number; y: number };
      }
    | {
        mode: 'pinch';
        distance: number;
        midpoint: { x: number; y: number };
        offset: { x: number; y: number };
        scale: number;
      }
    | null
  >(null);
  canvasScaleRef.current = canvasScale;
  canvasOffsetRef.current = canvasOffset;
  const busy = appearanceState.isLoading
    ? 'appearance'
    : pasteboardState.isLoading
      ? 'paste'
      : captureState.isFetching
        ? 'capture'
        : null;

  useEffect(() => {
    resetWorkspaceState();
    return resetWorkspaceState;
  }, [resetWorkspaceState]);

  useEffect(() => {
    if (agentSession?.status === 'selection_confirmed') {
      setSelectedAgentVariant(agentSession.confirmedSelection?.variant ?? null);
    } else if (agentSession?.status !== 'variants_ready') {
      setSelectedAgentVariant(null);
    }
  }, [agentSession?.confirmedSelection?.variant, agentSession?.status]);

  useEffect(() => {
    const requestId = agentSession?.status === 'variants_ready' ? agentSession.changeRequest?.id : null;
    if (!requestId || autoOpenedAgentRequest.current === requestId) return;
    autoOpenedAgentRequest.current = requestId;
    setInspectorVisible(false);
    setSelectionMode(false);
    setAnnotationImage(null);
    setDesignOpen(false);
    setVariantVisible(true);
  }, [agentSession?.changeRequest?.id, agentSession?.status, setSelectionMode]);

  useEffect(() => {
    if (!selectionMode) setSelectedPath(null);
  }, [selectionMode, setSelectedPath]);

  useEffect(() => {
    if (snapshotError) setError(errorMessage(snapshotError));
  }, [snapshotError]);

  const onTouch = useCallback(
    (type: 'begin' | 'move' | 'end', point: { x: number; y: number }) => {
      const normalized = simulatorPoint(point, orientation);
      return send(0x03, { type, ...normalized });
    },
    [orientation, send]
  );
  const frameLayout = useRef({ width: 1, height: 1 });
  const lastSimulatorTouch = useRef<{ x: number; y: number } | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const point = {
            x: locationX / Math.max(1, frameLayout.current.width),
            y: locationY / Math.max(1, frameLayout.current.height)
          };
          if (selectionMode) {
            setSelectedPath(
              snapshot && accessibilityScreenMatchesOrientation(snapshot.screen, orientation)
                ? (axElementAtPoint(snapshot, point)?.path ?? null)
                : null
            );
            return;
          }
          lastSimulatorTouch.current = point;
          touchActive.current = onTouch('begin', point);
        },
        onPanResponderMove: (event) => {
          if (!touchActive.current || selectionMode) return;
          const point = {
            x: event.nativeEvent.locationX / Math.max(1, frameLayout.current.width),
            y: event.nativeEvent.locationY / Math.max(1, frameLayout.current.height)
          };
          lastSimulatorTouch.current = point;
          onTouch('move', point);
        },
        onPanResponderRelease: (event) => {
          if (touchActive.current) {
            const point = {
              x: event.nativeEvent.locationX / Math.max(1, frameLayout.current.width),
              y: event.nativeEvent.locationY / Math.max(1, frameLayout.current.height)
            };
            lastSimulatorTouch.current = point;
            onTouch('end', point);
          }
          touchActive.current = false;
          lastSimulatorTouch.current = null;
        },
        onPanResponderTerminate: () => {
          if (touchActive.current && lastSimulatorTouch.current) onTouch('end', lastSimulatorTouch.current);
          touchActive.current = false;
          lastSimulatorTouch.current = null;
        }
      }),
    [onTouch, orientation, selectionMode, snapshot, setSelectedPath]
  );
  const rotate = (direction: 'left' | 'right') => {
    const next = rotatedOrientation(orientation, direction);
    if (send(0x07, { orientation: next })) setOrientation(next);
  };
  const changeAppearance = async (value: 'light' | 'dark') => {
    try {
      await setSimulatorAppearance({ appearance: value }).unwrap();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const paste = async () => {
    try {
      await setSimulatorPasteboard(pasteText).unwrap();
      send(0x06, { type: 'down', usage: 227 });
      send(0x06, { type: 'down', usage: 25 });
      send(0x06, { type: 'up', usage: 25 });
      send(0x06, { type: 'up', usage: 227 });
      setPasteVisible(false);
      setPasteText('');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const annotate = async () => {
    try {
      setVariantVisible(false);
      setAnnotationImage((await captureScreenshot().unwrap()).image);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const selected = useMemo(
    () => snapshot?.elements.find(({ path }) => path === selectedPath),
    [selectedPath, snapshot]
  );
  const designGuidance = useDesignGuidance(`${connection.projectId}:${agentSession?.id ?? ''}`, Boolean(selected));
  const effectiveRequest = resolveAdjustmentRequest(request, designGuidance.selected);
  const agentFlowLocked =
    agentSession?.status === 'change_requested' ||
    agentSession?.status === 'working' ||
    agentSession?.status === 'variants_ready' ||
    agentSession?.status === 'selection_confirmed';
  const toolsDisabled = agentFlowLocked || busy === 'capture' || isSendingAgentRequest || isEndingLive;
  const clearEditingDraft = () => {
    setSelectedPath(null);
    setAnnotationImage(null);
    setRequest('');
    setVariantCount(1);
    designGuidance.clearDraft();
    setSelectionMode(false);
  };
  const activateInteract = () => {
    const hasDraft = Boolean(
      selectedPath ||
        annotationImage ||
        request.trim() ||
        designGuidance.selected.length ||
        designGuidance.focus.trim() ||
        designGuidance.preserve !== 'Existing content, navigation and interactions'
    );
    if (!hasDraft) {
      clearEditingDraft();
      return;
    }
    Alert.alert(
      'Clear draft and interact?',
      'Returning to Interact clears the selected element, all annotations and notes, request, references and adjustment goals. This cannot be undone.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Clear and interact', style: 'destructive', onPress: clearEditingDraft }
      ]
    );
  };
  const agentTurnContext = useMemo(
    () =>
      buildAgentTurnContext({
        bundleIdentifier: connection.bundleIdentifier,
        ...(selected ? { element: selected } : {}),
        ...(snapshot ? { snapshot } : {}),
        simulator
      }),
    [connection.bundleIdentifier, selected, simulator, snapshot]
  );
  const sendAgentRequest = async () => {
    if (
      agentSession?.status !== 'awaiting_request' ||
      !effectiveRequest.trim() ||
      isSendingAgentRequest ||
      isEndingLive
    )
      return;
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      let context = agentTurnContext;
      if (!selected || designGuidance.guidance?.scope === 'screen') {
        const currentSnapshot = await api.accessibility();
        context = buildAgentTurnContext({
          bundleIdentifier: connection.bundleIdentifier,
          snapshot: currentSnapshot,
          simulator
        });
      }
      const next = await api.submitAgentRequest(agentSession.id, {
        request: effectiveRequest,
        variantCount,
        context: { ...context, ...(designGuidance.guidance ? { designGuidance: designGuidance.guidance } : {}) }
      });
      setAgentSession(next);
      setRequest('');
      designGuidance.submitted();
      setVariantCount(1);
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
    } finally {
      setIsSendingAgentRequest(false);
    }
  };
  const sendAnnotatedAgentRequest = async (annotationScreenshot: string, annotationNotes: string) => {
    if (agentSession?.status !== 'awaiting_request' || isSendingAgentRequest || isEndingLive) {
      throw new Error('Start Live and wait until the agent is ready before finishing the annotation.');
    }
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      const currentSnapshot = await api.accessibility();
      const context = buildAgentTurnContext({
        bundleIdentifier: connection.bundleIdentifier,
        snapshot: currentSnapshot,
        ...(selected ? { element: selected } : {}),
        simulator
      });
      const next = await api.submitAgentRequest(agentSession.id, {
        request: [
          effectiveRequest.trim() || 'Implement the changes shown in the attached annotated screenshot.',
          annotationNotes
        ]
          .filter(Boolean)
          .join('\n\n'),
        variantCount,
        context: {
          ...context,
          ...(designGuidance.guidance ? { designGuidance: designGuidance.guidance } : {})
        },
        annotationScreenshot
      });
      setAgentSession(next);
      setRequest('');
      designGuidance.submitted();
      setVariantCount(1);
    } catch (reason) {
      const message = errorMessage(reason);
      setAgentSessionError(message);
      throw new Error(message);
    } finally {
      setIsSendingAgentRequest(false);
    }
  };
  const agentVariants = simulatorVariantIdsForCount(agentSession?.changeRequest?.variantCount ?? 1);
  const confirmAgentVariant = async (variant: SimulatorVariantId) => {
    const requestId = agentSession?.changeRequest?.id;
    if (agentSession?.status !== 'variants_ready' || !requestId) return;
    try {
      setAgentSession(
        await api.confirmAgentSelection(agentSession.id, {
          requestId,
          variant
        })
      );
      setAgentSessionError(null);
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
      throw reason;
    }
  };
  const previewAgentVariant = async (variant: SimulatorVariantId) => {
    if (agentSession?.status !== 'variants_ready' || agentVariantTransition || isEndingLive) return;
    setAgentVariantTransition('previewing');
    setAgentSessionError(null);
    try {
      if (variant === 'original') {
        await api.launchApp();
        setActiveVariant(null);
      } else {
        await api.launchVariant(variant);
        setActiveVariant(variant);
      }
      setSelectedAgentVariant(variant);
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
    } finally {
      setAgentVariantTransition(null);
    }
  };
  const acceptAgentVariant = async () => {
    if (!selectedAgentVariant || agentSession?.status !== 'variants_ready' || agentVariantTransition || isEndingLive)
      return;
    setAgentVariantTransition('accepting');
    try {
      await confirmAgentVariant(selectedAgentVariant);
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
    } finally {
      setAgentVariantTransition(null);
    }
  };
  const discardAgentChange = async () => {
    if (agentSession?.status !== 'variants_ready' || agentVariantTransition || isEndingLive) return;
    setAgentVariantTransition('discarding');
    setAgentSessionError(null);
    try {
      await api.launchApp();
      setActiveVariant(null);
      setSelectedAgentVariant('original');
      await confirmAgentVariant('original');
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
    } finally {
      setAgentVariantTransition(null);
    }
  };
  const stream = api.streamUrl(connection.streamPath);
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const frameSize = simulatorFrameSize({
    screen: screenSize,
    deviceName: simulator.name,
    orientation,
    viewport: canvasViewport,
    scale: canvasScale,
    deviceChrome: simulator.deviceChrome
  });
  const fallbackDeviceFrame = deviceFrameMetrics({
    deviceName: simulator.name,
    screenWidth: frameSize.width,
    screenHeight: frameSize.height,
    orientation
  });
  const chromeLayout = simulator.deviceChrome
    ? simulatorChromeLayout({ chrome: simulator.deviceChrome, screenFrame: frameSize, orientation })
    : null;
  const deviceFrame = chromeLayout
    ? {
        ...fallbackDeviceFrame,
        frameWidth: chromeLayout.frameWidth,
        frameHeight: chromeLayout.frameHeight,
        insets: chromeLayout.insets
      }
    : fallbackDeviceFrame;
  const canvasFrameBaseSize = {
    width: deviceFrame.frameWidth / canvasScale,
    height: deviceFrame.frameHeight / canvasScale
  };
  const constrainCanvasOffset = useCallback(
    (offset: { x: number; y: number }, scale: number) => {
      if (!canvasViewport) return offset;
      return clampCanvasOffset(offset, canvasViewport, {
        width: canvasFrameBaseSize.width * scale,
        height: canvasFrameBaseSize.height * scale + deviceControlsReservedHeight
      });
    },
    [canvasFrameBaseSize.height, canvasFrameBaseSize.width, canvasViewport]
  );
  const updateCanvasOffset = useCallback(
    (offset: { x: number; y: number }, scale: number) => {
      const next = constrainCanvasOffset(offset, scale);
      if (canvasOffsetRef.current.x === next.x && canvasOffsetRef.current.y === next.y) return;
      canvasOffsetRef.current = next;
      setCanvasOffset(next);
    },
    [constrainCanvasOffset]
  );
  const changeCanvasScale = useCallback(
    (requestedScale: number) => {
      const nextScale = Math.min(maximumCanvasScale, Math.max(minimumCanvasScale, requestedScale));
      canvasScaleRef.current = nextScale;
      setCanvasScale(nextScale);
      updateCanvasOffset(canvasOffsetRef.current, nextScale);
    },
    [updateCanvasOffset]
  );
  useEffect(() => {
    updateCanvasOffset(canvasOffsetRef.current, canvasScaleRef.current);
  }, [updateCanvasOffset]);
  const fitCanvas = useCallback(() => {
    canvasGesture.current = null;
    canvasScaleRef.current = 1;
    canvasOffsetRef.current = { x: 0, y: 0 };
    setCanvasScale(1);
    setCanvasOffset({ x: 0, y: 0 });
  }, []);
  const canvasResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const [first, second] = event.nativeEvent.touches;
          if (first && second && canvasViewport) {
            canvasGesture.current = {
              mode: 'pinch',
              distance: Math.max(1, touchDistance(first, second)),
              midpoint: touchMidpoint(first, second),
              offset: canvasOffsetRef.current,
              scale: canvasScaleRef.current
            };
            return;
          }
          if (first) {
            canvasGesture.current = {
              mode: 'pan',
              start: touchPoint(first),
              offset: canvasOffsetRef.current
            };
          }
        },
        onPanResponderMove: (event) => {
          const [first, second] = event.nativeEvent.touches;
          if (!first) return;
          if (second && canvasViewport) {
            if (canvasGesture.current?.mode !== 'pinch') {
              canvasGesture.current = {
                mode: 'pinch',
                distance: Math.max(1, touchDistance(first, second)),
                midpoint: touchMidpoint(first, second),
                offset: canvasOffsetRef.current,
                scale: canvasScaleRef.current
              };
              return;
            }
            const gesture = canvasGesture.current;
            const midpoint = touchMidpoint(first, second);
            const nextScale = Math.min(
              maximumCanvasScale,
              Math.max(minimumCanvasScale, gesture.scale * (touchDistance(first, second) / gesture.distance))
            );
            const anchored = canvasOffsetForZoom(
              gesture.offset,
              canvasViewport,
              gesture.midpoint,
              gesture.scale,
              nextScale
            );
            canvasScaleRef.current = nextScale;
            setCanvasScale(nextScale);
            updateCanvasOffset(
              {
                x: anchored.x + midpoint.x - gesture.midpoint.x,
                y: anchored.y + midpoint.y - gesture.midpoint.y
              },
              nextScale
            );
            return;
          }
          if (canvasGesture.current?.mode !== 'pan') {
            canvasGesture.current = {
              mode: 'pan',
              start: touchPoint(first),
              offset: canvasOffsetRef.current
            };
            return;
          }
          const gesture = canvasGesture.current;
          const point = touchPoint(first);
          updateCanvasOffset(
            {
              x: gesture.offset.x + point.x - gesture.start.x,
              y: gesture.offset.y + point.y - gesture.start.y
            },
            canvasScaleRef.current
          );
        },
        onPanResponderRelease: () => {
          canvasGesture.current = null;
        },
        onPanResponderTerminate: () => {
          canvasGesture.current = null;
        }
      }),
    [canvasViewport, updateCanvasOffset]
  );
  const streamTransform =
    orientation === 'landscape_left'
      ? 'rotate(90deg)'
      : orientation === 'landscape_right'
        ? 'rotate(-90deg)'
        : orientation === 'portrait_upside_down'
          ? 'rotate(180deg)'
          : '';
  const portraitScreenAspectRatio =
    Math.min(screenSize.width, screenSize.height) / Math.max(screenSize.width, screenSize.height);
  const maskGeometry = simulatorMaskGeometry({ frame: frameSize, orientation });
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;background:transparent;width:100%;height:100%;overflow:hidden}img{position:absolute;left:50%;top:50%;object-fit:fill;transform:translate(-50%,-50%) ${streamTransform};width:${landscape ? `${portraitScreenAspectRatio * 100}%` : '100%'};height:${landscape ? `${(1 / portraitScreenAspectRatio) * 100}%` : '100%'}}</style><img src=${JSON.stringify(stream)} onload="window.ReactNativeWebView.postMessage('ready')">`;

  const exit = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await disconnectSimulator().unwrap();
    } catch {
      /* The local UI can still leave a dead session. */
    }
    onExit();
  };
  const endLive = async () => {
    if (!agentSession || isEndingLive || isSendingAgentRequest) return;
    setIsEndingLive(true);
    setAgentSessionError(null);
    try {
      setAgentSession(await api.closeAgentSession(agentSession.id));
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
    } finally {
      setIsEndingLive(false);
    }
  };
  const renderWorkspace = (annotation: AnnotationWorkspaceParts) => {
    const supportPanels = (
      <View
        pointerEvents="box-none"
        style={[parityStyles.supportPanels, !dockInspector && parityStyles.supportPanelsCompact]}
      >
        <WorkspaceSupportPanel
          icon="document-text-outline"
          onToggle={() => setDesignOpen(!designOpen)}
          open={designOpen}
          title="DESIGN.md"
        >
          <DesignDocumentPanel
            api={api}
            projectId={connection.projectId}
            showTrigger={false}
          />
        </WorkspaceSupportPanel>
      </View>
    );
    const inspector = (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.inspectorModal, { backgroundColor: workspaceColors.panel }]}
      >
        {!dockInspector && (
          <View style={styles.inspectorTitlebar}>
            <View>
              <Text style={styles.inspectorTitle}>Workspace</Text>
              <Text style={styles.inspectorRuntime}>{simulator.runtime}</Text>
            </View>
            {!dockInspector && (
              <GlassControl
                accessibilityLabel="Close workspace controls"
                contentStyle={styles.modalCloseContent}
                glassStyle="clear"
                onPress={() => setInspectorVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons
                  color={colors.muted}
                  name="close"
                  size={20}
                />
              </GlassControl>
            )}
          </View>
        )}
        {!dockInspector && supportPanels}
        <AgentRequestPanel
          annotationNotes={annotation.notes}
          designGuidance={designGuidance}
          error={agentSessionError}
          hasAnnotations={annotation.count > 0}
          isEndingLive={isEndingLive}
          isSending={isSendingAgentRequest || annotation.isFinishing}
          onAccept={() => void acceptAgentVariant()}
          onClearSelection={() => setSelectedPath(null)}
          onDiscard={() => void discardAgentChange()}
          onEndLive={() => void endLive()}
          onPreviewVariant={(variant) => void previewAgentVariant(variant)}
          onRequestChange={setRequest}
          onSend={() => void (annotation.count > 0 ? annotation.submit() : sendAgentRequest())}
          onVariantCountChange={setVariantCount}
          request={request}
          selected={selected}
          selectedVariant={selectedAgentVariant}
          session={agentSession?.project.id === connection.projectId ? agentSession : null}
          snapshot={snapshot}
          transition={variantCaptureBusy ? 'previewing' : agentVariantTransition}
          variantCount={variantCount}
          variants={agentVariants}
        />
      </KeyboardAvoidingView>
    );
    return (
      <View style={styles.workspaceRoot}>
        <CanvasGrid />
        <SafeAreaView style={parityStyles.workspaceContent}>
          <View
            onLayout={({ nativeEvent: { layout } }) =>
              setWorkspaceSize((current) =>
                current.width === layout.width && current.height === layout.height
                  ? current
                  : { width: layout.width, height: layout.height }
              )
            }
            style={styles.canvasArea}
          >
            <View
              pointerEvents="box-none"
              style={[parityStyles.pageHeading, dockInspector && parityStyles.pageHeadingDocked]}
            >
              <BackButton
                disabled={isLeaving}
                label="Simulators"
                onPress={() => void exit()}
              />
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={parityStyles.simulatorTitle}
              >
                {simulator.name}
              </Text>
            </View>
            {dockInspector && supportPanels}
            <View
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setCanvasViewport((current) =>
                  current?.width === width && current.height === height ? current : { width, height }
                );
              }}
              style={[styles.canvasCenter, dockInspector && parityStyles.canvasCenterDocked]}
            >
              <View
                accessible={false}
                pointerEvents="auto"
                style={styles.canvasGestureSurface}
                {...canvasResponder.panHandlers}
              />
              <View
                style={[
                  styles.deviceCluster,
                  { transform: [{ translateX: canvasOffset.x }, { translateY: canvasOffset.y }] }
                ]}
              >
                <View
                  style={[
                    styles.deviceFrame,
                    chromeLayout && styles.nativeDeviceFrame,
                    {
                      width: deviceFrame.frameWidth,
                      height: deviceFrame.frameHeight,
                      borderRadius: deviceFrame.outerRadius
                    }
                  ]}
                >
                  {chromeLayout && simulator.deviceChrome && (
                    <Image
                      resizeMode="stretch"
                      source={{ uri: simulator.deviceChrome.image }}
                      style={[
                        styles.nativeDeviceChrome,
                        {
                          left: chromeLayout.body.left,
                          top: chromeLayout.body.top,
                          width: chromeLayout.body.width,
                          height: chromeLayout.body.height,
                          transform: [{ rotate: chromeLayout.body.rotation }]
                        }
                      ]}
                    />
                  )}
                  <View
                    onLayout={(event) => {
                      frameLayout.current = event.nativeEvent.layout;
                    }}
                    style={[
                      styles.deviceScreen,
                      {
                        left: deviceFrame.insets.left,
                        top: deviceFrame.insets.top,
                        width: frameSize.width,
                        height: frameSize.height
                      }
                    ]}
                  >
                    <MaskedView
                      maskElement={
                        simulator.framebufferMask ? (
                          <View style={styles.screenMaskCenter}>
                            <Image
                              resizeMode="stretch"
                              source={{ uri: simulator.framebufferMask }}
                              style={{
                                width: maskGeometry.width,
                                height: maskGeometry.height,
                                transform: [{ rotate: maskGeometry.rotation }]
                              }}
                            />
                          </View>
                        ) : (
                          <View
                            style={[
                              StyleSheet.absoluteFill,
                              { backgroundColor: '#000', borderRadius: deviceFrame.screenRadius }
                            ]}
                          />
                        )
                      }
                      style={StyleSheet.absoluteFill}
                    >
                      <View style={styles.screenSurface}>
                        {simulatorLifecycle.active && (
                          <WebView
                            bounces={false}
                            javaScriptEnabled
                            key={`${simulatorLifecycle.revision}:${streamRevision}`}
                            onContentProcessDidTerminate={() => setStreamRevision((revision) => revision + 1)}
                            onMessage={() => setStreamReady(true)}
                            onRenderProcessGone={() => setStreamRevision((revision) => revision + 1)}
                            opaque={false}
                            originWhitelist={['*']}
                            scrollEnabled={false}
                            source={{ html }}
                            style={styles.webview}
                          />
                        )}
                        {selectionMode &&
                          !annotationImage &&
                          snapshot &&
                          accessibilityScreenMatchesOrientation(snapshot.screen, orientation) && (
                            <View
                              pointerEvents="none"
                              style={StyleSheet.absoluteFill}
                            >
                              {snapshot.elements
                                .filter(({ frame }) => frame.width > 0 && frame.height > 0)
                                .map((element) => (
                                  <View
                                    key={element.path}
                                    style={[
                                      styles.axFrame,
                                      element.isContainer && styles.axContainer,
                                      element.path === selectedPath && styles.axSelected,
                                      displayFrame(element, snapshot)
                                    ]}
                                  />
                                ))}
                            </View>
                          )}
                        <View
                          pointerEvents={annotationImage ? 'none' : 'auto'}
                          style={StyleSheet.absoluteFill}
                          {...responder.panHandlers}
                        />
                        {annotationImage && <View style={StyleSheet.absoluteFill}>{annotation.canvas}</View>}
                      </View>
                    </MaskedView>
                  </View>
                  {!chromeLayout && !simulator.framebufferMask && deviceFrame.hardware && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.deviceHardware,
                        deviceFrame.hardware.kind === 'home-button' && styles.deviceHomeButton,
                        deviceFrame.hardware.kind === 'camera' && styles.deviceCamera,
                        {
                          left: deviceFrame.hardware.x,
                          top: deviceFrame.hardware.y,
                          width: deviceFrame.hardware.width,
                          height: deviceFrame.hardware.height,
                          borderRadius: deviceFrame.hardware.height / 2
                        }
                      ]}
                    />
                  )}
                </View>
                <GlassSurface style={styles.deviceControls}>
                  <CanvasControl
                    disabled={toolsDisabled || selectionMode || Boolean(annotationImage)}
                    icon="arrow-undo"
                    label="Rotate left"
                    onPress={() => rotate('left')}
                  />
                  <CanvasControl
                    disabled={toolsDisabled || selectionMode || Boolean(annotationImage)}
                    icon="home-outline"
                    label="Home"
                    onPress={() => send(0x04, { button: 'home' })}
                  />
                  <CanvasControl
                    disabled={toolsDisabled || selectionMode || Boolean(annotationImage)}
                    icon={appearance === 'dark' ? 'moon-outline' : 'sunny-outline'}
                    label={appearance === 'dark' ? 'Dark' : 'Light'}
                    onPress={() => void changeAppearance(appearance === 'dark' ? 'light' : 'dark')}
                  />
                  <CanvasControl
                    disabled={toolsDisabled || selectionMode || Boolean(annotationImage)}
                    icon="lock-closed-outline"
                    label="Lock"
                    onPress={() => send(0x04, { button: 'lock' })}
                  />
                  <CanvasControl
                    disabled={toolsDisabled || selectionMode || Boolean(annotationImage)}
                    icon="clipboard-outline"
                    label="Paste"
                    onPress={() => setPasteVisible(true)}
                  />
                  <CanvasControl
                    disabled={toolsDisabled || selectionMode || Boolean(annotationImage)}
                    icon="arrow-redo"
                    label="Rotate right"
                    onPress={() => rotate('right')}
                  />
                </GlassSurface>
              </View>
            </View>
            {selectionMode && !annotationImage && !dockInspector && (
              <View style={[styles.canvasSelectionCard, parityStyles.selectionCard]}>
                <View style={styles.canvasSelectionIcon}>
                  <Ionicons
                    color={selected ? colors.accent : colors.muted}
                    name={selected ? 'checkmark' : 'scan-outline'}
                    size={18}
                  />
                </View>
                <View style={styles.canvasSelectionCopy}>
                  <Text
                    numberOfLines={1}
                    style={styles.canvasSelectionTitle}
                  >
                    {selected
                      ? selected.label || selected.value || selected.role || selected.type
                      : snapshot
                        ? 'Tap an element on the Simulator'
                        : 'Preparing selection…'}
                  </Text>
                  <Text style={styles.canvasSelectionMeta}>
                    {selected
                      ? `${selected.role || selected.type} · ${Math.round(selected.frame.width)} × ${Math.round(selected.frame.height)} at ${Math.round(selected.frame.x)}, ${Math.round(selected.frame.y)}`
                      : 'Accessibility bounds will appear over the live screen.'}
                  </Text>
                </View>
                {selected && (
                  <GlassControl
                    accessibilityLabel="Clear selected element"
                    contentStyle={styles.canvasSelectionActionContent}
                    glassStyle="clear"
                    onPress={() => setSelectedPath(null)}
                    style={styles.canvasSelectionAction}
                  >
                    <Ionicons
                      color={colors.muted}
                      name="close"
                      size={17}
                    />
                  </GlassControl>
                )}
                <GlassControl
                  accessibilityLabel="Open request with selected evidence"
                  contentStyle={styles.canvasSelectionActionContent}
                  glassStyle="clear"
                  onPress={() => setInspectorVisible(true)}
                  style={styles.canvasSelectionAction}
                >
                  <Ionicons
                    color={colors.text}
                    name="arrow-forward"
                    size={17}
                  />
                </GlassControl>
              </View>
            )}
            <GlassSurface style={styles.zoomControls}>
              <GlassControl
                accessibilityLabel="Zoom out"
                contentStyle={styles.zoomButtonContent}
                disabled={canvasScale <= minimumCanvasScale}
                glassStyle="clear"
                onPress={() => changeCanvasScale(canvasScale - canvasScaleStep)}
                palette={workspaceColors}
                style={styles.zoomButton}
                systemImage="minus"
              >
                <HugeiconsIcon
                  color={workspaceColors.muted}
                  icon={ZoomOutIcon}
                  size={18}
                  strokeWidth={1.8}
                />
              </GlassControl>
              <Text style={[styles.zoomValue, { color: workspaceColors.muted }]}>{Math.round(canvasScale * 100)}%</Text>
              <GlassControl
                accessibilityLabel="Zoom in"
                contentStyle={styles.zoomButtonContent}
                disabled={canvasScale >= maximumCanvasScale}
                glassStyle="clear"
                onPress={() => changeCanvasScale(canvasScale + canvasScaleStep)}
                palette={workspaceColors}
                style={styles.zoomButton}
                systemImage="plus"
              >
                <HugeiconsIcon
                  color={workspaceColors.muted}
                  icon={ZoomInIcon}
                  size={18}
                  strokeWidth={1.8}
                />
              </GlassControl>
              <GlassControl
                accessibilityLabel="Fit simulator to view"
                contentStyle={styles.zoomButtonContent}
                glassStyle="clear"
                onPress={fitCanvas}
                palette={workspaceColors}
                style={[styles.zoomButton, styles.zoomFitButton]}
                systemImage="arrow.up.left.and.arrow.down.right"
              >
                <HugeiconsIcon
                  color={workspaceColors.muted}
                  icon={FitToScreenIcon}
                  size={18}
                  strokeWidth={1.8}
                />
              </GlassControl>
              {!dockInspector && (
                <GlassControl
                  accessibilityLabel="Open workspace controls"
                  contentStyle={styles.zoomButtonContent}
                  glassStyle="clear"
                  onPress={() => setInspectorVisible(true)}
                  palette={workspaceColors}
                  style={styles.zoomButton}
                >
                  <Ionicons
                    color={workspaceColors.muted}
                    name="options-outline"
                    size={18}
                  />
                </GlassControl>
              )}
            </GlassSurface>
            {error && (
              <GlassControl
                accessibilityLabel="Dismiss error"
                contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => setError(null)}
                solid
                style={styles.canvasError}
              >
                <Ionicons
                  color={colors.danger}
                  name="warning-outline"
                  size={17}
                />
                <Text style={styles.canvasErrorText}>{error}</Text>
                <Ionicons
                  color={colors.muted}
                  name="close"
                  size={16}
                />
              </GlassControl>
            )}
            <View
              pointerEvents={variantVisible ? 'auto' : 'none'}
              style={[parityStyles.variantCanvas, dockInspector && { right: 380 }]}
            >
              <VariantModal
                autoCaptureKey={agentSession?.status === 'variants_ready' ? agentSession.changeRequest?.id : undefined}
                bundleIdentifier={connection.bundleIdentifier}
                confirmSelection={agentSession?.status === 'variants_ready' ? confirmAgentVariant : undefined}
                embedded
                locked={
                  agentVariantTransition !== null || agentSession?.status === 'selection_confirmed' || isEndingLive
                }
                onBusyChange={setVariantCaptureBusy}
                onClose={() => setVariantVisible(false)}
                onOpened={(variant) => {
                  setActiveVariant(variant);
                  setSelectedAgentVariant(variant);
                }}
                onRestored={() => {
                  setActiveVariant(null);
                  setSelectedAgentVariant('original');
                }}
                onSelectionChange={setSelectedAgentVariant}
                selectedVariant={selectedAgentVariant}
                variants={agentVariants}
                visible={variantVisible}
              />
            </View>
            {dockInspector && <View style={parityStyles.inspectorDock}>{inspector}</View>}
            {!agentFlowLocked && (
              <View
                collapsable={false}
                style={parityStyles.toolRail}
              >
                <ScrollView
                  automaticallyAdjustContentInsets={false}
                  contentContainerStyle={parityStyles.toolRailContent}
                  contentInsetAdjustmentBehavior="never"
                  removeClippedSubviews={false}
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                >
                  <GlassToolGroup
                    accessibilityLabel="Canvas tools"
                    items={[
                      {
                        label: 'Interact',
                        symbol: 'hand.point.up.left',
                        disabled: toolsDisabled || annotation.isFinishing || variantVisible,
                        onPress: activateInteract
                      },
                      {
                        label: 'Select',
                        symbol: 'cursorarrow.and.square.on.square.dashed',
                        disabled: toolsDisabled || annotation.isFinishing || variantVisible || Boolean(annotationImage),
                        onPress: () => {
                          setAnnotationImage(null);
                          setSelectionMode(true);
                        }
                      },
                      ...annotation.drawingTools
                    ]}
                    selectedIndex={
                      variantVisible ? -1 : annotationImage ? 2 + annotation.selectedToolIndex : selectionMode ? 1 : 0
                    }
                    style={parityStyles.toolGroup}
                  />
                  {annotation.tools}
                </ScrollView>
              </View>
            )}
          </View>
          {!dockInspector && (
            <Modal
              allowSwipeDismissal
              animationType="slide"
              onRequestClose={() => setInspectorVisible(false)}
              presentationStyle="pageSheet"
              supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
              visible={inspectorVisible}
            >
              <SafeAreaView style={[styles.inspectorModal, { backgroundColor: workspaceColors.panel }]}>
                {inspector}
              </SafeAreaView>
            </Modal>
          )}
          <Modal
            allowSwipeDismissal
            animationType="slide"
            onRequestClose={() => setPasteVisible(false)}
            presentationStyle="formSheet"
            supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
            visible={pasteVisible}
          >
            <View style={[styles.modalScrim, { backgroundColor: colors.panel }]}>
              <View style={[styles.pasteCard, parityStyles.pasteCard]}>
                <View style={styles.pasteHeading}>
                  <Text style={styles.cardTitle}>Paste into Simulator</Text>
                  <GlassControl
                    accessibilityLabel="Close paste dialog"
                    contentStyle={styles.modalCloseContent}
                    glassStyle="clear"
                    onPress={() => setPasteVisible(false)}
                    style={styles.modalClose}
                  >
                    <Ionicons
                      color={colors.muted}
                      name="close"
                      size={20}
                    />
                  </GlassControl>
                </View>
                <TextInput
                  autoFocus
                  multiline
                  onChangeText={setPasteText}
                  placeholder="Text to place on the Simulator pasteboard"
                  placeholderTextColor={colors.muted}
                  style={styles.pasteInput}
                  value={pasteText}
                />
                <GlassControl
                  contentStyle={styles.connectButtonContent}
                  disabled={!pasteText || Boolean(busy)}
                  onPress={() => void paste()}
                  style={styles.connectButton}
                  tone="accent"
                >
                  <Text style={styles.connectText}>Paste now</Text>
                </GlassControl>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  };
  return (
    <AnnotationWorkspace
      disabled={toolsDisabled}
      image={annotationImage}
      onActivate={() => void annotate()}
      onClose={() => setAnnotationImage(null)}
      onFinish={sendAnnotatedAgentRequest}
    >
      {renderWorkspace}
    </AnnotationWorkspace>
  );
}

const useParityStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    pageHeading: { position: 'absolute', top: 16, left: 24, right: 24, maxWidth: 320, zIndex: 4 },
    pageHeadingDocked: { right: 362 },
    simulatorTitle: { color: colors.text, fontSize: 26, fontWeight: '600', letterSpacing: -1.04, marginTop: 10 },
    workspaceContent: { position: 'absolute', inset: 0 },
    variantCanvas: { position: 'absolute', top: 116, left: 12, right: 12, bottom: 74, zIndex: 8 },
    inspectorDock: {
      position: 'absolute',
      top: 70,
      right: 18,
      bottom: 18,
      zIndex: 12,
      width: 326,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13
    },
    canvasCenterDocked: { marginRight: 362, marginLeft: 78 },
    toolRail: { position: 'absolute', left: 18, top: 150, bottom: 90, width: 64, zIndex: 20 },
    toolRailContent: { gap: 10, alignItems: 'center' },
    toolGroup: { alignSelf: 'center' },
    readout: { right: 18 },
    readoutText: { flexShrink: 1 },
    supportPanels: {
      position: 'absolute',
      top: 70,
      right: 362,
      left: 82,
      bottom: 18,
      zIndex: 15,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10
    },
    supportPanelsCompact: {
      position: 'relative',
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
      flexDirection: 'column',
      padding: 12
    },
    selectionCard: { maxWidth: '90%', bottom: 76 },
    pasteCard: { maxWidth: '92%' }
  })
);

function WorkspaceSupportPanel({
  title,
  icon,
  open,
  onToggle,
  children
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  const panelStyles = usePanelStyles();
  return (
    <View style={[panelStyles.panel, open && panelStyles.open]}>
      <GlassControl
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        contentStyle={panelStyles.trigger}
        onPress={onToggle}
        solid
      >
        <Ionicons
          color={colors.text}
          name={icon}
          size={16}
        />
        <Text style={panelStyles.title}>{title}</Text>
        <Ionicons
          color={colors.muted}
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
        />
      </GlassControl>
      <ScrollView
        contentContainerStyle={panelStyles.content}
        keyboardShouldPersistTaps="handled"
        style={!open && { display: 'none' }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
const usePanelStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    panel: {
      alignSelf: 'flex-start',
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden'
    },
    open: { flexShrink: 1, width: 340, maxWidth: '100%', maxHeight: '100%' },
    trigger: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: colors.text, fontSize: 12, flexShrink: 1 },
    content: { padding: 12 }
  })
);
