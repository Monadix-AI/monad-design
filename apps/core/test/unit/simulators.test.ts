import { describe, expect, test } from 'bun:test';

import {
  deviceChromeGeometry,
  markConnectedSimulator,
  parseAvailableSimulators,
  parseSimulatorOrientation
} from '../../src/simulators';

describe('simulator discovery', () => {
  test('returns both booted and shut down available devices', () => {
    const simulators = parseAvailableSimulators(
      JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
            {
              name: 'iPhone 17 Pro',
              state: 'Booted',
              udid: 'BOOTED-UDID',
              deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro'
            },
            {
              name: 'iPhone Air',
              state: 'Shutdown',
              udid: 'SHUTDOWN-UDID'
            },
            {
              name: 'Transient device',
              state: 'Creating',
              udid: 'CREATING-UDID'
            }
          ]
        }
      })
    );

    expect(simulators).toEqual([
      {
        name: 'iPhone 17 Pro',
        state: 'Booted',
        connected: false,
        udid: 'BOOTED-UDID',
        runtime: 'iOS 26.0',
        deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro'
      },
      {
        name: 'iPhone Air',
        state: 'Shutdown',
        connected: false,
        udid: 'SHUTDOWN-UDID',
        runtime: 'iOS 26.0',
        deviceTypeIdentifier: undefined
      }
    ]);
    expect(markConnectedSimulator(simulators, 'SHUTDOWN-UDID').map(({ connected }) => connected)).toEqual([
      false,
      true
    ]);
  });
});

describe('simulator orientation', () => {
  test('maps the Simulator SpringBoard orientation to the workspace model', () => {
    expect(parseSimulatorOrientation('1\n')).toBe('portrait');
    expect(parseSimulatorOrientation('2')).toBe('portrait_upside_down');
    expect(parseSimulatorOrientation('3')).toBe('landscape_left');
    expect(parseSimulatorOrientation('4')).toBe('landscape_right');
    expect(
      parseSimulatorOrientation(`{
				BKDigitizerPersistentServiceProperties = (
					{ props = { GraphicsOrientation = 3; }; }
				);
			}`)
    ).toBe('landscape_left');
    expect(parseSimulatorOrientation('unknown')).toBeNull();
  });
});

describe('DeviceKit chrome geometry', () => {
  test('keeps Apple device padding outside the composite body and centers the active screen inside it', () => {
    expect(
      deviceChromeGeometry({
        bodySize: { width: 436, height: 908 },
        devicePadding: { top: 0, right: 9, bottom: 0, left: 9 },
        screenSize: { width: 402, height: 874 }
      })
    ).toEqual({
      frame: { width: 454, height: 908 },
      body: { x: 9, y: 0, width: 436, height: 908 },
      screen: { x: 26, y: 17, width: 402, height: 874 },
      insets: { top: 17, right: 26, bottom: 17, left: 26 }
    });
  });
});
