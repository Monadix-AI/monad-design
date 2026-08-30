import { afterEach, describe, expect, test } from 'bun:test';

import { ClientApi } from '../../src/client-api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ClientApi', () => {
  test('uses the same typed v1 transport for the desktop client', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return Response.json({
        name: 'Monad Design Core',
        protocolVersion: 1,
        platform: 'darwin',
        apiVersion: 'v1'
      });
    }) as typeof fetch;
    const api = new ClientApi(
      {
        origin: 'http://127.0.0.1:41765/',
        accessToken: 'private-local-token'
      },
      'desktop'
    );

    expect((await api.health()).protocolVersion).toBe(1);
    expect(requests[0]?.url).toBe('http://127.0.0.1:41765/v1/health');
    expect(requests[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer private-local-token',
      'x-monad-design-client-kind': 'desktop'
    });
    expect(api.streamUrl('/v1/simulator/stream')).toBe(
      'http://127.0.0.1:41765/v1/simulator/stream?accessToken=private-local-token'
    );
    expect(api.inputUrl('/v1/simulator/input')).toBe(
      'ws://127.0.0.1:41765/v1/simulator/input?accessToken=private-local-token'
    );
  });
});
