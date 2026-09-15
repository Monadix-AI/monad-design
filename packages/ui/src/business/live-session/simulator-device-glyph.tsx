import type { CSSProperties } from 'react';
import type { SimulatorPickerDevice } from './simulator-picker';

import { simulatorDeviceGlyphMetrics } from '@monaddesign/device-frame';

export function SimulatorDeviceGlyph({ simulator }: { simulator: SimulatorPickerDevice }) {
  const { artwork, height, iosMajorVersion, kind, width } = simulatorDeviceGlyphMetrics({
    deviceName: simulator.name,
    runtime: simulator.runtime,
    productFamily: simulator.productFamily,
    screen: simulator.screen
  });
  const shellStyle = {
    ...(kind !== 'watch' && simulator.framebufferMask
      ? { WebkitMaskImage: `url(${simulator.framebufferMask})`, maskImage: `url(${simulator.framebufferMask})` }
      : {}),
    '--device-shell-start': artwork.shell.start,
    '--device-shell-middle': artwork.shell.middle,
    '--device-shell-end': artwork.shell.end
  } as CSSProperties;
  const screenStyle = {
    '--device-screen-base': artwork.screen.base,
    '--device-screen-middle': artwork.screen.middle,
    '--device-screen-bridge': artwork.screen.bridge,
    '--device-screen-end': artwork.screen.end,
    '--device-screen-glow': artwork.screen.glow,
    '--device-screen-bloom': artwork.screen.bloom
  } as CSSProperties;

  if (kind === 'tv') {
    return (
      <span
        aria-hidden="true"
        className="device-icon device-icon-tv"
        style={{ height, width }}
      >
        <span className="device-icon-tv-panel">
          <span
            className="device-icon-tv-screen"
            style={screenStyle}
          />
        </span>
        <span className="device-icon-tv-stand" />
      </span>
    );
  }

  if (kind === 'watch' && simulator.deviceChrome) {
    const { body, frame, screen } = simulator.deviceChrome;
    const screenWidth = simulator.screen?.width ?? screen.width;
    const screenHeight = simulator.screen?.height ?? screen.height;
    const nativeScreenStyle = {
      ...screenStyle,
      left: `${((body.x + (body.width - screenWidth) / 2) / frame.width) * 100}%`,
      top: `${((body.y + (body.height - screenHeight) / 2) / frame.height) * 100}%`,
      width: `${(screenWidth / frame.width) * 100}%`,
      height: `${(screenHeight / frame.height) * 100}%`,
      ...(simulator.framebufferMask
        ? { WebkitMaskImage: `url(${simulator.framebufferMask})`, maskImage: `url(${simulator.framebufferMask})` }
        : {})
    } as CSSProperties;
    return (
      <span
        aria-hidden="true"
        className="device-icon device-icon-watch device-icon-watch-native"
        style={{ height, width: (height * frame.width) / frame.height }}
      >
        <span
          className="device-icon-screen device-icon-watch-native-screen"
          style={nativeScreenStyle}
        />
        <img
          alt=""
          className="device-icon-watch-native-chrome"
          src={simulator.deviceChrome.image}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`device-icon device-icon-${kind} ${kind !== 'watch' && simulator.framebufferMask ? 'device-icon-mask' : 'device-icon-fallback'}`}
      style={{ height, width }}
    >
      <span
        className="device-icon-shell"
        style={shellStyle}
      >
        <span
          className="device-icon-screen"
          data-ios-version={iosMajorVersion}
          style={screenStyle}
        />
      </span>
      {kind === 'watch' && <span className="device-icon-watch-crown" />}
    </span>
  );
}
