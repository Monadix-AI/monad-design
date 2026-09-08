import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { SimulatorCanvas } from '../../src/business/simulator-canvas';

describe('simulator canvas', () => {
  test('keeps focus off the interactive screen while retaining a hidden keyboard input target', () => {
    const markup = renderToStaticMarkup(
      <SimulatorCanvas
        ariaLabel="iPhone interactive screen"
        deviceFrame={{
          frameHeight: 844,
          frameWidth: 390,
          hardware: null,
          insets: { bottom: 0, left: 0, right: 0, top: 0 },
          kind: 'dynamic-island',
          outerRadius: 62,
          screenRadius: 55
        }}
        deviceHeight={844}
        deviceWidth={390}
        orientation="portrait"
        streamUrl="/simulator-stream"
      />
    );

    expect(markup).toContain('aria-label="iPhone interactive screen"');
    expect(markup.match(/<button[^>]*tabindex="-1"[^>]*>/)).not.toBeNull();
    expect(markup).toContain('class="simulator-keyboard-input"');
  });
});
