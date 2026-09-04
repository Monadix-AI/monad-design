import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  LiveWorkspaceInspector,
  type LiveWorkspaceInspectorProps
} from '../../src/business/live-session/workspace-inspector';

const props: LiveWorkspaceInspectorProps = {
  agentStatus: 'awaiting_request',
  mode: 'interact',
  onAcceptVariant: () => undefined,
  onBeginSelection: () => undefined,
  onClearSelection: () => undefined,
  onDiscardVariant: () => undefined,
  onEndLive: () => undefined,
  onModeChange: () => undefined,
  onRequestChange: () => undefined,
  onSelectVariant: () => undefined,
  onSendRequest: () => undefined,
  onVariantCountChange: () => undefined,
  request: '',
  variantCount: 1
};

describe('live workspace inspector', () => {
  test('renders the active session end control and disables it while closing', () => {
    const activeMarkup = renderToStaticMarkup(<LiveWorkspaceInspector {...props} />);
    const endingMarkup = renderToStaticMarkup(
      <LiveWorkspaceInspector
        {...props}
        isEndingLive
      />
    );

    expect(activeMarkup).toContain('class="live-session-footer"');
    expect(activeMarkup).toContain('aria-label="Live workspace controls"');
    expect(activeMarkup).toContain('Live workspace');
    expect(activeMarkup).toContain('Agent live');
    expect(activeMarkup).toContain('data-variant="ghost"');
    expect(activeMarkup).toContain('>End live</button>');
    expect(endingMarkup).toContain('disabled=""');
    expect(endingMarkup).toContain('>Ending live…</button>');
  });

  test('turns the inspector body into the annotation notes host in annotation mode', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspaceInspector
        {...props}
        mode="annotate"
      />
    );

    expect(markup).toContain('class="floating-inspector compact annotation-only"');
    expect(markup).toContain('aria-label="Implementation notes"');
    expect(markup).toContain('class="inspector-annotation-body"');
    expect(markup).not.toContain('class="inspector-section prompt-workbench');
    expect(markup).not.toContain('Adjustment request');
  });
});
