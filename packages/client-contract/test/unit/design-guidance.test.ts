import { describe, expect, test } from 'bun:test';

import { submitAgentRequestSchema } from '../../src';

const reference = {
  id: 'style',
  title: 'Editorial',
  kind: 'style' as const,
  source: 'Monad Design',
  version: '1',
  platform: 'any' as const,
  instructions: 'Use generous spacing.'
};
const request = {
  request: 'Polish this screen',
  variantCount: 1,
  context: { simulator: { udid: 'sim-1', bundleIdentifier: 'app.example' } }
};
const withReferences = (references: unknown[]) => ({
  ...request,
  context: { ...request.context, designGuidance: { references, scope: 'screen', focus: '', preserve: '' } }
});

describe('design guidance request boundary', () => {
  test('keeps legacy requests compatible and preserves selected guidance', () => {
    expect(submitAgentRequestSchema.parse(request).context).not.toHaveProperty('designGuidance');
    expect(submitAgentRequestSchema.parse(withReferences([reference])).context.designGuidance?.references).toEqual([
      reference
    ]);
  });
  test('rejects excessive context, invalid platforms and active image formats', () => {
    expect(submitAgentRequestSchema.safeParse(withReferences(Array(5).fill(reference))).success).toBe(false);
    expect(
      submitAgentRequestSchema.safeParse(withReferences([{ ...reference, instructions: 'a'.repeat(30_001) }])).success
    ).toBe(false);
    expect(submitAgentRequestSchema.safeParse(withReferences([{ ...reference, platform: 'invented' }])).success).toBe(
      false
    );
    expect(
      submitAgentRequestSchema.safeParse(
        withReferences([{ ...reference, image: 'data:image/svg+xml;base64,PHN2Zz4=' }])
      ).success
    ).toBe(false);
  });
});
