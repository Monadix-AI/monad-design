import { describe, expect, test } from 'bun:test';

import { createSharedOperation } from '../../src/shared-operation';

describe('shared Core operations', () => {
  test('shares one in-flight operation with every caller for the same key', async () => {
    const resolvers = new Map<string, (value: string) => void>();
    const calls: string[] = [];
    const load = createSharedOperation(
      (key: string) => {
        calls.push(key);
        return new Promise<string>((resolve) => resolvers.set(key, resolve));
      },
      { key: (key) => key }
    );

    const first = load('simulators');
    const second = load('simulators');
    const other = load('accessibility');

    expect(second).toBe(first);
    expect(other).not.toBe(first);
    expect(calls).toEqual(['simulators', 'accessibility']);

    resolvers.get('simulators')?.('devices');
    resolvers.get('accessibility')?.('tree');
    expect(await Promise.all([first, second, other])).toEqual(['devices', 'devices', 'tree']);
  });

  test('removes failed operations so the next request can retry', async () => {
    let calls = 0;
    const load = createSharedOperation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary failure');
      return 'recovered';
    });

    const first = load();
    expect(load()).toBe(first);
    await expect(first).rejects.toThrow('temporary failure');
    expect(await load()).toBe('recovered');
    expect(calls).toBe(2);
  });

  test('can briefly reuse a completed result without caching failures', async () => {
    let now = 1_000;
    let calls = 0;
    const load = createSharedOperation(
      async () => {
        calls += 1;
        return calls;
      },
      { freshnessMilliseconds: 500, now: () => now }
    );

    expect(await load()).toBe(1);
    now = 1_499;
    expect(await load()).toBe(1);
    now = 1_500;
    expect(await load()).toBe(2);
  });
});
