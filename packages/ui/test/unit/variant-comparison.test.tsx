import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { liveSimulatorDeviceFrame } from '../../src/business/canvas-controls';
import { VariantComparison } from '../../src/business/variant-comparison';

const deviceFrame = liveSimulatorDeviceFrame({
  deviceHeight: 844,
  deviceName: 'iPhone',
  deviceWidth: 390,
  orientation: 'portrait'
});

describe('shared variant comparison', () => {
  test('renders original and variant captures while disabling screenshots that are still pending', () => {
    const markup = renderToStaticMarkup(
      <VariantComparison
        captures={[
          {
            id: 'original',
            image: 'data:image/png;base64,original',
            orientation: 'portrait'
          }
        ]}
        deviceFrame={deviceFrame}
        deviceHeight={844}
        deviceWidth={390}
        labels={{ original: 'Original', v1: 'Variant 1' }}
        offset={{ x: 24, y: -16 }}
        onSelect={() => undefined}
        scale={1.4}
        variants={['original', 'v1']}
      />
    );

    expect(markup).toContain('aria-label="Original"');
    expect(markup).toContain('src="data:image/png;base64,original"');
    expect(markup).toContain('--variant-canvas-offset-x:24px');
    expect(markup).toContain('--variant-canvas-offset-y:-16px');
    expect(markup).toContain('--variant-canvas-scale:1.4');
    expect(markup).not.toContain('class="canvas-variant-strip" data-canvas-ui');
    expect(markup).toContain('class="canvas-variant-device" data-canvas-ui');
    expect(markup).toContain('aria-label="Variant 1"');
    expect(markup).toContain('disabled=""');
  });
});
