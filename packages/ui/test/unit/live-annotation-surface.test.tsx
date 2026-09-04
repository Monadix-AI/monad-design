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
    expect(markup).not.toContain('Add centered');
    expect(markup).toContain('Annotation controls');
    expect(markup).toContain('canvas-annotation-rail');
    expect(markup).toContain('Drawing tools');
    expect(markup).toContain('Annotation actions');
    expect(markup).toContain('Delete selected annotation');
    expect(markup).toContain('Redo annotation');
    expect(markup).toContain('data-pointer-state="idle"');
    expect(markup).not.toContain('<strong>Tools</strong>');
    expect(markup).not.toContain('<span>Undo</span>');
    expect(markup).toContain('<span>Cancel</span>');
    expect(markup).toContain('<span>Finish</span>');
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
