import type { ProjectStore } from '../project-store';

import { node } from '@elysia/node';
import {
  accessibilitySnapshotSchema,
  appearanceResponseSchema,
  connectSimulatorRequestSchema,
  copiedResponseSchema,
  disconnectedResponseSchema,
  launchAppResponseSchema,
  launchVariantRequestSchema,
  launchVariantResponseSchema,
  listSimulatorsResponseSchema,
  screenshotResponseSchema,
  setAppearanceRequestSchema,
  setPasteboardRequestSchema,
  simulatorConnectionSchema
} from '@monaddesign/client-contract';
import { Elysia } from 'elysia';

import { simulatorBridge } from '../simulator-bridge';
import { captureSimulatorScreen, listAvailableSimulators } from '../simulators';
import { CoreApiError } from './api-error';
import { createSimulatorService } from './simulator-service';

type ProjectResolver = Pick<ProjectStore, 'open'>;

const conflict = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CoreApiError) throw error;
    throw new CoreApiError(409, 'CONFLICT', error instanceof Error ? error.message : 'Simulator operation failed.');
  }
};

export const createSimulatorRoutes = (projectStore: ProjectResolver, adapter = node()) => {
  const upstreamSockets = new WeakMap<object, WebSocket>();
  const simulatorService = createSimulatorService(projectStore);
  return new Elysia({ adapter, name: 'core.simulators' })
    .get(
      '/simulators',
      async () => ({ simulators: await listAvailableSimulators(simulatorBridge.connection?.udid ?? null) }),
      { response: { 200: listSimulatorsResponseSchema } }
    )
    .post(
      '/simulators/connect',
      ({ body: { bundleIdentifier, projectId, udid } }) =>
        conflict(async () => {
          const connection = await simulatorService.connect(projectId, udid, bundleIdentifier);
          return {
            udid: connection.udid,
            projectId: connection.projectId,
            bundleIdentifier: connection.bundleIdentifier,
            streamPath: '/v1/simulator/stream' as const,
            inputPath: '/v1/simulator/input' as const,
            orientation: connection.orientation
          };
        }),
      {
        body: connectSimulatorRequestSchema,
        response: { 200: simulatorConnectionSchema }
      }
    )
    .delete(
      '/simulator/connection',
      async () => {
        await simulatorBridge.disconnect();
        return { connected: false as const };
      },
      { response: { 200: disconnectedResponseSchema } }
    )
    .get('/simulator/accessibility', () => conflict(() => simulatorBridge.accessibilitySnapshot()), {
      response: { 200: accessibilitySnapshotSchema }
    })
    .get(
      '/simulator/appearance',
      async () => ({
        appearance: await conflict(() => simulatorBridge.appearance())
      }),
      { response: { 200: appearanceResponseSchema } }
    )
    .put(
      '/simulator/appearance',
      async ({ body: { appearance } }) => {
        await conflict(() => simulatorBridge.setAppearance(appearance));
        return { appearance };
      },
      {
        body: setAppearanceRequestSchema,
        response: { 200: appearanceResponseSchema }
      }
    )
    .post(
      '/simulator/pasteboard',
      async ({ body: { text } }) => {
        await conflict(() => simulatorBridge.setPasteboard(text));
        return { copied: true as const };
      },
      {
        body: setPasteboardRequestSchema,
        response: { 200: copiedResponseSchema }
      }
    )
    .get(
      '/simulator/screenshot',
      () =>
        conflict(async () => {
          const udid = simulatorBridge.connection?.udid;
          if (!udid) {
            throw new CoreApiError(409, 'CONFLICT', 'Connect to a simulator first.');
          }
          return { image: await captureSimulatorScreen(udid) };
        }),
      { response: { 200: screenshotResponseSchema } }
    )
    .post('/simulator/app', () => conflict(simulatorService.launchApp), {
      response: { 200: launchAppResponseSchema }
    })
    .post('/simulator/variant', ({ body: { variant } }) => conflict(() => simulatorService.launchVariant(variant)), {
      body: launchVariantRequestSchema,
      response: { 200: launchVariantResponseSchema }
    })
    .get('/simulator/stream', async ({ request }) => {
      const connection = simulatorBridge.connection;
      if (!connection) {
        throw new CoreApiError(409, 'CONFLICT', 'Connect to a simulator first.');
      }
      const upstream = await fetch(connection.streamUrl, {
        signal: request.signal
      });
      if (!upstream.ok || !upstream.body) {
        throw new CoreApiError(502, 'BAD_GATEWAY', 'Simulator stream is unavailable.', true);
      }
      return new Response(upstream.body, {
        headers: {
          'cache-control': 'no-store',
          'content-type': upstream.headers.get('content-type') ?? 'multipart/x-mixed-replace'
        }
      });
    })
    .ws('/simulator/input', {
      beforeHandle: () => {
        if (!simulatorBridge.connection) {
          throw new CoreApiError(409, 'CONFLICT', 'Connect to a simulator first.');
        }
      },
      open: (socket) => {
        const connection = simulatorBridge.connection;
        if (!connection) return socket.close(1011, 'Simulator disconnected');
        const upstream = new WebSocket(connection.wsUrl);
        upstream.binaryType = 'arraybuffer';
        upstream.addEventListener('message', (event) => socket.send(event.data));
        upstream.addEventListener('close', () => socket.close());
        upstream.addEventListener('error', () => socket.close(1011, 'Simulator input relay failed'));
        upstreamSockets.set(socket.raw, upstream);
      },
      message: (socket, message) => {
        const upstream = upstreamSockets.get(socket.raw);
        if (upstream?.readyState !== WebSocket.OPEN) return;
        if (typeof message === 'string') return upstream.send(message);
        if (message instanceof ArrayBuffer) {
          return upstream.send(new Uint8Array(message));
        }
        if (ArrayBuffer.isView(message)) {
          const view = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
          return upstream.send(Uint8Array.from(view));
        }
        upstream.send(JSON.stringify(message));
      },
      close: (socket) => {
        upstreamSockets.get(socket.raw)?.close();
        upstreamSockets.delete(socket.raw);
      }
    });
};
