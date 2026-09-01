import {
  type AnnotationSize,
  annotationArrowHead,
  annotationInk,
  type ShapeAnnotation
} from '@monaddesign/simulator/annotation';

export function AnnotationShape({ annotation, imageSize }: { annotation: ShapeAnnotation; imageSize: AnnotationSize }) {
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
  const head = annotationArrowHead(annotation.start, annotation.end, Math.max(14, imageSize.width * 0.025));
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
