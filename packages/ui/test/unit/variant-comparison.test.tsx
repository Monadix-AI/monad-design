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
        capturingVariant="v1"
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
    expect(markup).toContain('<strong>Original</strong><small>BASE</small>');
    expect(markup).toContain('src="data:image/png;base64,original"');
    expect(markup).toContain('--variant-canvas-offset-x:24px');
    expect(markup).toContain('--variant-canvas-offset-y:-16px');
    expect(markup).toContain('--variant-canvas-scale:1.4');
    expect(markup).not.toContain('class="canvas-variant-strip" data-canvas-ui');
    expect(markup).toContain('class="canvas-variant-device" data-canvas-ui');
    expect(markup).toContain('aria-label="Variant 1"');
    expect(markup).toContain('<strong>Variant 1</strong><small>01</small>');
    expect(markup).toContain('data-capturing="true"');
    expect(markup).toContain('aria-label="Capturing Variant 1"');
    expect(markup).toContain('<strong>Capturing…</strong>');
    expect(markup).toContain('disabled=""');
  });

  test('clips the capture loading state to the native framebuffer shape', () => {
    const markup = renderToStaticMarkup(
      <VariantComparison
        captures={[]}
        capturingVariant="original"
        deviceFrame={deviceFrame}
        deviceHeight={844}
        deviceWidth={390}
        framebufferMask="data:image/png;base64,mask"
        labels={{ original: 'Original' }}
        onSelect={() => undefined}
        variants={['original']}
      />
    );

    expect(markup).toContain('class="variant-capture-loading"');
    expect(markup).toContain('mask-image:url(data:image/png;base64,mask)');
    expect(markup).toContain('-webkit-mask-image:url(data:image/png;base64,mask)');
  });
});
