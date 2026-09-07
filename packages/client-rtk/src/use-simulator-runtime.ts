import type { AccessibilitySnapshotResponse } from '@monaddesign/client-contract';
import type { ClientApi } from './client-api';

import {
  accessibilityElementAtPoint,
  encodeSimulatorFrame,
  normalizedCanvasPoint,
  orientCanvasPoint,
  rotatedSimulatorOrientation,
  type SimulatorOrientation,
  simulatorKeyUsage,
  simulatorOrientations
} from '@monaddesign/simulator';
import {
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import { errorMessage } from './endpoint-helpers';
import { createFrameTask } from './frame-task';
import { connectSimulatorInputChannel } from './simulator-input-channel';
import {
  decodeSimulatorRuntimeConfiguration,
  reconcileSimulatorRuntimeOrientation,
  simulatorRuntimeDeviceSize
} from './simulator-runtime';

export type SimulatorAppearance = 'light' | 'dark';

export interface SimulatorRuntimeConnection {
  orientation?: SimulatorOrientation;
  wsUrl: string;
}

interface SimulatorRuntimeOptions {
  axSnapshot: AccessibilitySnapshotResponse | null;
  connection: SimulatorRuntimeConnection | null;
  hasConnectedSimulator: boolean;
  isSelectionMode: boolean;
  onError: (message: string | null) => void;
  onHoveredPathChange: (path: string | null) => void;
  onSelectedPathChange: Dispatch<SetStateAction<string | null>>;
  runtimeClient: ClientApi | null;
}

const defaultScreenSize = { width: 390, height: 844 };

export const useSimulatorRuntime = ({
  axSnapshot,
  connection,
  hasConnectedSimulator,
  isSelectionMode,
  onError,
  onHoveredPathChange,
  onSelectedPathChange,
  runtimeClient
}: SimulatorRuntimeOptions) => {
  const [appearance, setAppearance] = useState<SimulatorAppearance | null>(null);
  const [isAppearanceChanging, setIsAppearanceChanging] = useState(false);
  const [orientation, setOrientation] = useState<SimulatorOrientation>('portrait');
  const [screenSize, setScreenSize] = useState(defaultScreenSize);
  const [logicalScreenSize, setLogicalScreenSize] = useState<{ width: number; height: number } | null>(null);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number; pressed: boolean } | null>(null);
  const pointerActive = useRef(false);
  const [pointerUpdates] = useState(() => createFrameTask());
  const appearanceChangeActive = useRef(false);
  const appearanceGeneration = useRef(0);
  const screenImage = useRef<HTMLImageElement | null>(null);
  const inputChannel = useRef<ReturnType<typeof connectSimulatorInputChannel> | null>(null);
  const orientationSynchronization = useRef({
    expected: 'portrait' as SimulatorOrientation,
    requested: false,
    synchronized: false
  });

  useEffect(() => {
    if (!connection) return;
    orientationSynchronization.current = {
      expected: connection.orientation ?? 'portrait',
      requested: false,
      synchronized: false
    };
    setOrientation(connection.orientation ?? 'portrait');
    const channel = connectSimulatorInputChannel({
      url: connection.wsUrl,
      onOpen: () => {
        orientationSynchronization.current.requested = false;
        orientationSynchronization.current.synchronized = false;
        onError(null);
      },
      onDisconnected: () => {
        pointerUpdates.cancel();
        pointerActive.current = false;
        setPointer(null);
        onHoveredPathChange(null);
        onError('The simulator input channel disconnected. Reconnecting…');
      },
      onUnavailable: () =>
        onError('The simulator input channel could not reconnect. Reconnect the Simulator to retry.'),
      onMessage: (event, ws) => {
        const configuration = decodeSimulatorRuntimeConfiguration(event.data);
        if (configuration?.screenSize) setScreenSize(configuration.screenSize);
        const synchronizedOrientation = reconcileSimulatorRuntimeOrientation({
          ...orientationSynchronization.current,
          received: configuration?.orientation
        });
        orientationSynchronization.current.synchronized = synchronizedOrientation.synchronized;
        if (
          configuration?.orientation &&
          !synchronizedOrientation.synchronized &&
          !orientationSynchronization.current.requested
        ) {
          orientationSynchronization.current.requested = true;
          ws.send(encodeSimulatorFrame(0x07, { orientation: orientationSynchronization.current.expected }));
        }
        if (synchronizedOrientation.orientation) setOrientation(synchronizedOrientation.orientation);
      }
    });
    inputChannel.current = channel;
    return () => {
      pointerUpdates.cancel();
      channel.close();
      if (inputChannel.current === channel) inputChannel.current = null;
      pointerActive.current = false;
      setPointer(null);
      setIsStreamReady(false);
    };
  }, [connection, onError, onHoveredPathChange, pointerUpdates]);

  useEffect(() => {
    if (!logicalScreenSize || devicePixelRatio !== 1 || screenSize.width < 500) return;
    const widthRatio = screenSize.width / logicalScreenSize.width;
    const heightRatio = screenSize.height / logicalScreenSize.height;
    const ratio = (widthRatio + heightRatio) / 2;
    if (ratio > 1.25 && ratio < 4.25) setDevicePixelRatio(ratio);
  }, [devicePixelRatio, logicalScreenSize, screenSize]);

  const sendFrame = (tag: number, payload: object) => {
    if (!inputChannel.current?.send(encodeSimulatorFrame(tag, payload))) {
      onError('The simulator input channel is not ready yet.');
      return false;
    }
    if (tag === 0x07) {
      const nextOrientation = (payload as { orientation?: unknown }).orientation;
      if (
        typeof nextOrientation === 'string' &&
        simulatorOrientations.includes(nextOrientation as SimulatorOrientation)
      ) {
        orientationSynchronization.current = {
          expected: nextOrientation as SimulatorOrientation,
          requested: true,
          synchronized: false
        };
      }
    }
    return true;
  };
  const pointFromEvent = (event: Pick<PointerEvent<HTMLButtonElement>, 'clientX' | 'clientY'>) => {
    const bounds = screenImage.current?.getBoundingClientRect();
    return bounds ? normalizedCanvasPoint({ x: event.clientX, y: event.clientY }, bounds) : null;
  };
  const sendTouch = (type: 'begin' | 'move' | 'end', point: { x: number; y: number } | null) => {
    if (!point) return false;
    const simulatorPoint = orientCanvasPoint(point, orientation);
    return sendFrame(0x03, { type, ...simulatorPoint });
  };
  const updatePointer = (event: Pick<PointerEvent<HTMLButtonElement>, 'clientX' | 'clientY'>) => {
    const point = pointFromEvent(event);
    if (isSelectionMode && axSnapshot && point) {
      onHoveredPathChange(accessibilityElementAtPoint(axSnapshot, point)?.path ?? null);
    } else {
      onHoveredPathChange(null);
    }
    return point;
  };
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!hasConnectedSimulator) return;
    pointerUpdates.cancel();
    event.currentTarget.focus();
    const point = updatePointer(event);
    setPointer(point ? { ...point, pressed: !isSelectionMode } : null);
    if (isSelectionMode) {
      onSelectedPathChange(point && axSnapshot ? (accessibilityElementAtPoint(axSnapshot, point)?.path ?? null) : null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActive.current = sendTouch('begin', point);
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const coordinates = { clientX: event.clientX, clientY: event.clientY };
    pointerUpdates.schedule(() => {
      const point = updatePointer(coordinates);
      const pressed = !isSelectionMode && pointerActive.current;
      setPointer(point ? { ...point, pressed } : null);
      if (pressed) sendTouch('move', point);
    });
  };
  const finishPointer = (event: PointerEvent<HTMLButtonElement>) => {
    pointerUpdates.flush();
    const point = pointFromEvent(event);
    if (pointerActive.current) sendTouch('end', point);
    pointerActive.current = false;
    setPointer(point ? { ...point, pressed: false } : null);
  };
  const leavePointer = () => {
    pointerUpdates.cancel();
    onHoveredPathChange(null);
    setPointer((current) => (current?.pressed ? current : null));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Queued coordinates must not survive mode or orientation changes.
  useEffect(() => () => pointerUpdates.cancel(), [isSelectionMode, orientation, pointerUpdates]);
  const sendKey = (usage: number, type: 'down' | 'up') => sendFrame(0x06, { type, usage });
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, type: 'down' | 'up') => {
    if (!hasConnectedSimulator || (event.metaKey && event.code === 'KeyV')) return;
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
      onError(null);
    } catch (pasteError) {
      onError(errorMessage(pasteError));
    }
  };
  const handlePaste = (event: ClipboardEvent<HTMLButtonElement>) => {
    if (!hasConnectedSimulator) return;
    event.preventDefault();
    void pasteText(event.clipboardData.getData('text'));
  };
  const rotate = (direction: 'left' | 'right') => {
    const nextOrientation = rotatedSimulatorOrientation(orientation, direction);
    if (sendFrame(0x07, { orientation: nextOrientation })) setOrientation(nextOrientation);
  };
  const changeAppearance = async (nextAppearance: SimulatorAppearance) => {
    if (nextAppearance === appearance || appearanceChangeActive.current) return;
    const generation = ++appearanceGeneration.current;
    appearanceChangeActive.current = true;
    setIsAppearanceChanging(true);
    try {
      if (!runtimeClient) throw new Error('The desktop runtime is not ready yet.');
      await runtimeClient.setAppearance(nextAppearance);
      if (generation !== appearanceGeneration.current) return;
      setAppearance(nextAppearance);
      onError(null);
    } catch (appearanceError) {
      if (generation === appearanceGeneration.current) onError(errorMessage(appearanceError));
    } finally {
      if (generation === appearanceGeneration.current) {
        appearanceChangeActive.current = false;
        setIsAppearanceChanging(false);
      }
    }
  };
  const resetSimulatorRuntime = () => {
    pointerUpdates.cancel();
    appearanceGeneration.current += 1;
    appearanceChangeActive.current = false;
    pointerActive.current = false;
    inputChannel.current?.close();
    inputChannel.current = null;
    setIsStreamReady(false);
    setPointer(null);
    setAppearance(null);
    setIsAppearanceChanging(false);
    setOrientation('portrait');
    orientationSynchronization.current = {
      expected: 'portrait',
      requested: false,
      synchronized: false
    };
    setScreenSize(defaultScreenSize);
    setLogicalScreenSize(null);
    setDevicePixelRatio(1);
  };
  const initializeScreen = useCallback((size: { width: number; height: number }) => {
    setScreenSize((current) => (current.width === size.width && current.height === size.height ? current : size));
    setDevicePixelRatio(1);
  }, []);
  const isLandscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const deviceSize = simulatorRuntimeDeviceSize(screenSize, devicePixelRatio);

  return {
    appearance,
    changeAppearance,
    deviceHeight: deviceSize.height,
    deviceWidth: deviceSize.width,
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
    pointer,
    resetSimulatorRuntime,
    rotate,
    screenImage,
    screenSize,
    sendFrame,
    setAppearance,
    setIsStreamReady,
    setLogicalScreenSize,
    setOrientation
  };
};
