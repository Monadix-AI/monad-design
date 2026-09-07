import { describe, expect, test } from 'bun:test';

import { createFrameTask } from '../../src/frame-task';

function frameClock() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  return {
    callbacks,
    requestFrame(callback: FrameRequestCallback) {
      callbacks.set(++id, callback);
      return id;
    },
    cancelFrame(id: number) {
      callbacks.delete(id);
    },
    flush() {
      const frame = [...callbacks.values()];
      callbacks.clear();
      for (const callback of frame) callback(0);
    }
  };
}

describe('pointer frame updates', () => {
  test('coalesces a burst into one update at the latest coordinates', () => {
    const clock = frameClock();
    const task = createFrameTask(clock);
    const updates: number[] = [];
    for (let x = 0; x < 1_000; x += 1) task.schedule(() => updates.push(x));
    expect(clock.callbacks.size).toBe(1);
    expect(updates).toEqual([]);
    clock.flush();
    expect(updates).toEqual([999]);
    task.schedule(() => updates.push(1_000));
    clock.flush();
    expect(updates).toEqual([999, 1_000]);
  });

  test('flushes a short gesture before end without replaying the move on the next frame', () => {
    const clock = frameClock();
    const task = createFrameTask(clock);
    const events: string[] = ['begin'];
    task.schedule(() => events.push('move'));
    task.flush();
    events.push('end');
    clock.flush();
    expect(events).toEqual(['begin', 'move', 'end']);
  });

  test('does not deliver a queued move after pointer end or disconnect', () => {
    const clock = frameClock();
    const task = createFrameTask(clock);
    const events: string[] = ['begin'];
    task.schedule(() => events.push('move'));
    task.cancel();
    events.push('end');
    clock.flush();
    expect(events).toEqual(['begin', 'end']);
    task.schedule(() => events.push('next gesture'));
    clock.flush();
    expect(events).toEqual(['begin', 'end', 'next gesture']);
  });
});
