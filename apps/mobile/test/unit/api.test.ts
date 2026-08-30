import { afterEach, describe, expect, test } from 'bun:test';

import { ClientApi } from '../../src/api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ClientApi projects', () => {
  test('lists and opens projects through the paired desktop', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return Response.json(
        String(url).includes('/v1/projects?')
          ? {
              projects: [
                {
                  id: 'project-1',
                  name: 'Sample App',
                  lastOpenedAt: '2026-08-28T08:00:00.000Z',
                  targetApps: [
                    {
                      bundleIdentifier: 'com.example.sample',
                      name: 'Sample App'
                    }
                  ]
                }
              ],
              limit: 100,
              offset: 0,
              total: 1
            }
          : {
              id: 'project-1',
              name: 'Sample App',
              lastOpenedAt: '2026-08-28T08:00:00.000Z',
              targetApps: [
                {
                  bundleIdentifier: 'com.example.sample',
                  name: 'Sample App'
                }
              ]
            }
      );
    }) as typeof fetch;
    const api = new ClientApi({
      origin: '192.168.1.20:41765',
      pairingCode: '123456'
    });

    expect(api.connection.pairingCode).toBe('123456');
    expect(api.streamUrl('/v1/simulator/stream')).toBe(
      'http://192.168.1.20:41765/v1/simulator/stream?accessToken=123456'
    );

    expect(await api.projects()).toHaveLength(1);
    expect((await api.openProject('project-1')).name).toBe('Sample App');
    expect(requests[0]?.url).toBe('http://192.168.1.20:41765/v1/projects?limit=100&offset=0');
    expect(requests[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer 123456',
      'x-monad-design-client-kind': 'companion'
    });
    expect(requests[1]?.init?.method).toBe('POST');
    expect(requests[1]?.url).toBe('http://192.168.1.20:41765/v1/projects/project-1/open');
    expect(requests[1]?.init?.body).toBeUndefined();
  });

  test('binds simulator operations to the selected project', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return Response.json({});
    }) as typeof fetch;
    const api = new ClientApi({
      origin: '192.168.1.20:41765',
      pairingCode: '123456'
    });

    await api.connect('project-1', 'SIMULATOR-UDID', 'com.example.sample');
    await api.launchVariant('v2');
    await api.launchApp();

    expect(requests[0]?.url).toEndWith('/v1/simulators/connect');
    expect(requests[0]?.init?.body).toBe(
      '{"projectId":"project-1","udid":"SIMULATOR-UDID","bundleIdentifier":"com.example.sample"}'
    );
    expect(requests[1]?.url).toEndWith('/v1/simulator/variant');
    expect(requests[1]?.init?.body).toBe('{"variant":"v2"}');
    expect(requests[2]?.url).toEndWith('/v1/simulator/app');
    expect(requests[2]?.init?.body).toBeUndefined();
  });
});
