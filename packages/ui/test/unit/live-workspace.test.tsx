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
  test('hides the start-live prompt while an agent is connected', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        inspector={inspector}
        mode="interact"
        zoomControls={zoomControls}
      />
    );

    expect(markup).not.toContain('Start Live in your coding agent');
    expect(markup).toContain('Agent ready');
    expect(markup).toContain('class="variant-count-trigger"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="false"');
  });

  test('shows the start-live prompt when the agent session is closed', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        inspector={{ ...inspector, agentStatus: 'closed' }}
        mode="interact"
        zoomControls={zoomControls}
      />
    );

    expect(markup).toContain('Start Live in your coding agent');
    expect(markup).toContain('Agent offline');
  });

  test('keeps the system select path available to Electron', () => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        inspector={{ ...inspector, variantCountControl: 'system' }}
        mode="interact"
        zoomControls={zoomControls}
      />
    );

    expect(markup).toContain('class="variant-count-native"');
    expect(markup).toContain('<option value="1" selected="">1</option>');
    expect(markup).not.toContain('class="variant-count-trigger"');
  });

  test('keeps the same request panel and vertical tools across editing tools', () => {
    const library = {
      entries: [],
      selected: [],
      favorites: [],
      recent: [],
      error: null,
      scope: 'screen' as const,
      focus: '',
      preserve: '',
      setScope: () => {},
      setFocus: () => {},
      setPreserve: () => {},
      toggle: () => {},
      toggleFavorite: () => {},
      remove: () => {},
      importFile: async () => {}
    };
    for (const mode of ['interact', 'select', 'annotate'] as const) {
      const markup = renderToStaticMarkup(
        <LiveWorkspace
          inspector={{ ...inspector, designLibrary: library }}
          mode={mode}
          zoomControls={zoomControls}
        />
      );
      expect(markup).toContain('DESIGN.md');
      expect(markup).not.toContain('References');
      expect(markup).toContain('aria-expanded="false"');
      expect(markup).not.toContain('role="tablist"');
      expect(markup).toContain('Workspace tools');
      expect(markup).toContain('aria-orientation="vertical"');
      expect(markup).not.toContain('Workspace mode');
      expect(markup).not.toContain('aria-label="Annotate"');
      const selectTool = markup.match(/<button[^>]*aria-label="Select"[^>]*>/)?.[0];
      expect(Boolean(selectTool?.includes('disabled'))).toBe(mode === 'annotate');
      const selectPrompt = markup.match(/<button[^>]*class="selection-empty"[^>]*>/)?.[0];
      expect(selectPrompt).toBeUndefined();
      expect(markup).toContain('Agent ready');
      expect(markup).not.toContain('Implementation notes');
      expect(markup).toContain('Change request');
      expect(markup.match(/Send to agent/g)).toHaveLength(1);
    }
  });

  test.each(['change_requested', 'working'] as const)('shows annotation request progress during %s', (agentStatus) => {
    const markup = renderToStaticMarkup(
      <LiveWorkspace
        inspector={{ ...inspector, agentStatus, requestInFlight: 'Update the annotated button' }}
        mode="annotate"
        zoomControls={zoomControls}
      />
    );
    expect(markup).toContain(agentStatus === 'working' ? 'Agent is building variants' : 'Waiting for agent');
    expect(markup).toContain('Update the annotated button');
    expect(markup).not.toContain('Implementation notes');
    expect(markup).not.toContain('Workspace tools');
    expect(markup).not.toContain('Annotation controls');
  });

  test('offers annotation review and then waits for the accepted result', () => {
    const renderReview = (agentStatus: 'variants_ready' | 'selection_confirmed') =>
      renderToStaticMarkup(
        <LiveWorkspace
          inspector={{
            ...inspector,
            agentStatus,
            selectedVariant: 'v1',
            confirmedVariant: agentStatus === 'selection_confirmed' ? 'v1' : undefined,
            variants: [{ id: 'v1', label: 'Variant 1', ready: true }]
          }}
          mode="annotate"
          zoomControls={zoomControls}
        />
      );
    const review = renderReview('variants_ready');
    expect(review).toContain('Discard');
    expect(review).toContain('Accept');
    expect(review).not.toContain('Implementation notes');
    expect(review).not.toContain('Workspace tools');
    expect(review).not.toContain('Annotation controls');
    const finalizing = renderReview('selection_confirmed');
    expect(finalizing).toContain('Variant 1 accepted · agent is finalizing');
    expect(finalizing).not.toContain('Workspace tools');
    expect(finalizing).not.toContain('Annotation controls');
  });

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
    expect(markup).not.toContain('Workspace tools');
  });
});
