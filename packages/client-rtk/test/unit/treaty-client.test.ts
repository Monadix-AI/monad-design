import { expect, test } from 'bun:test';

import { createCoreTreaty } from '../../src/treaty-client';

test('Core treaty targets v1 and sends pairing metadata', async () => {
  let captured: Request | undefined;
  const fetcher = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Request(input, init);
      return Response.json({
        name: 'Monad Design Core',
        protocolVersion: 1,
        platform: 'darwin',
        apiVersion: 'v1'
      });
    },
    { preconnect: fetch.preconnect }
  );
  const client = createCoreTreaty({
    baseUrl: 'http://core.test/',
    pairingCode: '123456',
    clientId: 'test-client',
    clientKind: 'agent',
    config: {
      fetcher
    }
  });

  const result = await client.v1.health.get();

  expect(result.error).toBeNull();
  expect(result.data).toMatchObject({ protocolVersion: 1, apiVersion: 'v1' });
  expect(captured?.url).toBe('http://core.test/v1/health');
  expect(captured?.headers.get('authorization')).toBe('Bearer 123456');
  expect(captured?.headers.get('x-monad-design-client-id')).toBe('test-client');
  expect(captured?.headers.get('x-monad-design-client-kind')).toBe('agent');
});

test('Core treaty calls explicit simulator routes', async () => {
  let captured: Request | undefined;
  const fetcher = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Request(input, init);
      return Response.json({
        udid: 'SIMULATOR-UDID',
        projectId: 'project-1',
        bundleIdentifier: 'com.example.sample',
        streamPath: '/v1/simulator/stream',
        inputPath: '/v1/simulator/input'
      });
    },
    { preconnect: fetch.preconnect }
  );
  const client = createCoreTreaty({
    baseUrl: 'http://core.test',
    pairingCode: '123456',
    config: { fetcher }
  });

  const result = await client.v1.simulators.connect.post({
    projectId: 'project-1',
    udid: 'SIMULATOR-UDID',
    bundleIdentifier: 'com.example.sample'
  });

  expect(result.error).toBeNull();
  expect(captured?.url).toBe('http://core.test/v1/simulators/connect');
  expect(captured?.method).toBe('POST');
  expect(await captured?.json()).toEqual({
    projectId: 'project-1',
    udid: 'SIMULATOR-UDID',
    bundleIdentifier: 'com.example.sample'
  });
});
