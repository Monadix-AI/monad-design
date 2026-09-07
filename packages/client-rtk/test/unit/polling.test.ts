import { describe, expect, test } from 'bun:test';

import { startPolling } from '../../src/polling';

class Visibility extends EventTarget {
  hidden = false;
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('visible page polling', () => {
  test('does no work while hidden and refreshes immediately when visible', async () => {
    const visibility = new Visibility();
    visibility.hidden = true;
    let calls = 0;
    const stop = startPolling(
      async () => {
        calls += 1;
      },
      { intervalMs: 1, visibility }
    );
    try {
      await tick();
      expect(calls).toBe(0);
      visibility.setHidden(false);
      expect(calls).toBe(1);
      visibility.setHidden(true);
      await tick();
      expect(calls).toBe(1);
      visibility.setHidden(false);
      expect(calls).toBe(2);
    } finally {
      stop();
    }
    visibility.setHidden(false);
    await tick();
    expect(calls).toBe(2);
  });

  test('does not overlap requests when a hidden page becomes visible', async () => {
    const visibility = new Visibility();
    const pending = Promise.withResolvers<void>();
    const second = Promise.withResolvers<void>();
    let calls = 0;
    const stop = startPolling(
      async () => {
        calls += 1;
        if (calls === 1) await pending.promise;
        else second.resolve();
      },
      { intervalMs: 1, visibility }
    );
    try {
      visibility.setHidden(true);
      visibility.setHidden(false);
      await tick();
      expect(calls).toBe(1);
      pending.resolve();
      await second.promise;
      expect(calls).toBe(2);
    } finally {
      stop();
      pending.resolve();
    }
  });

  test('does not schedule more work after disposal during a request', async () => {
    let calls = 0;
    const pending = Promise.withResolvers<void>();
    const stop = startPolling(
      async () => {
        calls += 1;
        await pending.promise;
      },
      { intervalMs: 1 }
    );
    stop();
    pending.resolve();
    await tick();
    expect(calls).toBe(1);
  });
});
