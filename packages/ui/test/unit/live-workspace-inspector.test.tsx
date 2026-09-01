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
    expect(activeMarkup).toContain('>End live</button>');
    expect(endingMarkup).toContain('disabled=""');
    expect(endingMarkup).toContain('>Ending live…</button>');
  });
});
