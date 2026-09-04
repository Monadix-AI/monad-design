import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { EdgeAtmosphere } from '../../src/business/edge-atmosphere';

describe('edge atmosphere', () => {
  test('selects a stable-sized random set with the required device and beverage categories', () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const markup = renderToStaticMarkup(<EdgeAtmosphere />);
      const objects = markup.match(/edge-asset-[a-z-]+/gu) ?? [];

      expect(objects).toHaveLength(11);
      expect(new Set(objects).size).toBe(11);
      expect(markup).toContain('edge-asset-laptop');
      expect(markup).toContain('edge-asset-mobile');
      expect(markup).toMatch(/edge-asset-(can|glass|sparkling-water|takeaway-cup|tea-cup)/u);
    }
  });

  test('can stay mounted while route visibility changes', () => {
    expect(renderToStaticMarkup(<EdgeAtmosphere active={false} />)).toContain('class="edge-atmosphere"');
    expect(renderToStaticMarkup(<EdgeAtmosphere active />)).toContain('data-visible="true"');
  });
});
