import { describe, expect, test } from 'bun:test';

import {
  assertBundleIdentifier,
  assertSimulatorVariantId,
  simulatorAppContainerArguments,
  simulatorAppLaunchArguments,
  simulatorVariantLaunchArguments
} from '../../src/simulator-variants';

describe('simulator variant protocol', () => {
  test('builds a terminated relaunch with a single controlled argument', () => {
    expect(simulatorVariantLaunchArguments('SIMULATOR-UDID', 'design.mona.example', 'v2')).toEqual([
      'simctl',
      'launch',
      '--terminate-running-process',
      'SIMULATOR-UDID',
      'design.mona.example',
      '-MonadDesignVariant',
      'v2'
    ]);
  });

  test('builds a normal terminated relaunch without preview arguments', () => {
    expect(simulatorAppLaunchArguments('SIMULATOR-UDID', 'design.mona.example')).toEqual([
      'simctl',
      'launch',
      '--terminate-running-process',
      'SIMULATOR-UDID',
      'design.mona.example'
    ]);
  });

  test('checks the configured app installation by bundle identifier', () => {
    expect(simulatorAppContainerArguments('SIMULATOR-UDID', 'design.mona.example')).toEqual([
      'simctl',
      'get_app_container',
      'SIMULATOR-UDID',
      'design.mona.example',
      'app'
    ]);
  });

  test('rejects malformed bundle identifiers', () => {
    expect(() => assertBundleIdentifier('Example App')).toThrow();
    expect(() => assertBundleIdentifier('example')).toThrow();
    expect(assertBundleIdentifier('com.example.App-preview')).toBe('com.example.App-preview');
  });

  test('only permits the six protocol variants', () => {
    expect(assertSimulatorVariantId('original')).toBe('original');
    expect(assertSimulatorVariantId('v3')).toBe('v3');
    expect(assertSimulatorVariantId('v5')).toBe('v5');
    expect(() => assertSimulatorVariantId('accepted')).toThrow();
  });
});
