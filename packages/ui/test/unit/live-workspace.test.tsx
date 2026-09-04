import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LiveWorkspace, type LiveWorkspaceProps } from '../../src/business/live-session/workspace';

const inspector: LiveWorkspaceProps['inspector'] = {
  agentStatus: 'awaiting_request',
  onAcceptVariant: () => undefined,
  onBeginSelection: () => undefined,
  onClearSelection: () => undefined,
  onDiscardVariant: () => undefined,
  onModeChange: () => undefined,
  onRequestChange: () => undefined,
  onSelectVariant: () => undefined,
  onSendRequest: () => undefined,
  onVariantCountChange: () => undefined,
  request: '',
  variantCount: 1
};

const zoomControls: LiveWorkspaceProps['zoomControls'] = {
  maximumScale: 2,
  minimumScale: 0.25,
  onFit: () => undefined,
  onZoomIn: () => undefined,
  onZoomOut: () => undefined,
  scale: 1
};

describe('live workspace', () => {
  test('owns the shared connected-workspace composition', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        canvas={<div>Canvas</div>}
        designDocument={<div>Design document</div>}
        inspector={inspector}
        mode="select"
        preview={<div>Variant preview</div>}
        zoomControls={zoomControls}
      />
    );

    expect(markup).toContain('class="free-canvas interact-mode"');
    expect(markup).toContain('Selecting runtime element');
    expect(markup).toContain('Live workspace');
    expect(markup.indexOf('Design document')).toBeLessThan(markup.indexOf('class="floating-inspector'));
    expect(markup.indexOf('Design document')).toBeLessThan(markup.indexOf('Variant preview'));
    expect(markup.indexOf('Variant preview')).toBeLessThan(markup.indexOf('class="floating-inspector'));
    expect(markup.indexOf('class="floating-inspector')).toBeLessThan(markup.indexOf('class="zoom-controls'));
    expect(markup.match(/class="zoom-controls/g)).toHaveLength(1);
    expect(markup).not.toContain('>End live</button>');
  });

  test('renders the shared lifecycle control for an active session', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        activeSession={{ isEnding: true, onEnd: () => undefined }}
        canvas={<div>Canvas</div>}
        inspector={inspector}
        mode="interact"
        zoomControls={zoomControls}
      />
    );

    expect(markup).toContain('>Ending live…</button>');
  });
});
