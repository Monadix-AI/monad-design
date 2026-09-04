import { describe, expect, test } from 'bun:test';
import {
  decodeSimulatorRuntimeConfiguration,
  reconcileSimulatorRuntimeOrientation,
  simulatorRuntimeDeviceSize
} from '@monaddesign/client-rtk/simulator-runtime';

const frame = (value: unknown, tag = 130) => {
  const payload = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(payload.length + 1);
  data[0] = tag;
  data.set(payload, 1);
  return data.buffer;
};

describe('Simulator runtime configuration', () => {
  test('decodes valid orientation and screen dimensions', () => {
    expect(
      decodeSimulatorRuntimeConfiguration(frame({ width: 1179, height: 2556, orientation: 'landscape_left' }))
    ).toEqual({
      orientation: 'landscape_left',
      screenSize: { width: 1179, height: 2556 }
    });
  });

  test('ignores invalid fields and unrelated frames', () => {
    expect(decodeSimulatorRuntimeConfiguration(frame({ width: -1, height: 0, orientation: 'diagonal' }))).toEqual({});
    expect(decodeSimulatorRuntimeConfiguration(frame({}, 3))).toBeNull();
    expect(decodeSimulatorRuntimeConfiguration('not binary')).toBeNull();
  });

  test('keeps the Core orientation until the runtime stream catches up', () => {
    expect(
      reconcileSimulatorRuntimeOrientation({
        expected: 'landscape_left',
        received: 'portrait',
        synchronized: false
      })
    ).toEqual({ orientation: null, synchronized: false });
    expect(
      reconcileSimulatorRuntimeOrientation({
        expected: 'landscape_left',
        received: 'landscape_left',
        synchronized: false
      })
    ).toEqual({ orientation: 'landscape_left', synchronized: true });
  });

  test('accepts later runtime orientation changes after synchronization', () => {
    expect(
      reconcileSimulatorRuntimeOrientation({
        expected: 'landscape_left',
        received: 'portrait',
        synchronized: true
      })
    ).toEqual({ orientation: 'portrait', synchronized: true });
  });

  test('keeps raw portrait stream dimensions for the canvas rotation layer', () => {
    expect(simulatorRuntimeDeviceSize({ width: 1179, height: 2556 }, 3)).toEqual({
      width: 393,
      height: 852
    });
  });
});
