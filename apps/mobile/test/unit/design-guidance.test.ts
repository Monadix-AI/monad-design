import { describe, expect, test } from 'bun:test';
import { adjustmentGoalReferences, designGuidanceSchema, resolveAdjustmentRequest } from '@monaddesign/client-contract';

import { buildDesignGuidance, toggleDesignReference } from '../../src/design-guidance-model';

const first = adjustmentGoalReferences[0];
if (!first) throw new Error('Built-in goals must be available on mobile.');

describe('mobile design guidance', () => {
  test('enforces the transport limit while allowing a selected goal to be removed', () => {
    const four = adjustmentGoalReferences.slice(0, 4);
    const fifth = adjustmentGoalReferences[4];
    if (!fifth) throw new Error('Missing fifth goal');
    expect(toggleDesignReference(four, fifth)).toEqual(four);
    const reduced = toggleDesignReference(four, first);
    expect(reduced).toHaveLength(3);
    expect(toggleDesignReference(reduced, fifth)).toHaveLength(4);
    expect(four).toHaveLength(4);
  });
  test('falls back to screen evidence after selection clears and keeps constraints', () => {
    const guidance = buildDesignGuidance([first], 'selected_element', false, 'Reading comfort', 'Navigation');
    expect(designGuidanceSchema.parse(guidance)).toMatchObject({
      scope: 'screen',
      focus: 'Reading comfort',
      preserve: 'Navigation'
    });
    expect(buildDesignGuidance([first], 'selected_element', true, '', '')?.scope).toBe('selected_element');
    expect(buildDesignGuidance([], 'screen', false, '', '')).toBeUndefined();
  });
  test('supports goals without prompt text while retaining explicit requests', () => {
    expect(resolveAdjustmentRequest('', [first])).toContain('fonts');
    expect(resolveAdjustmentRequest('Keep the title', [first])).toBe('Keep the title');
    expect(resolveAdjustmentRequest('', [])).toBe('');
  });
});
