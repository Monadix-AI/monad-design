import { describe, expect, test } from 'bun:test';
import { adjustmentGoalReferences, designGuidanceSchema, resolveAdjustmentRequest } from '@monaddesign/client-contract';

import { buildDesignGuidance, toggleDesignReference } from '../../src/design-guidance-model';

const first = adjustmentGoalReferences[0];
if (!first) throw new Error('Built-in goals must be available on mobile.');

describe('mobile design guidance', () => {
  test('replaces the active adjustment goal while preserving attached references', () => {
    const second = adjustmentGoalReferences[1];
    if (!second) throw new Error('Missing second goal');
    const reference = { ...first, id: 'style', kind: 'style' as const, skillName: undefined };
    const current = [reference, first];
    expect(toggleDesignReference(current, second)).toEqual([reference, second]);
    expect(toggleDesignReference(current, first)).toEqual([reference]);
    expect(current).toEqual([reference, first]);
  });
  test('enforces the transport limit for non-goal references', () => {
    const four = Array.from({ length: 4 }, (_, id) => ({
      ...first,
      id: `style-${id}`,
      kind: 'style' as const,
      skillName: undefined
    }));
    expect(toggleDesignReference(four, { ...four[0], id: 'extra' } as typeof first)).toEqual(four);
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
