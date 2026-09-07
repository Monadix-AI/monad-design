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
  test('shows only the comparison preview in variants mode', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        canvas={<div>Live Simulator</div>}
        inspector={{ ...inspector, agentStatus: 'variants_ready' }}
        mode="variants"
        preview={<div>Original and variants</div>}
        zoomControls={zoomControls}
      />
    );

    expect(markup).toContain('Original and variants');
    expect(markup).not.toContain('Live Simulator');
  });
});
