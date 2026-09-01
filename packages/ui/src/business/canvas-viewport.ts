import { clampCanvasOffset, maximumCanvasScale, minimumCanvasScale } from '@monaddesign/simulator';
import { type PointerEvent, useCallback, useEffect, useRef, useState, type WheelEvent } from 'react';

import {
  type CanvasMode,
  fitLiveWorkspaceCanvas,
  liveWorkspaceCanvasPlacement,
  webDeviceControlsReservedHeight
} from './canvas-controls';

export const canvasModeAllowsViewportNavigation = (mode: CanvasMode) => {
  switch (mode) {
    case 'annotate':
    case 'interact':
    case 'variants':
      return true;
  }
};

interface CanvasViewportSnapshot {
  offset: { x: number; y: number };
  scale: number;
  viewChanged: boolean;
}

interface PendingCanvasView extends Pick<CanvasViewportSnapshot, 'offset' | 'scale'> {
  commitState: boolean;
}

export function useCanvasViewport({
  deviceFrame,
  mode,
  resetKey
}: {
  deviceFrame: { frameHeight: number; frameWidth: number };
  mode: CanvasMode;
  resetKey?: string | null;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canvas = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const pendingView = useRef<PendingCanvasView | null>(null);
  const viewFrame = useRef<number | null>(null);
  const viewChanged = useRef(false);
  const temporaryView = useRef<CanvasViewportSnapshot | null>(null);
  const previousMode = useRef(mode);
  const drag = useRef<{
    offsetX: number;
    offsetY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const fitRef = useRef<() => void>(() => undefined);
  const constrainOffsetRef = useRef<
    (nextOffset: { x: number; y: number }, nextScale: number) => { x: number; y: number }
  >((nextOffset) => nextOffset);
  const applyCanvasView = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      const viewport = canvas.current;
      if (!viewport) return;
      const placement = liveWorkspaceCanvasPlacement(mode);
      viewport.style.setProperty('--canvas-offset-x', `${nextOffset.x}px`);
      viewport.style.setProperty('--canvas-offset-y', `${nextOffset.y}px`);
      viewport.style.setProperty('--canvas-scale', `${nextScale}`);
      viewport.style.setProperty('--canvas-render-scale', `${nextScale * placement.scale}`);
    },
    [mode]
  );

  const cancelScheduledView = useCallback(() => {
    if (viewFrame.current !== null) window.cancelAnimationFrame(viewFrame.current);
    viewFrame.current = null;
    pendingView.current = null;
  }, []);

  const commitView = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      cancelScheduledView();
      scaleRef.current = nextScale;
      offsetRef.current = nextOffset;
      applyCanvasView(nextScale, nextOffset);
      setScale(nextScale);
      setOffset(nextOffset);
    },
    [applyCanvasView, cancelScheduledView]
  );
  const commitViewRef = useRef(commitView);
  commitViewRef.current = commitView;

  const scheduleView = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }, commitState = true) => {
      scaleRef.current = nextScale;
      offsetRef.current = nextOffset;
      pendingView.current = { scale: nextScale, offset: nextOffset, commitState };
      if (viewFrame.current !== null) return;
      viewFrame.current = window.requestAnimationFrame(() => {
        const next = pendingView.current;
        viewFrame.current = null;
        pendingView.current = null;
        if (!next) return;
        applyCanvasView(next.scale, next.offset);
        if (!next.commitState) return;
        setScale(next.scale);
        setOffset(next.offset);
      });
    },
    [applyCanvasView]
  );

  useEffect(() => cancelScheduledView, [cancelScheduledView]);
  useEffect(() => applyCanvasView(scaleRef.current, offsetRef.current), [applyCanvasView]);

  const constrainOffset = useCallback(
    (nextOffset: { x: number; y: number }, nextScale: number) => {
      const viewport = canvas.current;
      if (!viewport) return nextOffset;
      const content =
        mode === 'variants'
          ? { width: viewport.clientWidth * nextScale, height: viewport.clientHeight * nextScale }
          : {
              width: deviceFrame.frameWidth * nextScale,
              height: deviceFrame.frameHeight * nextScale + webDeviceControlsReservedHeight
            };
      return clampCanvasOffset(nextOffset, { width: viewport.clientWidth, height: viewport.clientHeight }, content);
    },
    [deviceFrame.frameHeight, deviceFrame.frameWidth, mode]
  );

  const fitCanvas = useCallback(() => {
    const viewport = canvas.current;
    if (!viewport) return;
    if (mode === 'variants') {
      commitView(1, { x: 0, y: 0 });
      return;
    }
    const nextView = fitLiveWorkspaceCanvas(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      { width: deviceFrame.frameWidth, height: deviceFrame.frameHeight }
    );
    commitView(nextView.scale, nextView.offset);
  }, [commitView, deviceFrame.frameHeight, deviceFrame.frameWidth, mode]);
  fitRef.current = fitCanvas;
  constrainOffsetRef.current = constrainOffset;

  useEffect(() => {
    if (!resetKey) return;
    viewChanged.current = false;
    temporaryView.current = null;
    const frame = window.requestAnimationFrame(() => fitRef.current());
    const observer = new ResizeObserver(() => {
      if (!viewChanged.current) {
        fitRef.current();
        return;
      }
      commitViewRef.current(scaleRef.current, constrainOffsetRef.current(offsetRef.current, scaleRef.current));
    });
    if (canvas.current) observer.observe(canvas.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [resetKey]);

  useEffect(() => {
    const lastMode = previousMode.current;
    previousMode.current = mode;
    if (lastMode === mode || (lastMode !== 'variants' && mode !== 'variants')) return;
    cancelScheduledView();
    drag.current = null;
    setIsDragging(false);
    viewChanged.current = false;
    temporaryView.current = null;
    const frame = window.requestAnimationFrame(() => fitRef.current());
    return () => window.cancelAnimationFrame(frame);
  }, [cancelScheduledView, mode]);

  useEffect(() => {
    if (!resetKey) return;
    commitView(scaleRef.current, constrainOffset(offsetRef.current, scaleRef.current));
  }, [commitView, constrainOffset, resetKey]);

  const changeScale = (nextScale: number) => {
    viewChanged.current = true;
    const boundedScale = Math.min(maximumCanvasScale, Math.max(minimumCanvasScale, nextScale));
    commitView(boundedScale, constrainOffset(offsetRef.current, boundedScale));
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!canvasModeAllowsViewportNavigation(mode)) return;
    event.preventDefault();
    viewChanged.current = true;
    const viewport = canvas.current;
    if (!viewport) return;
    const deltaPixels =
      event.deltaY *
      (event.deltaMode === globalThis.WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === globalThis.WheelEvent.DOM_DELTA_PAGE
          ? viewport.clientHeight
          : 1);
    const currentScale = scaleRef.current;
    const nextScale = Math.min(
      maximumCanvasScale,
      Math.max(minimumCanvasScale, currentScale * Math.exp(-deltaPixels * 0.0025))
    );
    if (nextScale === currentScale) return;
    scheduleView(nextScale, constrainOffset(offsetRef.current, nextScale));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasModeAllowsViewportNavigation(mode) || (event.target as HTMLElement).closest('[data-canvas-ui]')) return;
    viewChanged.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    scheduleView(
      scaleRef.current,
      constrainOffset(
        {
          x: currentDrag.offsetX + event.clientX - currentDrag.startX,
          y: currentDrag.offsetY + event.clientY - currentDrag.startY
        },
        scaleRef.current
      ),
      false
    );
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitView(scaleRef.current, offsetRef.current);
    setIsDragging(false);
  };

  const beginTemporaryView = () => {
    temporaryView.current = {
      offset: offsetRef.current,
      scale: scaleRef.current,
      viewChanged: viewChanged.current
    };
  };

  const restoreTemporaryView = () => {
    drag.current = null;
    setIsDragging(false);
    const previous = temporaryView.current;
    temporaryView.current = null;
    if (!previous) {
      viewChanged.current = false;
      fitCanvas();
      return;
    }
    viewChanged.current = previous.viewChanged;
    commitView(previous.scale, previous.offset);
  };

  return {
    beginTemporaryView,
    canvas,
    changeScale,
    finishPointer,
    fit: fitCanvas,
    handlePointerDown,
    handlePointerMove,
    handleWheel,
    isDragging,
    offset,
    restoreTemporaryView,
    scale,
    viewChanged
  };
}
