import type { PointerEvent, ReactNode, RefObject, WheelEvent } from 'react';

import { useCanvasViewport } from '@monaddesign/ui/business/canvas-viewport';
import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';

import { useDesktopApp } from './desktop-app-provider';
import { workspaceCanvasMode } from './desktop-model';

interface CanvasViewportActions {
  canvas: RefObject<HTMLDivElement | null>;
  changeScale: (scale: number) => void;
  finishPointer: (event: PointerEvent<HTMLDivElement>) => void;
  fit: () => void;
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handleWheel: (event: WheelEvent<HTMLDivElement>) => void;
  markViewUnchanged: () => void;
}

const CanvasViewportActionsContext = createContext<CanvasViewportActions | null>(null);
const CanvasViewportDraggingContext = createContext(false);
const CanvasViewportOffsetContext = createContext({ x: 0, y: 0 });
const CanvasViewportScaleContext = createContext(1);

export function CanvasViewportProvider({ children }: { children: ReactNode }) {
  const { connection, deviceFrame, isAnnotationMode, isVariantPreviewOpen } = useDesktopApp();
  const mode = workspaceCanvasMode(isAnnotationMode, isVariantPreviewOpen);
  const viewport = useCanvasViewport({ deviceFrame, mode, resetKey: connection?.udid });
  const viewportRef = useRef(viewport);
  const annotationWasOpen = useRef(isAnnotationMode);
  viewportRef.current = viewport;

  useLayoutEffect(() => {
    if (isAnnotationMode === annotationWasOpen.current) return;
    annotationWasOpen.current = isAnnotationMode;
    if (isAnnotationMode) {
      viewportRef.current.beginTemporaryView();
    } else {
      viewportRef.current.restoreTemporaryView();
    }
  }, [isAnnotationMode]);

  const actions = useMemo<CanvasViewportActions>(
    () => ({
      canvas: viewport.canvas,
      changeScale: (scale) => viewportRef.current.changeScale(scale),
      finishPointer: (event) => viewportRef.current.finishPointer(event),
      fit: () => viewportRef.current.fit(),
      handlePointerDown: (event) => viewportRef.current.handlePointerDown(event),
      handlePointerMove: (event) => viewportRef.current.handlePointerMove(event),
      handleWheel: (event) => viewportRef.current.handleWheel(event),
      markViewUnchanged: () => {
        viewportRef.current.viewChanged.current = false;
      }
    }),
    [viewport.canvas]
  );

  return (
    <CanvasViewportActionsContext.Provider value={actions}>
      <CanvasViewportDraggingContext.Provider value={viewport.isDragging}>
        <CanvasViewportOffsetContext.Provider value={viewport.offset}>
          <CanvasViewportScaleContext.Provider value={viewport.scale}>{children}</CanvasViewportScaleContext.Provider>
        </CanvasViewportOffsetContext.Provider>
      </CanvasViewportDraggingContext.Provider>
    </CanvasViewportActionsContext.Provider>
  );
}

export const useCanvasViewportActions = () => {
  const context = useContext(CanvasViewportActionsContext);
  if (!context) throw new Error('useCanvasViewportActions must be used inside CanvasViewportProvider.');
  return context;
};

export const useCanvasViewportDragging = () => useContext(CanvasViewportDraggingContext);
export const useCanvasViewportOffset = () => useContext(CanvasViewportOffsetContext);
export const useCanvasViewportScale = () => useContext(CanvasViewportScaleContext);
