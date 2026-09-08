import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LiveAnnotationSurface } from '../../src/business/annotation/live-surface';

describe('live annotation surface', () => {
  test('keeps drawing tools available before annotation without intercepting the simulator', () => {
    const markup = renderToStaticMarkup(
      <LiveAnnotationSurface
        active={false}
        captureImage={async () => ''}
        imageSize={{ width: 390, height: 844 }}
        onActivate={() => {}}
        onCancel={() => {}}
        onFinish={async () => {}}
        orientation="portrait"
        preserveDraft
      >
        {(overlay) => <div>{overlay}</div>}
      </LiveAnnotationSurface>
    );
    for (const tool of ['Rectangle', 'Ellipse', 'Text', 'Arrow']) {
      expect(markup).toContain(`aria-label="${tool}"`);
    }
    expect(markup).not.toContain('Annotation drawing area');
    expect(markup).not.toContain('Return to interaction tool');
    expect(markup).not.toContain('aria-pressed="true"');
  });

  test('does not fall back to the canvas toolbar while its sidebar host is unavailable', () => {
    const markup = renderToStaticMarkup(
      <LiveAnnotationSurface
        active
        captureImage={async () => ''}
        imageSize={{ width: 390, height: 844 }}
        onActivate={() => {}}
        onCancel={() => {}}
        onFinish={async () => {}}
        orientation="portrait"
        toolsHost={null}
      >
        {(overlay) => <div>{overlay}</div>}
      </LiveAnnotationSurface>
    );

    expect(markup).toContain('Annotation drawing area');
    expect(markup).not.toContain('Annotation controls');
  });

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
