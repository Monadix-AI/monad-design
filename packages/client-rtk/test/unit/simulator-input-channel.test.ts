import { describe, expect, test } from 'bun:test';

import { connectSimulatorInputChannel } from '../../src/simulator-input-channel';

class FakeSocket extends EventTarget {
  binaryType = 'blob';
  readyState = 0;
  sent: Parameters<WebSocket['send']>[0][] = [];
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  send(data: Parameters<WebSocket['send']>[0]) {
    this.sent.push(data);
  }
}

const callbacks = {
  onOpen: () => undefined,
  onMessage: () => undefined,
  onDisconnected: () => undefined,
  onUnavailable: () => undefined
};

describe('simulator input channel', () => {
  test('reconnects after close and ignores late events from the previous socket', async () => {
    const sockets: FakeSocket[] = [];
    const replacement = Promise.withResolvers<void>();
    let opens = 0;
    let messages = 0;
    let disconnects = 0;
    const channel = connectSimulatorInputChannel({
      ...callbacks,
      url: 'ws://example/input',
      retryDelaysMs: [1],
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        if (sockets.length === 2) replacement.resolve();
        return socket as unknown as WebSocket;
      },
      onOpen: () => {
        opens += 1;
      },
      onMessage: () => {
        messages += 1;
      },
      onDisconnected: () => {
        disconnects += 1;
      }
    });
    try {
      const first = sockets[0];
      if (!first) throw new Error('Missing initial socket');
      first.open();
      expect(channel.send(new ArrayBuffer(1))).toBe(true);
      first.close();
      expect(channel.send(new ArrayBuffer(1))).toBe(false);
      await replacement.promise;
      const second = sockets[1];
      if (!second) throw new Error('Missing replacement socket');
      first.open();
      first.dispatchEvent(new MessageEvent('message', { data: 'stale' }));
      first.dispatchEvent(new Event('error'));
      second.open();
      second.dispatchEvent(new MessageEvent('message', { data: 'current' }));
      expect(opens).toBe(2);
      expect(messages).toBe(1);
      expect(disconnects).toBe(1);
      expect(channel.send(new ArrayBuffer(2))).toBe(true);
      expect(first.sent).toHaveLength(1);
      expect(second.sent).toHaveLength(1);
    } finally {
      channel.close();
    }
  });

  test('bounds failed attempts, including connections that never open', async () => {
    let attempts = 0;
    const unavailable = Promise.withResolvers<void>();
    const channel = connectSimulatorInputChannel({
      ...callbacks,
      url: 'ws://example/input',
      retryDelaysMs: [1, 1],
      connectionTimeoutMs: 1,
      createSocket: () => {
        attempts += 1;
        return new FakeSocket() as unknown as WebSocket;
      },
      onUnavailable: () => unavailable.resolve()
    });
    try {
      await unavailable.promise;
      expect(attempts).toBe(3);
      expect(channel.send(new ArrayBuffer(1))).toBe(false);
    } finally {
      channel.close();
    }
  });

  test('cancels queued retries when the workspace disconnects', async () => {
    let attempts = 0;
    const socket = new FakeSocket();
    const channel = connectSimulatorInputChannel({
      ...callbacks,
      url: 'ws://example/input',
      retryDelaysMs: [1],
      createSocket: () => {
        attempts += 1;
        return socket as unknown as WebSocket;
      }
    });
    socket.dispatchEvent(new Event('error'));
    channel.close();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(attempts).toBe(1);
    expect(channel.send(new ArrayBuffer(1))).toBe(false);
  });

  test('handles synchronous connection failures without an unbounded retry loop', async () => {
    const unavailable = Promise.withResolvers<void>();
    let attempts = 0;
    const channel = connectSimulatorInputChannel({
      ...callbacks,
      url: 'ws://example/input',
      retryDelaysMs: [1],
      createSocket: () => {
        attempts += 1;
        throw new Error('unavailable');
      },
      onUnavailable: () => unavailable.resolve()
    });
    try {
      await unavailable.promise;
      expect(attempts).toBe(2);
    } finally {
      channel.close();
    }
  });
});
