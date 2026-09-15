import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AnimatedBadge } from '../../src/primitives/animated-badge';
import { AnimatedSelect } from '../../src/primitives/animated-select';
import { Button } from '../../src/primitives/button';
import { InstrumentButton } from '../../src/primitives/instrument-button';
import { Loader } from '../../src/primitives/loader';
import { StatefulButton } from '../../src/primitives/stateful-button';

describe('beUI motion primitives', () => {
  test('preserves native button semantics', () => {
    const markup = renderToStaticMarkup(
      <Button
        aria-label="Fit Simulator to view"
        disabled
        size="icon"
        variant="ghost"
      />
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('aria-label="Fit Simulator to view"');
    expect(markup).toContain('disabled=""');
  });

  test('announces stateful loading without losing its label', () => {
    const markup = renderToStaticMarkup(
      <StatefulButton
        loadingText="Starting Simulator…"
        state="loading"
      >
        Connect
      </StatefulButton>
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Starting Simulator…');
    expect(markup).toContain('disabled=""');
  });

  test('keeps status badges accessible', () => {
    const markup = renderToStaticMarkup(
      <AnimatedBadge
        contentKey="live"
        role="status"
        status="success"
      >
        Live
      </AnimatedBadge>
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('Live');
  });

  test('keeps an animated select as a disabled keyboard combobox', () => {
    const markup = renderToStaticMarkup(
      <AnimatedSelect
        ariaLabel="Filter design library"
        disabled
        onValueChange={() => undefined}
        options={[{ label: 'All types', value: 'all' }]}
        value="all"
      />
    );
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Filter design library"');
    expect(markup).toContain('disabled=""');
  });

  test('keeps an instrument button actionable and a loader announced', () => {
    const button = renderToStaticMarkup(<InstrumentButton type="button">Back</InstrumentButton>);
    const loader = renderToStaticMarkup(<Loader label="Capturing variant" />);
    expect(button).toContain('<button');
    expect(button).toContain('Back');
    expect(loader).toContain('role="status"');
    expect(loader).toContain('aria-label="Capturing variant"');
  });
});
