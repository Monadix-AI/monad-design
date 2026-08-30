export type AnnotationTool = 'rectangle' | 'ellipse' | 'text' | 'arrow';

export interface Point {
  x: number;
  y: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface DrawnAnnotation {
  id: string;
  type: Exclude<AnnotationTool, 'text'>;
  start: Point;
  end: Point;
  note: string;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  start: Point;
  text: string;
}

export type Annotation = DrawnAnnotation | TextAnnotation;

export const annotationInk = '#ff4d67';
export const annotationId = () => globalThis.crypto?.randomUUID?.() ?? `annotation-${Date.now()}`;
export const isDrawnAnnotation = (annotation: Annotation): annotation is DrawnAnnotation => annotation.type !== 'text';
export const annotationIsVisible = (annotation: DrawnAnnotation) =>
  Math.hypot(annotation.end.x - annotation.start.x, annotation.end.y - annotation.start.y) >= 5;

export const calloutAnchor = (annotation: DrawnAnnotation): Point =>
  annotation.type === 'arrow'
    ? annotation.start.x > annotation.end.x
      ? annotation.start
      : annotation.end
    : { x: Math.max(annotation.start.x, annotation.end.x), y: (annotation.start.y + annotation.end.y) / 2 };

const arrowHead = (start: Point, end: Point, size: number) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  return [
    { x: end.x - size * Math.cos(angle - Math.PI / 6), y: end.y - size * Math.sin(angle - Math.PI / 6) },
    { x: end.x - size * Math.cos(angle + Math.PI / 6), y: end.y - size * Math.sin(angle + Math.PI / 6) }
  ];
};

export interface CalloutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalloutLayout {
  width: number;
  height: number;
  sidecarLeft: number;
  sidecarWidth: number;
  padding: number;
  boxes: CalloutBox[];
}

export const buildCalloutLayout = (imageSize: ImageSize, callouts: DrawnAnnotation[]): CalloutLayout => {
  if (!callouts.length)
    return {
      width: imageSize.width,
      height: imageSize.height,
      sidecarLeft: imageSize.width,
      sidecarWidth: 0,
      padding: 0,
      boxes: []
    };
  const sidecarWidth = Math.max(760, Math.round(imageSize.width * 1.05));
  const padding = Math.max(38, Math.round(imageSize.width * 0.036));
  const listWidth = sidecarWidth - padding * 2;
  const gap = Math.max(22, Math.round(imageSize.width * 0.02));
  const noteFontSize = Math.max(28, imageSize.width * 0.028);
  const characterCapacity = Math.max(18, Math.floor((listWidth - padding * 1.6) / (noteFontSize * 0.58)));
  let y = Math.max(padding + Math.max(122, imageSize.width * 0.12), imageSize.height * 0.18);
  const boxes = callouts.map((callout) => {
    const height = Math.max(
      280,
      Math.ceil(
        110 + Math.max(2, Math.ceil(Array.from(callout.note.trim()).length / characterCapacity)) * noteFontSize * 1.35
      )
    );
    const box = { x: imageSize.width + padding, y, width: listWidth, height };
    y += height + gap;
    return box;
  });
  return {
    width: imageSize.width + sidecarWidth,
    height: Math.max(imageSize.height, y - gap + padding),
    sidecarLeft: imageSize.width,
    sidecarWidth,
    padding,
    boxes
  };
};

export const calloutConnectorPath = (annotation: DrawnAnnotation, box: CalloutBox) => {
  const start = calloutAnchor(annotation);
  const end = { x: box.x - 18, y: box.y + box.height / 2 };
  const reach = Math.max(80, (end.x - start.x) * 0.42);
  return {
    start,
    end,
    d: `M ${start.x} ${start.y} C ${start.x + reach} ${start.y}, ${end.x - reach} ${end.y}, ${end.x} ${end.y}`
  };
};

export function AnnotationShape({ annotation, imageSize }: { annotation: Annotation; imageSize: ImageSize }) {
  const strokeWidth = Math.max(4, imageSize.width * 0.006);
  if (annotation.type === 'text') {
    return (
      <text
        fill={annotationInk}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize={Math.max(28, imageSize.width * 0.045)}
        fontWeight="700"
        paintOrder="stroke"
        stroke="rgb(8 9 11 / 88%)"
        strokeWidth={Math.max(3, strokeWidth * 0.8)}
        x={annotation.start.x}
        y={annotation.start.y}
      >
        {annotation.text}
      </text>
    );
  }
  const left = Math.min(annotation.start.x, annotation.end.x);
  const top = Math.min(annotation.start.y, annotation.end.y);
  const width = Math.abs(annotation.end.x - annotation.start.x);
  const height = Math.abs(annotation.end.y - annotation.start.y);
  const common = { fill: 'rgb(255 77 103 / 8%)', stroke: annotationInk, strokeWidth };
  if (annotation.type === 'rectangle')
    return (
      <rect
        height={height}
        width={width}
        x={left}
        y={top}
        {...common}
      />
    );
  if (annotation.type === 'ellipse')
    return (
      <ellipse
        cx={left + width / 2}
        cy={top + height / 2}
        rx={width / 2}
        ry={height / 2}
        {...common}
      />
    );
  const head = arrowHead(annotation.start, annotation.end, Math.max(14, imageSize.width * 0.025));
  return (
    <g
      fill="none"
      stroke={annotationInk}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      <line
        x1={annotation.start.x}
        x2={annotation.end.x}
        y1={annotation.start.y}
        y2={annotation.end.y}
      />
      <polyline
        points={`${head[0]?.x},${head[0]?.y} ${annotation.end.x},${annotation.end.y} ${head[1]?.x},${head[1]?.y}`}
      />
    </g>
  );
}
