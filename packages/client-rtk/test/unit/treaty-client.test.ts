import { expect, test } from 'bun:test';

import { createCoreTreaty } from '../../src/treaty-client';

test('Core treaty targets v1', async () => {
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
    config: {
      fetcher
    }
  });

  const result = await client.v1.health.get();

  expect(result.error).toBeNull();
  expect(result.data).toMatchObject({ protocolVersion: 1, apiVersion: 'v1' });
  expect(captured?.url).toBe('http://core.test/v1/health');
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

test('Core treaty preserves hyphenated route segments', async () => {
  const captured: Request[] = [];
  const fetcher = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push(new Request(input, init));
      return Response.json({ session: null });
    },
    { preconnect: fetch.preconnect }
  );
  const client = createCoreTreaty({
    baseUrl: 'http://core.test',
    config: { fetcher }
  });

  await client.v1['agent-session'].active.get();
  await client.v1['agent-session']({ id: 'session-1' })['confirm-selection'].post({
    requestId: 'request-1',
    variant: 'v1'
  });
  await client.v1.admin.projects['detect-targets'].post({ path: '/tmp/project' });

  expect(captured.map(({ url }) => url)).toEqual([
    'http://core.test/v1/agent-session/active',
    'http://core.test/v1/agent-session/session-1/confirm-selection',
    'http://core.test/v1/admin/projects/detect-targets'
  ]);
});
