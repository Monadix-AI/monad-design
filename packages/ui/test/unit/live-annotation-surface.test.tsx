import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LiveAnnotationSurface } from '../../src/business/annotation/live-surface';

describe('live annotation surface', () => {
  test('keeps the live child mounted and does not capture before Finish', () => {
    let captures = 0;
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('data-live-simulator');
    expect(markup).toContain('Annotation drawing area');
    expect(markup).toContain('Annotate');
    expect(markup).toContain('Delete selected annotation');
    expect(captures).toBe(0);
  });

  test('removes annotation controls without replacing the live child', () => {
    const markup = renderToStaticMarkup(
      <LiveAnnotationSurface
        active={false}
        captureImage={async () => 'data:image/png;base64,'}
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

    expect(markup).toContain('data-live-simulator');
    expect(markup).not.toContain('Annotation drawing area');
    expect(markup).not.toContain('canvas-annotation-toolbar');
  });
});
