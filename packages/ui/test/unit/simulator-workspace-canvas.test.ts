import { describe, expect, test } from 'bun:test';

import { orientedSimulatorImageSize } from '../../src/business/live-session/simulator-workspace-canvas';

describe('simulator workspace canvas', () => {
  test.each([
    ['portrait', { height: 844, width: 390 }],
    ['portrait_upside_down', { height: 844, width: 390 }],
    ['landscape_left', { height: 390, width: 844 }],
    ['landscape_right', { height: 390, width: 844 }]
  ] as const)('uses the oriented annotation coordinate space for %s', (orientation, expected) => {
    expect(orientedSimulatorImageSize(orientation, { deviceHeight: 844, deviceWidth: 390 })).toEqual(expected);
  });
});
