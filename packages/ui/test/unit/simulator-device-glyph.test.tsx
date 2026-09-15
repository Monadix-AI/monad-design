import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { SimulatorDeviceGlyph } from '../../src/business/live-session/simulator-device-glyph';

const baseSimulator = {
  connected: false,
  name: 'Apple Watch Series 11 (46mm)',
  productFamily: 'Apple Watch',
  runtime: 'watchOS 26.0',
  state: 'Shutdown' as const,
  udid: 'watch'
};

describe('simulator device glyph', () => {
  test('uses Xcode chrome for a watch when available', () => {
    const markup = renderToStaticMarkup(
      <SimulatorDeviceGlyph
        simulator={{
          ...baseSimulator,
          screen: { width: 416, height: 496, scale: 2 },
          deviceChrome: {
            image: 'data:image/png;base64,watch',
            frame: { width: 513, height: 582 },
            body: { x: 0, y: 0, width: 502, height: 582 },
            screen: { x: 147, y: 167, width: 208, height: 248 }
          }
        }}
      />
    );

    expect(markup).toContain('device-icon-watch-native');
    expect(markup).toContain('data:image/png;base64,watch');
    expect(markup).toMatch(/left:8\.38\d*%/);
  });

  test('draws a TV panel and stand instead of a portrait device', () => {
    const markup = renderToStaticMarkup(
      <SimulatorDeviceGlyph
        simulator={{
          ...baseSimulator,
          name: 'Apple TV 4K',
          productFamily: 'Apple TV',
          runtime: 'tvOS 26.0',
          udid: 'tv'
        }}
      />
    );

    expect(markup).toContain('device-icon-tv-panel');
    expect(markup).toContain('device-icon-tv-stand');
  });
});
