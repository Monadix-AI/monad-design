export interface SimulatorInputChannelOptions {
  url: string;
  onOpen: () => void;
  onMessage: (event: MessageEvent, socket: WebSocket) => void;
  onDisconnected: () => void;
  onUnavailable: () => void;
  createSocket?: (url: string) => WebSocket;
  retryDelaysMs?: readonly number[];
  connectionTimeoutMs?: number;
}

/** Owns one input connection, including bounded retries and cancellation. */
export function connectSimulatorInputChannel({
  url,
  onOpen,
  onMessage,
  onDisconnected,
  onUnavailable,
  createSocket = (address) => new WebSocket(address),
  retryDelaysMs = [250, 500, 1_000, 2_000, 4_000],
  connectionTimeoutMs = 5_000
}: SimulatorInputChannelOptions) {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let connectionTimer: ReturnType<typeof setTimeout> | undefined;

  const reconnect = () => {
    if (disposed) return;
    onDisconnected();
    const delay = retryDelaysMs[retries++];
    if (delay === undefined) {
      onUnavailable();
      return;
    }
    retryTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (disposed) return;
    retryTimer = undefined;
    let next: WebSocket;
    try {
      next = createSocket(url);
    } catch {
      reconnect();
      return;
    }
    socket = next;
    next.binaryType = 'arraybuffer';
    const current = () => !disposed && socket === next;
    const disconnected = () => {
      if (!current()) return;
      clearTimeout(connectionTimer);
      socket = null;
      next.close();
      reconnect();
    };
    connectionTimer = setTimeout(disconnected, connectionTimeoutMs);
    next.addEventListener('open', () => {
      if (!current()) return;
      clearTimeout(connectionTimer);
      retries = 0;
      onOpen();
    });
    next.addEventListener('message', (event) => {
      if (current()) onMessage(event, next);
    });
    next.addEventListener('error', disconnected);
    next.addEventListener('close', disconnected);
  };

  connect();
  return {
    send(data: Parameters<WebSocket['send']>[0]) {
      if (disposed || socket?.readyState !== 1) return false;
      try {
        socket.send(data);
        return true;
      } catch {
        const failed = socket;
        socket = null;
        clearTimeout(connectionTimer);
        failed.close();
        reconnect();
        return false;
      }
    },
    close() {
      disposed = true;
      clearTimeout(retryTimer);
      clearTimeout(connectionTimer);
      const previous = socket;
      socket = null;
      previous?.close();
    }
  };
}
