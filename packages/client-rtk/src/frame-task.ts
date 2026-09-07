/** Retains only the latest pointer update until the next animation frame. */
export function createFrameTask({
  requestFrame = (callback: FrameRequestCallback) => requestAnimationFrame(callback),
  cancelFrame = (id: number) => cancelAnimationFrame(id)
} = {}) {
  let frame: number | null = null;
  let pending: (() => void) | null = null;
  return {
    schedule(task: () => void) {
      pending = task;
      if (frame !== null) return;
      frame = requestFrame(() => {
        frame = null;
        const next = pending;
        pending = null;
        next?.();
      });
    },
    flush() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      const next = pending;
      pending = null;
      next?.();
    },
    cancel() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      pending = null;
    }
  };
}
