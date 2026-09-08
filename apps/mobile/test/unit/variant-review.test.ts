import { describe, expect, test } from 'bun:test';

import { applyVariantReviewAction, variantComparisonLayout } from '../../src/variant-review';

describe('mobile variant review', () => {
  for (const action of ['preview', 'accept', 'discard'] as const) {
    test(`${action} keeps runtime preview and source confirmation distinct`, async () => {
      const calls: string[] = [];
      await applyVariantReviewAction({
        action,
        variant: 'a',
        launchOriginal: async () => {
          calls.push('launch:original');
        },
        launchVariant: async (variant) => {
          calls.push(`launch:${variant}`);
        },
        onPreview: (variant) => {
          calls.push(`preview:${variant}`);
        },
        confirmSelection: async (variant) => {
          calls.push(`confirm:${variant}`);
        }
      });
      const target = action === 'discard' ? 'original' : 'a';
      expect(calls).toEqual([
        `launch:${target}`,
        `preview:${target}`,
        ...(action === 'preview' ? [] : [`confirm:${target}`])
      ]);
    });
  }
  test('failed launch never confirms a choice or updates the preview', async () => {
    let changed = false;
    await expect(
      applyVariantReviewAction({
        action: 'accept',
        variant: 'a',
        launchOriginal: async () => {},
        launchVariant: async () => {
          throw new Error('Offline');
        },
        onPreview: () => {
          changed = true;
        },
        confirmSelection: async () => {
          changed = true;
        }
      })
    ).rejects.toThrow('Offline');
    expect(changed).toBe(false);
  });
  test('confirmation errors propagate so the review remains open for retry', async () => {
    await expect(
      applyVariantReviewAction({
        action: 'discard',
        variant: 'a',
        launchOriginal: async () => {},
        launchVariant: async () => {},
        onPreview: () => {},
        confirmSelection: async () => {
          throw new Error('Agent disconnected');
        }
      })
    ).rejects.toThrow('Agent disconnected');
  });
  test('six variants have reachable bounds on phone and tablet', () => {
    for (const width of [390, 768, 1024]) {
      const layout = variantComparisonLayout({ width, height: 600 }, 6);
      expect(layout.width).toBeLessThanOrEqual(width);
      expect(layout.tileHeight).toBeGreaterThanOrEqual(180);
      expect(layout.height).toBeGreaterThanOrEqual(600);
    }
  });
});
