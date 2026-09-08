import { expect, test } from 'bun:test';
import { node } from '@elysia/node';
import { Elysia } from 'elysia';

import { latestMjpegStream } from '../../src/server/latest-mjpeg-stream';

test('HTTP stream preserves complete frames and releases upstream on disconnect', async () => {
  let disconnect!: () => void;
  const disconnected = new Promise<void>((resolve) => {
    disconnect = resolve;
  });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const part = Buffer.concat([
    Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`),
    jpeg,
    Buffer.from('\r\n')
  ]);
  let port = 0;
  let stop: (() => unknown) | undefined;
  new Elysia({ adapter: node() })
    .get('/stream', () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(part);
        },
        cancel() {
          disconnect();
        }
      });
      return new Response(latestMjpegStream(source), {
        headers: { 'content-type': 'multipart/x-mixed-replace; boundary=frame' }
      });
    })
    .listen({ hostname: '127.0.0.1', port: 0 }, (server) => {
      const handle = server as unknown as {
        raw: { bun?: { server: { port: number } }; node?: { server: { address: () => { port: number } } } };
        stop: () => unknown;
      };
      port = handle.raw.bun?.server.port ?? handle.raw.node?.server.address().port ?? 0;
      stop = () => handle.stop();
    });

  const abort = new AbortController();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/stream`, { signal: abort.signal });
    expect(response.headers.get('content-type')).toBe('multipart/x-mixed-replace; boundary=frame');
    if (!response.body) throw new Error('Missing stream body');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (bytes < part.length) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      bytes += value.length;
    }
    expect(Buffer.concat(chunks)).toEqual(part);
    abort.abort();
    await reader.cancel().catch(() => {});
    await Promise.race([
      disconnected,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Upstream was not cancelled')), 1000))
    ]);
  } finally {
    abort.abort();
    await stop?.();
  }
});
