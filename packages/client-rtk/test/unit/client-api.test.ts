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

  test('forwards cancellation to active requests', async () => {
    const controller = new AbortController();
    const requestSignals: AbortSignal[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const requestSignal = init?.signal;
      if (requestSignal) requestSignals.push(requestSignal);
      return await new Promise<Response>((_resolve, reject) => {
        if (requestSignal?.aborted) {
          reject(requestSignal.reason);
          return;
        }
        requestSignal?.addEventListener('abort', () => reject(requestSignal.reason), { once: true });
      });
    }) as typeof fetch;
    const api = new ClientApi({ origin: 'http://127.0.0.1:41765/' }, { signal: controller.signal });

    const request = api.health();
    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toMatchObject({ raw: { name: 'AbortError' } });
    expect(requestSignals[0]?.aborted).toBe(true);
  });

  test('disposes cached requests', async () => {
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ projects: [] })) as typeof fetch;
    const api = new ClientApi({ origin: 'http://127.0.0.1:41765/' });

    await api.adminProjects();
    expect(Object.keys(api.store.getState().coreApi.queries)).toHaveLength(1);

    api.dispose();

    expect(Object.keys(api.store.getState().coreApi.queries)).toHaveLength(0);
  });

  test('reports a malformed simulator response without leaking an internal property error', async () => {
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ devices: [] })) as typeof fetch;
    const api = new ClientApi({ origin: 'http://127.0.0.1:41765/' });

    await expect(api.simulators()).rejects.toMatchObject({
      message: 'Core returned an invalid Simulator list. Refresh Monad Design and try again.'
    });
  });
});

test('connect reports build progress, sends rebuild and stops polling after completion', async () => {
  let finish: (value: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const requests: Array<{ url: string; body?: BodyInit | null }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body });
    if (String(url).includes('connect-status')) return Response.json({ phase: 'building' });
    return pending;
  }) as typeof fetch;
  const api = new ClientApi({ origin: 'http://127.0.0.1:41765' });
  const labels: string[] = [];
  const connected = api.connect('project', 'device', 'com.example.app', {
    rebuild: true,
    onProgress: (label) => labels.push(label)
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(labels).toEqual(['Preparing Simulator…', 'Building Debug app…']);
    expect(JSON.parse(String(requests[0]?.body))).toEqual({
      projectId: 'project',
      udid: 'device',
      bundleIdentifier: 'com.example.app',
      rebuild: true
    });
    finish(
      Response.json({
        udid: 'device',
        projectId: 'project',
        bundleIdentifier: 'com.example.app',
        streamPath: '/v1/simulator/stream',
        inputPath: '/v1/simulator/input'
      })
    );
    await connected;
    const count = requests.length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(requests).toHaveLength(count);
  } finally {
    finish(Response.json({}));
    api.dispose();
  }
});
