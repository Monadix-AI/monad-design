import type { SimulatorOrientation } from '@monaddesign/simulator';

import { encodeSimulatorFrame, simulatorOrientations } from '@monaddesign/simulator';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SimulatorScreenSize {
  height: number;
  width: number;
}

export const reconcileSimulatorOrientation = ({
  expected,
  received,
  synchronized
}: {
  expected: SimulatorOrientation;
  received?: SimulatorOrientation;
  synchronized: boolean;
}) => {
  if (!received || (!synchronized && received !== expected)) {
    return { orientation: null, synchronized };
  }
  return { orientation: received, synchronized: true };
};

export const useSimulatorInput = ({
  initialOrientation,
  initialScreenSize,
  inputUrl,
  onError
}: {
  initialOrientation: SimulatorOrientation;
  initialScreenSize: SimulatorScreenSize;
  inputUrl: string;
  onError: (message: string | null) => void;
}) => {
  const socket = useRef<WebSocket | null>(null);
  const orientationSynchronization = useRef({
    expected: initialOrientation,
    requested: false,
    synchronized: false
  });
  const [ready, setReady] = useState(false);
  const [orientation, setOrientationState] = useState(initialOrientation);
  const [screenSize, setScreenSize] = useState(initialScreenSize);

  useEffect(() => {
    orientationSynchronization.current = {
      expected: initialOrientation,
      requested: false,
      synchronized: false
    };
    const ws = new WebSocket(inputUrl);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      setReady(true);
      onError(null);
    };
    ws.onerror = () => onError('The Simulator input channel could not be opened.');
    ws.onclose = () => setReady(false);
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const frame = new Uint8Array(event.data);
      if (frame[0] !== 130) return;
      try {
        const value = JSON.parse(new TextDecoder().decode(frame.subarray(1))) as {
          width?: number;
          height?: number;
          orientation?: SimulatorOrientation;
        };
        if (value.width && value.height) {
          setScreenSize((current) =>
            current.width === value.width && current.height === value.height
              ? current
              : { width: value.width as number, height: value.height as number }
          );
        }
        const synchronizedOrientation = reconcileSimulatorOrientation({
          ...orientationSynchronization.current,
          received: value.orientation
        });
        orientationSynchronization.current.synchronized = synchronizedOrientation.synchronized;
        if (
          value.orientation &&
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
        if (synchronizedOrientation.orientation) setOrientationState(synchronizedOrientation.orientation);
      } catch {
        // Stream configuration is advisory; malformed frames do not block input.
      }
    };
    socket.current = ws;
    return () => {
      socket.current = null;
      ws.close();
    };
  }, [initialOrientation, inputUrl, onError]);

  const send = useCallback(
    (tag: number, payload: object) => {
      if (socket.current?.readyState !== WebSocket.OPEN) {
        onError('Simulator input is still starting.');
        return false;
      }
      if (tag === 0x07) {
        const nextOrientation = (payload as { orientation?: unknown }).orientation;
        if (
          typeof nextOrientation === 'string' &&
          simulatorOrientations.includes(nextOrientation as SimulatorOrientation)
        ) {
          orientationSynchronization.current.expected = nextOrientation as SimulatorOrientation;
          orientationSynchronization.current.requested = false;
        }
      }
      socket.current.send(encodeSimulatorFrame(tag, payload));
      return true;
    },
    [onError]
  );

  const setOrientation = useCallback((nextOrientation: SimulatorOrientation) => {
    orientationSynchronization.current.expected = nextOrientation;
    orientationSynchronization.current.requested = false;
    setOrientationState(nextOrientation);
  }, []);

  return { orientation, ready, screenSize, send, setOrientation };
};
