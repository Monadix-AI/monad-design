import { describe, expect, test } from 'bun:test';

import { reconcileSimulatorOrientation } from '../../src/hooks/use-simulator-input';

describe('Simulator input orientation synchronization', () => {
  test('ignores the stream default until it confirms the authoritative initial orientation', () => {
    expect(
      reconcileSimulatorOrientation({
        expected: 'landscape_left',
        received: 'portrait',
        synchronized: false
      })
    ).toEqual({ orientation: null, synchronized: false });

    expect(
      reconcileSimulatorOrientation({
        expected: 'landscape_left',
        received: 'landscape_left',
        synchronized: false
      })
    ).toEqual({ orientation: 'landscape_left', synchronized: true });
  });

  test('accepts subsequent orientation broadcasts after synchronization', () => {
    expect(
      reconcileSimulatorOrientation({
        expected: 'landscape_left',
        received: 'portrait',
        synchronized: true
      })
    ).toEqual({ orientation: 'portrait', synchronized: true });
  });
});
