import { describe, expect, test } from 'bun:test';

import { waitForSimulatorBridgeHealth } from '../../src/simulator-bridge';

describe('waitForSimulatorBridgeHealth', () => {
  test('waits through transient device-unavailable responses', async () => {
    let attempts = 0;
    const fetcher = (async () => {
      attempts += 1;
      return attempts < 3 ? new Response('No serve-sim device', { status: 404 }) : new Response('ok');
    }) as typeof fetch;

    await waitForSimulatorBridgeHealth('http://127.0.0.1/health', {
      attempts: 3,
      fetcher,
      intervalMilliseconds: 0
    });

    expect(attempts).toBe(3);
  });

  test('returns the last helper error after the retry budget is exhausted', async () => {
    const fetcher = (async () => new Response('No serve-sim device', { status: 404 })) as typeof fetch;

    await expect(
      waitForSimulatorBridgeHealth('http://127.0.0.1/health', {
        attempts: 2,
        fetcher,
        intervalMilliseconds: 0
      })
    ).rejects.toThrow('No serve-sim device');
  });
});
