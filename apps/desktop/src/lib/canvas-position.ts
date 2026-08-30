export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasOffset {
  x: number;
  y: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

const minimumVisibleCanvasContent = 96;

const axisLimit = (viewportSize: number, contentSize: number, minimumVisible: number) => {
  const visibleContent = Math.min(minimumVisible, contentSize);
  return Math.max(0, (viewportSize + contentSize) / 2 - visibleContent);
};

export const clampCanvasOffset = (
  offset: CanvasOffset,
  viewport: CanvasSize,
  content: CanvasSize,
  minimumVisible = minimumVisibleCanvasContent
): CanvasOffset => {
  const xLimit = axisLimit(viewport.width, content.width, minimumVisible);
  const yLimit = axisLimit(viewport.height, content.height, minimumVisible);
  return {
    x: Math.min(xLimit, Math.max(-xLimit, offset.x)),
    y: Math.min(yLimit, Math.max(-yLimit, offset.y))
  };
};

export const canvasOffsetForZoom = (
  offset: CanvasOffset,
  viewport: CanvasSize,
  anchor: CanvasPoint,
  currentScale: number,
  nextScale: number
): CanvasOffset => {
  if (currentScale <= 0 || nextScale <= 0) return offset;
  const scaleRatio = nextScale / currentScale;
  const anchorFromCenter = {
    x: anchor.x - viewport.width / 2,
    y: anchor.y - viewport.height / 2
  };
  return {
    x: anchorFromCenter.x - (anchorFromCenter.x - offset.x) * scaleRatio,
    y: anchorFromCenter.y - (anchorFromCenter.y - offset.y) * scaleRatio
  };
};
