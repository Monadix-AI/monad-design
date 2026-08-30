import { describe, expect, test } from 'bun:test';

import { simulatorScreenLayer } from '../../src/lib/simulator-screen-layout';

describe('simulator screen rotation layer', () => {
  test('keeps the portrait mask dimensions while rotating into landscape', () => {
    expect(simulatorScreenLayer({ width: 844, height: 390, orientation: 'landscape_left' })).toEqual({
      width: 390,
      height: 844,
      transform: 'translate(-50%, -50%) rotate(90deg)'
    });
    expect(simulatorScreenLayer({ width: 844, height: 390, orientation: 'landscape_right' })).toEqual({
      width: 390,
      height: 844,
      transform: 'translate(-50%, -50%) rotate(-90deg)'
    });
  });

  test('keeps portrait dimensions for upright and upside-down screens', () => {
    expect(simulatorScreenLayer({ width: 390, height: 844, orientation: 'portrait' })).toEqual({
      width: 390,
      height: 844,
      transform: 'translate(-50%, -50%)'
    });
    expect(simulatorScreenLayer({ width: 390, height: 844, orientation: 'portrait_upside_down' })).toEqual({
      width: 390,
      height: 844,
      transform: 'translate(-50%, -50%) rotate(180deg)'
    });
  });
});
