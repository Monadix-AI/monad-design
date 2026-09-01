import type { ClientApi } from '@monaddesign/client-rtk/client-api';
import type { ActiveConnection, SimulatorAppearance } from '../desktop-model';
import type { AXSnapshot } from '../electron';

import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
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
  useEffect,
  useRef,
  useState
} from 'react';

import { decodeSimulatorRuntimeConfiguration, reconcileSimulatorRuntimeOrientation } from '../lib/simulator-runtime';

interface SimulatorRuntimeOptions {
  axSnapshot: AXSnapshot | null;
  connection: ActiveConnection | null;
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
  const pointerActive = useRef(false);
  const lastPointerMove = useRef(0);
  const appearanceChangeActive = useRef(false);
  const appearanceGeneration = useRef(0);
  const screenImage = useRef<HTMLImageElement | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const orientationSynchronization = useRef({
    expected: 'portrait' as SimulatorOrientation,
    requested: false,
    synchronized: false
  });

  useEffect(() => {
    if (!connection) return;
    orientationSynchronization.current = {
      expected: connection.orientation,
      requested: false,
      synchronized: false
    };
    setOrientation(connection.orientation);
    let active = true;
    const ws = new WebSocket(connection.wsUrl);
    ws.binaryType = 'arraybuffer';
    socket.current = ws;
    ws.addEventListener('open', () => {
      if (active && socket.current === ws) onError(null);
    });
    ws.addEventListener('error', () => {
      if (active && socket.current === ws) onError('The simulator input channel could not be opened.');
    });
    ws.addEventListener('message', (event) => {
      if (!active || socket.current !== ws) return;
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
        ws.send(
          encodeSimulatorFrame(0x07, {
            orientation: orientationSynchronization.current.expected
          })
        );
      }
      if (synchronizedOrientation.orientation) setOrientation(synchronizedOrientation.orientation);
    });
    return () => {
      active = false;
      if (socket.current === ws) socket.current = null;
      ws.close();
    };
  }, [connection, onError]);

  useEffect(() => {
    if (!logicalScreenSize || devicePixelRatio !== 1 || screenSize.width < 500) return;
    const widthRatio = screenSize.width / logicalScreenSize.width;
    const heightRatio = screenSize.height / logicalScreenSize.height;
    const ratio = (widthRatio + heightRatio) / 2;
    if (ratio > 1.25 && ratio < 4.25) setDevicePixelRatio(ratio);
  }, [devicePixelRatio, logicalScreenSize, screenSize]);

  const sendFrame = (tag: number, payload: object) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      onError('The simulator input channel is not ready yet.');
      return false;
    }
    ws.send(encodeSimulatorFrame(tag, payload));
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
  const pointFromEvent = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = screenImage.current?.getBoundingClientRect();
    return bounds ? normalizedCanvasPoint({ x: event.clientX, y: event.clientY }, bounds) : null;
  };
  const sendTouch = (type: 'begin' | 'move' | 'end', event: PointerEvent<HTMLButtonElement>) => {
    const point = pointFromEvent(event);
    if (!point) return false;
    const simulatorPoint = orientCanvasPoint(point, orientation);
    return sendFrame(0x03, { type, ...simulatorPoint });
  };
  const updatePointer = (event: PointerEvent<HTMLButtonElement>) => {
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
    event.currentTarget.focus();
    const point = updatePointer(event);
    if (isSelectionMode) {
      onSelectedPathChange(point && axSnapshot ? (accessibilityElementAtPoint(axSnapshot, point)?.path ?? null) : null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActive.current = sendTouch('begin', event);
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    updatePointer(event);
    const now = performance.now();
    if (isSelectionMode || !pointerActive.current || now - lastPointerMove.current < 8) return;
    lastPointerMove.current = now;
    sendTouch('move', event);
  };
  const finishPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerActive.current) sendTouch('end', event);
    pointerActive.current = false;
  };
  const leavePointer = () => onHoveredPathChange(null);
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
    appearanceGeneration.current += 1;
    appearanceChangeActive.current = false;
    pointerActive.current = false;
    socket.current?.close();
    socket.current = null;
    setIsStreamReady(false);
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
  const initializeScreen = (size: { width: number; height: number }) => {
    setScreenSize(size);
    setDevicePixelRatio(1);
  };
  const isLandscape = orientation === 'landscape_left' || orientation === 'landscape_right';

  return {
    appearance,
    changeAppearance,
    deviceHeight: (isLandscape ? screenSize.width : screenSize.height) / devicePixelRatio,
    deviceWidth: (isLandscape ? screenSize.height : screenSize.width) / devicePixelRatio,
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
  };
};
