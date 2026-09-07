interface PollingOptions {
  intervalMs: number | false;
  visibility?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
}

/** Polls serially; hidden pages resume immediately without overlapping a pending request. */
export function startPolling(task: () => Promise<unknown>, { intervalMs, visibility }: PollingOptions) {
  let disposed = false;
  let running = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (disposed || running || visibility?.hidden) return;
    running = true;
    try {
      await task();
    } finally {
      running = false;
      if (!disposed && !visibility?.hidden && intervalMs !== false) {
        timeout = setTimeout(() => void poll(), intervalMs);
      }
    }
  };
  const visibilityChanged = () => {
    clearTimeout(timeout);
    if (!visibility?.hidden) void poll();
  };
  visibility?.addEventListener('visibilitychange', visibilityChanged);
  void poll();
  return () => {
    disposed = true;
    clearTimeout(timeout);
    visibility?.removeEventListener('visibilitychange', visibilityChanged);
  };
}
