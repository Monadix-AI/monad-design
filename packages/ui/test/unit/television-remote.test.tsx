import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LiveWorkspace } from '../../src/business/live-session/workspace';

const inspector = {
  onAcceptVariant: () => {},
  onBeginSelection: () => {},
  onClearSelection: () => {},
  onDiscardVariant: () => {},
  onModeChange: () => {},
  onRequestChange: () => {},
  onSelectVariant: () => {},
  onSendRequest: () => {},
  onVariantCountChange: () => {},
  request: '',
  variantCount: 1
};
const zoomControls = {
  maximumScale: 2.5,
  minimumScale: 0.25,
  onFit: () => {},
  onZoomIn: () => {},
  onZoomOut: () => {},
  scale: 0.5
};

const common = {
  annotation: {
    captureImage: async () => '',
    onCancel: () => {},
    onFinish: async () => {}
  },
  appearance: 'dark' as const,
  canvasOffset: { x: 0, y: 0 },
  canvasScale: 0.5,
  deviceFrame: {
    frameHeight: 1092,
    frameWidth: 1944,
    hardware: null,
    insets: { bottom: 12, left: 12, right: 12, top: 12 },
    kind: 'tv' as const,
    outerRadius: 0,
    screenRadius: 0
  },
  deviceHeight: 1080,
  deviceName: 'Apple TV 4K',
  deviceWidth: 1920,
  mode: 'interact' as const,
  onChangeAppearance: () => {},
  onHome: () => {},
  onRotateLeft: () => {},
  onRotateRight: () => {},
  orientation: 'portrait' as const,
  streamUrl: '/stream'
};

test('tvOS workspace docks only the remote beside the inspector', () => {
  const markup = renderToStaticMarkup(
    <LiveWorkspace
      inspector={inspector}
      mode="interact"
      simulator={{
        ...common,
        isTelevision: true,
        onRemotePress: () => {},
        remoteAssetUrl: (name) => `/v1/simulator/remote/asset/${name}`
      }}
      zoomControls={zoomControls}
    />
  );
  expect(markup).toContain('Apple TV Remote');
  expect(markup).toContain('aria-label="Remote Select"');
  expect(markup).toContain('/v1/simulator/remote/asset/chrome');
  expect(markup).not.toContain('>Rotate</span>');
  expect(markup).not.toContain('>Home</span>');
  expect(markup).toContain('Live Simulator screen');
  expect(markup.indexOf('class="television-remote"')).toBeGreaterThan(markup.indexOf('floating-inspector'));
});

test('iOS canvas retains its device controls', () => {
  const markup = renderToStaticMarkup(
    <LiveWorkspace
      inspector={inspector}
      mode="interact"
      simulator={{ ...common, deviceHeight: 844, deviceName: 'iPhone', deviceWidth: 390 }}
      zoomControls={zoomControls}
    />
  );
  expect(markup).toContain('Simulator controls');
  expect(markup).not.toContain('Apple TV Remote');
});
