import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LiveAnnotationSurface } from '../../src/business/annotation/live-surface';

describe('live annotation surface', () => {
  test('does not capture before the user finishes annotating', () => {
    let captures = 0;
    renderToStaticMarkup(
      <LiveAnnotationSurface
        active
        captureImage={async () => {
          captures += 1;
          return 'data:image/png;base64,';
        }}
        imageSize={{ width: 390, height: 844 }}
        onCancel={() => undefined}
        onFinish={async () => undefined}
        orientation="portrait"
      >
        {(overlay) => (
          <div data-live-simulator>
            Live Simulator
            {overlay}
          </div>
        )}
      </LiveAnnotationSurface>
    );

    expect(captures).toBe(0);
  });
});
