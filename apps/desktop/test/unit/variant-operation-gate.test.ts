import { describe, expect, test } from 'bun:test';
import { createVariantOperationGate } from '@monaddesign/client-rtk/variant-operation-gate';

describe('variant operation gate', () => {
  test('permits only one operation until the owner finishes', () => {
    const gate = createVariantOperationGate();
    const token = gate.begin('capture');

    expect(token).toMatchObject({ generation: 0, name: 'capture' });
    expect(gate.begin('confirm')).toBeNull();
    if (!token) throw new Error('Missing operation token.');
    expect(gate.finish(token)).toBe(true);
    const nextToken = gate.begin('confirm');
    expect(nextToken).toMatchObject({ generation: 0, name: 'confirm' });
    expect(gate.finish(token)).toBe(false);
  });

  test('invalidates stale async work after a reset', () => {
    const gate = createVariantOperationGate();
    const staleToken = gate.begin('capture');
    if (!staleToken) throw new Error('Missing stale operation token.');
    gate.reset();
    const currentToken = gate.begin('restore');
    if (!currentToken) throw new Error('Missing current operation token.');

    expect(gate.isCurrent(staleToken)).toBe(false);
    expect(gate.finish(staleToken)).toBe(false);
    expect(gate.isCurrent(currentToken)).toBe(true);
  });
});
