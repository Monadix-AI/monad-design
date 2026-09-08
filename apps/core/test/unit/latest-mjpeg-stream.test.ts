import { describe, expect, test } from 'bun:test';

import { latestMjpegStream } from '../../src/server/latest-mjpeg-stream';

const frame = (body: string) =>
  Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}\r\n`);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const fixture = () => {
  let input!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      input = controller;
    },
    cancel() {
      cancelled = true;
    }
  });
  return { input, reader: latestMjpegStream(source).getReader(), cancelled: () => cancelled };
};

describe('latestMjpegStream', () => {
  test('slow consumers receive the newest complete frame, without a stale queue', async () => {
    const { input, reader } = fixture();
    input.enqueue(frame('first'));
    expect((await reader.read()).value).toEqual(frame('first'));
    for (let index = 0; index < 100; index++) input.enqueue(frame(String(index)));
    await tick();
    expect((await reader.read()).value).toEqual(frame('99'));
    input.close();
    expect((await reader.read()).done).toBe(true);
  });

  test('reassembles fragmented headers and payloads without emitting partial frames', async () => {
    const { input, reader } = fixture();
    const bytes = frame('jpeg\r\n--frame\r\ndata');
    const next = reader.read();
    for (const byte of bytes) input.enqueue(Uint8Array.of(byte));
    expect((await next).value).toEqual(bytes);
    await reader.cancel();
  });

  test('cancels upstream when the client disconnects', async () => {
    const fixtureValue = fixture();
    await fixtureValue.reader.cancel();
    expect(fixtureValue.cancelled()).toBe(true);
  });

  test('disconnect resolves a read waiting for the next frame', async () => {
    const { reader, cancelled } = fixture();
    const waiting = reader.read();
    await tick();
    await reader.cancel();
    expect((await waiting).done).toBe(true);
    expect(cancelled()).toBe(true);
  });

  test('rejects oversized frames and cancels upstream', async () => {
    const { input, reader, cancelled } = fixture();
    input.enqueue(Buffer.from('--frame\r\nContent-Length: 999999999\r\n\r\n'));
    await expect(reader.read()).rejects.toThrow('Invalid simulator frame length');
    expect(cancelled()).toBe(true);
  });

  test('propagates upstream failure', async () => {
    const { input, reader } = fixture();
    input.error(new Error('capture stopped'));
    await expect(reader.read()).rejects.toThrow('capture stopped');
  });

  test('rejects a truncated frame at end of stream', async () => {
    const { input, reader } = fixture();
    input.enqueue(frame('partial').subarray(0, -3));
    input.close();
    await expect(reader.read()).rejects.toThrow('Truncated simulator frame');
  });
});
