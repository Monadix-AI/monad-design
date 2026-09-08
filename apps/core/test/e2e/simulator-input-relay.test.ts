import { expect, test } from 'bun:test';

import { createSimulatorRoutes } from '../../src/server/simulator-routes';
import { simulatorBridge } from '../../src/simulator-bridge';

test('simulator relay preserves binary configuration and touch frames', async () => {
  const configuration = Buffer.concat([Buffer.from([130]), Buffer.from('{"width":1206,"height":2622}')]);
  let received!: (value: unknown) => void;
  const input = new Promise<unknown>((resolve) => {
    received = resolve;
  });
  const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      open(socket) {
        socket.send(configuration);
      },
      message(_socket, message) {
        received(message);
      }
    }
  });
  const previous = Object.getOwnPropertyDescriptor(simulatorBridge, 'connection');
  Object.defineProperty(simulatorBridge, 'connection', {
    configurable: true,
    value: { wsUrl: `ws://127.0.0.1:${upstream.port}` }
  });
  let stop: (() => unknown) | undefined;
  let client: WebSocket | undefined;
  try {
    let port = 0;
    createSimulatorRoutes({
      open: async () => {
        throw new Error('unused');
      }
    }).listen({ hostname: '127.0.0.1', port: 0 }, (server) => {
      const handle = server as unknown as { raw: { bun: { server: { port: number } } }; stop: () => unknown };
      port = handle.raw.bun.server.port;
      stop = () => handle.stop();
    });
    client = new WebSocket(`ws://127.0.0.1:${port}/simulator/input`);
    client.binaryType = 'arraybuffer';
    const response = await new Promise<MessageEvent>((resolve, reject) => {
      if (!client) return reject(new Error('missing client'));
      client.onmessage = resolve;
      client.onerror = () => reject(new Error('relay connection failed'));
    });
    expect(response.data).toBeInstanceOf(ArrayBuffer);
    expect(Buffer.from(response.data)).toEqual(configuration);
    const touch = Buffer.concat([Buffer.from([3]), Buffer.from('{"type":"begin","x":0.5,"y":0.5}')]);
    client.send(touch);
    const message = await input;
    expect(typeof message).not.toBe('string');
    expect(Buffer.from(message as Uint8Array)).toEqual(touch);
  } finally {
    client?.close();
    await stop?.();
    upstream.stop(true);
    if (previous) Object.defineProperty(simulatorBridge, 'connection', previous);
    else Reflect.deleteProperty(simulatorBridge, 'connection');
  }
}, 5000);
