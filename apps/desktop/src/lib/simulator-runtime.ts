import type { SimulatorOrientation } from '@monaddesign/simulator';

import { simulatorOrientations } from '@monaddesign/simulator';

export interface SimulatorRuntimeConfiguration {
  orientation?: SimulatorOrientation;
  screenSize?: { width: number; height: number };
}

export const simulatorRuntimeDeviceSize = (
  screenSize: { width: number; height: number },
  devicePixelRatio: number
) => ({
  width: screenSize.width / devicePixelRatio,
  height: screenSize.height / devicePixelRatio
});

export const reconcileSimulatorRuntimeOrientation = ({
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

export const decodeSimulatorRuntimeConfiguration = (data: unknown): SimulatorRuntimeConfiguration | null => {
  if (!(data instanceof ArrayBuffer)) return null;
  const frame = new Uint8Array(data);
  if (frame[0] !== 130) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(frame.subarray(1))) as {
      height?: unknown;
      orientation?: unknown;
      width?: unknown;
    };
    return {
      ...(typeof value.width === 'number' && typeof value.height === 'number' && value.width > 0 && value.height > 0
        ? { screenSize: { width: value.width, height: value.height } }
        : {}),
      ...(typeof value.orientation === 'string' &&
      simulatorOrientations.includes(value.orientation as SimulatorOrientation)
        ? { orientation: value.orientation as SimulatorOrientation }
        : {})
    };
  } catch {
    return null;
  }
};
