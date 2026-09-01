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
    const api = new ClientApi({ origin: 'http://127.0.0.1:41765/' });

    expect((await api.health()).protocolVersion).toBe(1);
    expect(requests[0]?.url).toBe('http://127.0.0.1:41765/v1/health');
    expect(requests[0]?.init?.headers).toEqual({});
    expect(api.streamUrl('/v1/simulator/stream')).toBe('http://127.0.0.1:41765/v1/simulator/stream');
    expect(api.inputUrl('/v1/simulator/input')).toBe('ws://127.0.0.1:41765/v1/simulator/input');
  });

  test('uses legacy local authentication when an older Core bootstrap provides it', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return String(url).endsWith('/v1/admin/projects/')
        ? Response.json({ projects: [] })
        : Response.json({
            name: 'Monad Design Core',
            protocolVersion: 1,
            platform: 'darwin',
            apiVersion: 'v1'
          });
    }) as typeof fetch;
    const api = new ClientApi({
      origin: 'http://127.0.0.1:41765/',
      accessToken: 'legacy-token'
    });

    await api.health();
    await api.adminProjects();

    for (const request of requests) {
      const headers = new Headers(request.init?.headers);
      expect(headers.get('authorization')).toBe('Bearer legacy-token');
      expect(headers.get('x-monad-design-client-kind')).toBe('desktop');
    }
    expect(api.streamUrl('/v1/simulator/stream')).toBe(
      'http://127.0.0.1:41765/v1/simulator/stream?accessToken=legacy-token'
    );
    expect(api.inputUrl('/v1/simulator/input')).toBe(
      'ws://127.0.0.1:41765/v1/simulator/input?accessToken=legacy-token'
    );
  });

  test('creates a fresh timeout signal for each request', async () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return Response.json({ projects: [] });
    }) as typeof fetch;
    const api = new ClientApi({ origin: 'http://127.0.0.1:41765/' }, { requestTimeoutMilliseconds: 1_000 });

    await api.adminProjects();
    await api.adminProjects();

    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
  });
});
