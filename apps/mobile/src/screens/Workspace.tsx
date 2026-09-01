import type {
  AccessibilitySnapshotResponse as AXSnapshot,
  IOSSimulator,
  SimulatorConnectionResponse as SimulatorConnection
} from '@monaddesign/client-contract';
import type { SimulatorOrientation, SimulatorVariantId } from '@monaddesign/simulator';

import { ClientApi } from '@monaddesign/client-rtk/client-api';

type AXElement = AXSnapshot['elements'][number];

import Ionicons from '@expo/vector-icons/Ionicons';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { useStore } from 'zustand';

import { AgentRequestPanel } from '../components/AgentRequestPanel';
import { AnnotationModal } from '../components/AnnotationModal';
import { GlassControl } from '../components/GlassControl';
import { VariantModal } from '../components/VariantModal';
import { CanvasControl, ModeButton } from '../components/WorkspaceControls';
import { useLiveAgentSession } from '../hooks/use-live-agent-session';
import { useSimulatorInput } from '../hooks/use-simulator-input';
import { styles } from '../styles';
import { colors, errorMessage } from '../theme';
import { simulatorChromeLayout, simulatorFrameSize, simulatorMaskGeometry } from '../workspace-layout';

const displayFrame = (element: AXElement, snapshot: AXSnapshot, orientation: SimulatorOrientation) => {
  const x = element.frame.x / snapshot.screen.width;
  const y = element.frame.y / snapshot.screen.height;
  const width = element.frame.width / snapshot.screen.width;
  const height = element.frame.height / snapshot.screen.height;
  if (orientation === 'landscape_left')
    return {
      left: `${(1 - y - height) * 100}%` as const,
      top: `${x * 100}%` as const,
      width: `${height * 100}%` as const,
      height: `${width * 100}%` as const
    };
  if (orientation === 'landscape_right')
    return {
      left: `${y * 100}%` as const,
      top: `${(1 - x - width) * 100}%` as const,
      width: `${height * 100}%` as const,
      height: `${width * 100}%` as const
    };
  if (orientation === 'portrait_upside_down')
    return {
      left: `${(1 - x - width) * 100}%` as const,
      top: `${(1 - y - height) * 100}%` as const,
      width: `${width * 100}%` as const,
      height: `${height * 100}%` as const
    };
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
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
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
            fill="#30343b"
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
  const touchActive = useRef(false);
  const [streamReady, setStreamReady] = useState(false);
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
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const autoOpenedAgentRequest = useRef<string | null>(null);
  const [pasteVisible, setPasteVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [annotationImage, setAnnotationImage] = useState<string | null>(null);
  const [variantVisible, setVariantVisible] = useState(false);
  const [activeVariant, setActiveVariant] = useState<SimulatorVariantId | null>(null);
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
  const {
    orientation,
    ready: socketReady,
    screenSize,
    send,
    setOrientation
  } = useSimulatorInput({
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
    setSelectionMode(false);
    setAnnotationImage(null);
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
          if (selectionMode && snapshot) {
            setSelectedPath(axElementAtPoint(snapshot, point)?.path ?? null);
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
    [onTouch, selectionMode, snapshot, setSelectedPath]
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
      setSelectionMode(false);
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
    if (agentSession?.status !== 'awaiting_request' || !request.trim()) return;
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      let context = agentTurnContext;
      if (!selected) {
        const currentSnapshot = await api.accessibility();
        context = buildAgentTurnContext({
          bundleIdentifier: connection.bundleIdentifier,
          snapshot: currentSnapshot,
          simulator
        });
      }
      const next = await api.submitAgentRequest(agentSession.id, {
        request,
        variantCount,
        context
      });
      setAgentSession(next);
      setRequest('');
      setVariantCount(1);
    } catch (reason) {
      setAgentSessionError(errorMessage(reason));
    } finally {
      setIsSendingAgentRequest(false);
    }
  };
  const sendAnnotatedAgentRequest = async (annotationScreenshot: string) => {
    if (agentSession?.status !== 'awaiting_request') {
      throw new Error('Start Live and wait until the agent is ready before finishing the annotation.');
    }
    setIsSendingAgentRequest(true);
    setAgentSessionError(null);
    try {
      const currentSnapshot = await api.accessibility();
      const context = buildAgentTurnContext({
        bundleIdentifier: connection.bundleIdentifier,
        snapshot: currentSnapshot,
        simulator
      });
      const next = await api.submitAgentRequest(agentSession.id, {
        request: request.trim() || 'Implement the changes shown in the attached annotated screenshot.',
        variantCount,
        context,
        annotationScreenshot
      });
      setAgentSession(next);
      setRequest('');
      setVariantCount(1);
    } catch (reason) {
      const message = errorMessage(reason);
      setAgentSessionError(message);
      throw new Error(message);
    } finally {
      setIsSendingAgentRequest(false);
    }
  };
  const agentVariants = simulatorVariantIdsForCount(agentSession?.changeRequest?.variantCount ?? 3);
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
    if (!selectedAgentVariant) return;
    setAgentVariantTransition('accepting');
    try {
      await confirmAgentVariant(selectedAgentVariant);
    } finally {
      setAgentVariantTransition(null);
    }
  };
  const discardAgentChange = async () => {
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
    try {
      await disconnectSimulator().unwrap();
    } catch {
      /* The local UI can still leave a dead session. */
    }
    onExit();
  };
  return (
    <SafeAreaView style={styles.workspaceRoot}>
      <View style={styles.canvasArea}>
        <View style={styles.canvasReadout}>
          <View style={[styles.canvasReadoutDot, socketReady && streamReady && styles.liveDotOn]} />
          <Text style={styles.canvasSize}>
            {simulator.name} · {Math.round(screenSize.width)} × {Math.round(screenSize.height)} ·{' '}
            {orientation.replaceAll('_', ' ')}
          </Text>
          {activeVariant && <Text style={styles.previewBoundary}>{activeVariant.toUpperCase()} · PREVIEW ONLY</Text>}
        </View>
        <View style={styles.canvasModeBar}>
          <ModeButton
            active={!selectionMode && !annotationImage}
            disabled={variantVisible || busy === 'capture'}
            label="Interact"
            onPress={() => {
              setAnnotationImage(null);
              setSelectionMode(false);
            }}
          />
          <ModeButton
            active={selectionMode}
            disabled={variantVisible || busy === 'capture'}
            label="Select"
            onPress={() => {
              setAnnotationImage(null);
              setSelectionMode(true);
            }}
          />
          <ModeButton
            active={Boolean(annotationImage)}
            disabled={variantVisible || Boolean(busy)}
            label={busy === 'capture' ? 'Capturing…' : 'Annotate'}
            onPress={() => void annotate()}
          />
        </View>
        <Text style={styles.canvasGestureHint}>Drag canvas · pinch to zoom</Text>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setCanvasViewport((current) =>
              current?.width === width && current.height === height ? current : { width, height }
            );
          }}
          style={styles.canvasCenter}
        >
          <CanvasGrid />
          <View
            accessible={false}
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
                    <WebView
                      bounces={false}
                      javaScriptEnabled
                      onMessage={() => setStreamReady(true)}
                      opaque={false}
                      originWhitelist={['*']}
                      scrollEnabled={false}
                      source={{ html }}
                      style={styles.webview}
                    />
                    {selectionMode && snapshot && (
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
                                displayFrame(element, snapshot, orientation)
                              ]}
                            />
                          ))}
                      </View>
                    )}
                    <View
                      style={StyleSheet.absoluteFill}
                      {...responder.panHandlers}
                    />
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
            <View style={styles.deviceControls}>
              <CanvasControl
                icon="arrow-undo"
                label="Rotate left"
                onPress={() => rotate('left')}
              />
              <CanvasControl
                icon="home-outline"
                label="Home"
                onPress={() => send(0x04, { button: 'home' })}
              />
              <CanvasControl
                disabled={busy === 'appearance'}
                icon={appearance === 'dark' ? 'moon-outline' : 'sunny-outline'}
                label={appearance === 'dark' ? 'Dark' : 'Light'}
                onPress={() => void changeAppearance(appearance === 'dark' ? 'light' : 'dark')}
              />
              <CanvasControl
                icon="lock-closed-outline"
                label="Lock"
                onPress={() => send(0x04, { button: 'lock' })}
              />
              <CanvasControl
                icon="clipboard-outline"
                label="Paste"
                onPress={() => setPasteVisible(true)}
              />
              <CanvasControl
                icon="arrow-redo"
                label="Rotate right"
                onPress={() => rotate('right')}
              />
            </View>
          </View>
        </View>
        {selectionMode && (
          <View style={styles.canvasSelectionCard}>
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
        <View style={styles.zoomControls}>
          <GlassControl
            accessibilityLabel="Zoom out"
            contentStyle={styles.zoomButtonContent}
            disabled={canvasScale <= minimumCanvasScale}
            glassStyle="clear"
            onPress={() => changeCanvasScale(canvasScale - canvasScaleStep)}
            style={styles.zoomButton}
          >
            <Ionicons
              color={colors.text}
              name="remove"
              size={18}
            />
          </GlassControl>
          <Text style={styles.zoomValue}>{Math.round(canvasScale * 100)}%</Text>
          <GlassControl
            accessibilityLabel="Zoom in"
            contentStyle={styles.zoomButtonContent}
            disabled={canvasScale >= maximumCanvasScale}
            glassStyle="clear"
            onPress={() => changeCanvasScale(canvasScale + canvasScaleStep)}
            style={styles.zoomButton}
          >
            <Ionicons
              color={colors.text}
              name="add"
              size={18}
            />
          </GlassControl>
          <GlassControl
            accessibilityLabel="Fit simulator to view"
            contentStyle={styles.zoomButtonContent}
            glassStyle="clear"
            onPress={() => {
              fitCanvas();
            }}
            style={styles.zoomButton}
          >
            <Ionicons
              color={colors.text}
              name="scan-outline"
              size={17}
            />
          </GlassControl>
          <GlassControl
            accessibilityLabel="Open workspace controls"
            contentStyle={styles.zoomButtonContent}
            glassStyle="clear"
            onPress={() => setInspectorVisible(true)}
            style={styles.zoomButton}
          >
            <Ionicons
              color={colors.text}
              name="options-outline"
              size={18}
            />
          </GlassControl>
          <GlassControl
            accessibilityLabel="Disconnect Simulator"
            contentStyle={styles.zoomButtonContent}
            glassStyle="clear"
            onPress={() => void exit()}
            style={styles.zoomButton}
          >
            <Ionicons
              color={colors.muted}
              name="log-out-outline"
              size={18}
            />
          </GlassControl>
        </View>
        {error && (
          <Pressable
            onPress={() => setError(null)}
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
          </Pressable>
        )}
      </View>
      <Modal
        animationType="slide"
        onRequestClose={() => setInspectorVisible(false)}
        visible={inspectorVisible}
      >
        <SafeAreaView style={styles.inspectorModal}>
          <View style={styles.inspectorTitlebar}>
            <View>
              <Text style={styles.inspectorTitle}>Workspace</Text>
              <Text style={styles.inspectorRuntime}>{simulator.runtime}</Text>
            </View>
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
          </View>
          <ScrollView
            contentContainerStyle={styles.inspectorContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.inspectorSection}>
              <View style={styles.inspectorSectionHeading}>
                <Text style={styles.inspectorSectionTitle}>Mode</Text>
                <Text style={styles.inspectorSectionMeta}>
                  {busy === 'capture'
                    ? 'Capturing annotation'
                    : annotationImage
                      ? 'Annotate screenshot'
                      : variantVisible
                        ? 'Review variants'
                        : selectionMode
                          ? 'Select runtime element'
                          : 'Control app'}
                </Text>
              </View>
              <View style={styles.modeSwitch}>
                <ModeButton
                  active={!selectionMode}
                  disabled={variantVisible || busy === 'capture'}
                  label="Interact"
                  onPress={() => setSelectionMode(false)}
                />
                <ModeButton
                  active={selectionMode}
                  disabled={variantVisible || busy === 'capture'}
                  label="Select"
                  onPress={() => setSelectionMode(true)}
                />
                <ModeButton
                  disabled={variantVisible || Boolean(busy)}
                  label={busy === 'capture' ? 'Capturing…' : 'Annotate'}
                  onPress={() => void annotate()}
                />
              </View>
            </View>
            <AgentRequestPanel
              error={agentSessionError}
              isSending={isSendingAgentRequest}
              onAccept={() => void acceptAgentVariant()}
              onClearSelection={() => setSelectedPath(null)}
              onCompare={() => {
                setSelectionMode(false);
                setAnnotationImage(null);
                setVariantVisible(true);
              }}
              onDiscard={() => void discardAgentChange()}
              onPreviewVariant={(variant) => void previewAgentVariant(variant)}
              onRequestChange={setRequest}
              onSelectEvidence={() => setSelectionMode(true)}
              onSend={() => void sendAgentRequest()}
              onVariantCountChange={setVariantCount}
              request={request}
              selected={selected}
              selectedVariant={selectedAgentVariant}
              session={agentSession?.project.id === connection.projectId ? agentSession : null}
              snapshot={snapshot}
              transition={agentVariantTransition}
              variantCount={variantCount}
              variants={agentVariants}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setPasteVisible(false)}
        supportedOrientations={['landscape-left', 'landscape-right']}
        transparent
        visible={pasteVisible}
      >
        <View style={styles.modalScrim}>
          <View style={styles.pasteCard}>
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
              placeholderTextColor="#666a72"
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
      <AnnotationModal
        image={annotationImage}
        isRecapturing={captureState.isFetching}
        onClose={() => setAnnotationImage(null)}
        onFinish={sendAnnotatedAgentRequest}
        onRecapture={() => void annotate()}
      />
      <VariantModal
        autoCaptureKey={agentSession?.status === 'variants_ready' ? agentSession.changeRequest?.id : undefined}
        bundleIdentifier={connection.bundleIdentifier}
        confirmSelection={agentSession?.status === 'variants_ready' ? confirmAgentVariant : undefined}
        onClose={() => setVariantVisible(false)}
        onOpened={setActiveVariant}
        onRestored={() => setActiveVariant(null)}
        variants={agentVariants}
        visible={variantVisible}
      />
    </SafeAreaView>
  );
}
