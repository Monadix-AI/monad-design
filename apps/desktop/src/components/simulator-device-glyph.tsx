import type { CSSProperties } from 'react';
import type { IOSSimulator } from '@/electron';

import { simulatorDeviceGlyphMetrics } from '@monaddesign/device-frame';

export function SimulatorDeviceGlyph({ simulator }: { simulator: IOSSimulator }) {
  const { artwork, height, iosMajorVersion, kind, width } = simulatorDeviceGlyphMetrics({
    deviceName: simulator.name,
    runtime: simulator.runtime,
    screen: simulator.screen
  });
  const shellStyle = {
    ...(simulator.framebufferMask
      ? {
          WebkitMaskImage: `url(${simulator.framebufferMask})`,
          maskImage: `url(${simulator.framebufferMask})`
        }
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

  return (
    <span
      aria-hidden="true"
      className={`device-icon device-icon-${kind} ${simulator.framebufferMask ? 'device-icon-mask' : 'device-icon-fallback'}`}
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
    </span>
  );
}
