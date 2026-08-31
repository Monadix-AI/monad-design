import { canvasOffsetForZoom, clampCanvasOffset, maximumCanvasScale, minimumCanvasScale } from '@monaddesign/simulator';
import { type PointerEvent, useCallback, useEffect, useRef, useState, type WheelEvent } from 'react';

import { type CanvasMode, fitLiveWorkspaceCanvas, webDeviceControlsReservedHeight } from './canvas-controls';

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
  scaleRef.current = scale;
  offsetRef.current = offset;

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
      scaleRef.current = 1;
      offsetRef.current = { x: 0, y: 0 };
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const nextView = fitLiveWorkspaceCanvas(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      { width: deviceFrame.frameWidth, height: deviceFrame.frameHeight }
    );
    scaleRef.current = nextView.scale;
    offsetRef.current = nextView.offset;
    setScale(nextView.scale);
    setOffset(nextView.offset);
  }, [deviceFrame.frameHeight, deviceFrame.frameWidth, mode]);
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
      setOffset((current) => constrainOffsetRef.current(current, scaleRef.current));
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
    drag.current = null;
    setIsDragging(false);
    viewChanged.current = false;
    temporaryView.current = null;
    const frame = window.requestAnimationFrame(() => fitRef.current());
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (!resetKey) return;
    setOffset((current) => constrainOffset(current, scaleRef.current));
  }, [constrainOffset, resetKey]);

  const changeScale = (nextScale: number) => {
    viewChanged.current = true;
    const boundedScale = Math.min(maximumCanvasScale, Math.max(minimumCanvasScale, nextScale));
    scaleRef.current = boundedScale;
    setScale(boundedScale);
    setOffset((current) => constrainOffset(current, boundedScale));
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!canvasModeAllowsViewportNavigation(mode)) return;
    event.preventDefault();
    viewChanged.current = true;
    const bounds = canvas.current?.getBoundingClientRect();
    if (!bounds) return;
    const deltaPixels =
      event.deltaY *
      (event.deltaMode === globalThis.WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === globalThis.WheelEvent.DOM_DELTA_PAGE
          ? bounds.height
          : 1);
    const currentScale = scaleRef.current;
    const nextScale = Math.min(
      maximumCanvasScale,
      Math.max(minimumCanvasScale, currentScale * Math.exp(-deltaPixels * 0.0025))
    );
    if (nextScale === currentScale) return;
    scaleRef.current = nextScale;
    setScale(nextScale);
    setOffset((current) =>
      constrainOffset(
        canvasOffsetForZoom(
          current,
          { width: bounds.width, height: bounds.height },
          { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
          currentScale,
          nextScale
        ),
        nextScale
      )
    );
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
    setOffset(
      constrainOffset(
        {
          x: currentDrag.offsetX + event.clientX - currentDrag.startX,
          y: currentDrag.offsetY + event.clientY - currentDrag.startY
        },
        scaleRef.current
      )
    );
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    scaleRef.current = previous.scale;
    offsetRef.current = previous.offset;
    viewChanged.current = previous.viewChanged;
    setScale(previous.scale);
    setOffset(previous.offset);
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
