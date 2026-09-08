const maxFrameBytes = 32 * 1024 * 1024;
const maxHeaderBytes = 4096;

/** Drain capture continuously, retaining only the newest complete multipart frame. */
export const latestMjpegStream = (
  source: ReadableStream<Uint8Array>,
  options: { isDisconnected?: () => boolean } = {}
) => {
  const reader = source.getReader();
  let pending: Buffer | undefined;
  let finished = false;
  let cancelled = false;
  let wake: (() => void) | undefined;
  let failure: unknown;

  const notify = () => {
    wake?.();
    wake = undefined;
  };

  const pump = async () => {
    let buffered: Buffer = Buffer.alloc(0);
    let frameBytes: number | undefined;
    try {
      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) {
          if (buffered.length) throw new Error('Truncated simulator frame.');
          break;
        }
        buffered = Buffer.concat([buffered, value]);
        while (buffered.length) {
          if (frameBytes === undefined) {
            const headerEnd = buffered.indexOf('\r\n\r\n');
            if (headerEnd < 0) {
              if (buffered.length > maxHeaderBytes) throw new Error('Simulator frame header is too large.');
              break;
            }
            if (headerEnd > maxHeaderBytes) throw new Error('Simulator frame header is too large.');
            const match = /\r\ncontent-length:\s*(\d+)\r\n/i.exec(
              buffered.subarray(0, headerEnd + 2).toString('ascii')
            );
            const length = Number(match?.[1]);
            if (!Number.isSafeInteger(length) || length <= 0 || length > maxFrameBytes) {
              throw new Error('Invalid simulator frame length.');
            }
            frameBytes = headerEnd + 4 + length + 2;
          }
          if (buffered.length < frameBytes) break;
          if (buffered.toString('ascii', frameBytes - 2, frameBytes) !== '\r\n') {
            throw new Error('Invalid simulator frame terminator.');
          }
          pending = Buffer.from(buffered.subarray(0, frameBytes));
          buffered = buffered.subarray(frameBytes);
          frameBytes = undefined;
          notify();
        }
      }
    } catch (error) {
      // Bridge teardown resets its sockets; an obsolete response should end
      // normally rather than forward that reset to the HTTP server.
      if (!cancelled && !options.isDisconnected?.()) failure = error;
      else pending = undefined;
      await reader.cancel(error).catch(() => {});
    } finally {
      finished = true;
      reader.releaseLock();
      notify();
    }
  };

  void pump();
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        while (!pending && !finished)
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        if (cancelled) return;
        if (failure) {
          controller.error(failure);
        } else if (pending) {
          const frame = pending;
          pending = undefined;
          controller.enqueue(frame);
        } else {
          controller.close();
        }
      },
      async cancel(reason) {
        cancelled = true;
        pending = undefined;
        if (!finished) await reader.cancel(reason).catch(() => {});
      }
    },
    { highWaterMark: 0 }
  );
};
