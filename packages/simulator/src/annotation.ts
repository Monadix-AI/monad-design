export type AnnotationTool = 'rectangle' | 'ellipse' | 'text' | 'arrow';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationSize {
  width: number;
  height: number;
}

export interface AnnotationFrame extends AnnotationSize {
  x: number;
  y: number;
}

export interface DrawnAnnotation {
  end: AnnotationPoint;
  id: string;
  note: string;
  start: AnnotationPoint;
  type: Exclude<AnnotationTool, 'text'>;
}

export interface TextAnnotation {
  id: string;
  start: AnnotationPoint;
  text: string;
  type: 'text';
}

export interface FreehandAnnotation {
  id: string;
  points: AnnotationPoint[];
  type: 'freehand';
}

export type Annotation = DrawnAnnotation | TextAnnotation | FreehandAnnotation;
export type ShapeAnnotation = DrawnAnnotation | TextAnnotation;

export const annotationInk = '#ff4d67';
export const annotationId = () =>
  globalThis.crypto?.randomUUID?.() ?? `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const isDrawnAnnotation = (annotation: Annotation): annotation is DrawnAnnotation =>
  annotation.type === 'rectangle' || annotation.type === 'ellipse' || annotation.type === 'arrow';
export const isFreehandAnnotation = (annotation: Annotation): annotation is FreehandAnnotation =>
  annotation.type === 'freehand';
export const annotationIsVisible = (annotation: DrawnAnnotation) =>
  Math.hypot(annotation.end.x - annotation.start.x, annotation.end.y - annotation.start.y) >= 5;
export const freehandIsVisible = (annotation: FreehandAnnotation) => {
  let distance = 0;
  for (let index = 1; index < annotation.points.length; index += 1) {
    const previous = annotation.points[index - 1];
    const point = annotation.points[index];
    if (previous && point) distance += Math.hypot(point.x - previous.x, point.y - previous.y);
  }
  return distance >= 5;
};

export const containAnnotationFrame = (container: AnnotationSize, image: AnnotationSize): AnnotationFrame => {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
};

export const annotationImagePoint = (
  point: AnnotationPoint,
  frame: AnnotationFrame,
  image: AnnotationSize
): AnnotationPoint | null => {
  if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) return null;
  return { x: (point.x / frame.width) * image.width, y: (point.y / frame.height) * image.height };
};

export const calloutAnchor = (annotation: DrawnAnnotation): AnnotationPoint => {
  if (annotation.type === 'arrow') return annotation.start.x > annotation.end.x ? annotation.start : annotation.end;
  return { x: Math.max(annotation.start.x, annotation.end.x), y: (annotation.start.y + annotation.end.y) / 2 };
};

export const calloutBadgeGeometry = (annotation: DrawnAnnotation, image: AnnotationSize, radius: number) => {
  const anchor = calloutAnchor(annotation);
  const other = annotation.type === 'arrow' ? (anchor === annotation.start ? annotation.end : annotation.start) : null;
  const length = other ? Math.hypot(anchor.x - other.x, anchor.y - other.y) : 0;
  const direction =
    other && length > 0 ? { x: (anchor.x - other.x) / length, y: (anchor.y - other.y) / length } : { x: 1, y: 0 };
  const center = {
    x: Math.min(image.width - radius, Math.max(radius, anchor.x + direction.x * radius)),
    y: Math.min(image.height - radius, Math.max(radius, anchor.y + direction.y * radius))
  };
  return {
    anchor,
    center,
    connector: { x: center.x + direction.x * radius, y: center.y + direction.y * radius }
  };
};

export const annotationBounds = (annotation: Annotation): AnnotationFrame => {
  if (annotation.type === 'freehand') {
    const xs = annotation.points.map(({ x }) => x);
    const ys = annotation.points.map(({ y }) => y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  if (annotation.type === 'text') {
    return {
      x: annotation.start.x,
      y: annotation.start.y - 32,
      width: Math.max(60, annotation.text.length * 18),
      height: 42
    };
  }
  const x = Math.min(annotation.start.x, annotation.end.x);
  const y = Math.min(annotation.start.y, annotation.end.y);
  return {
    x,
    y,
    width: Math.abs(annotation.end.x - annotation.start.x),
    height: Math.abs(annotation.end.y - annotation.start.y)
  };
};

const pointToSegmentDistance = (point: AnnotationPoint, start: AnnotationPoint, end: AnnotationPoint) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};

export const annotationContainsPoint = (annotation: Annotation, point: AnnotationPoint, tolerance = 12) => {
  if (annotation.type === 'arrow') return pointToSegmentDistance(point, annotation.start, annotation.end) <= tolerance;
  if (annotation.type === 'freehand') {
    return annotation.points.some((current, index) => {
      const previous = annotation.points[index - 1];
      return previous ? pointToSegmentDistance(point, previous, current) <= tolerance : false;
    });
  }
  const bounds = annotationBounds(annotation);
  if (annotation.type === 'ellipse') {
    const rx = bounds.width / 2 + tolerance;
    const ry = bounds.height / 2 + tolerance;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    return rx > 0 && ry > 0 && ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2 <= 1;
  }
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
};

export const translateAnnotation = <Value extends Annotation>(
  annotation: Value,
  delta: AnnotationPoint,
  image: AnnotationSize
): Value => {
  const bounds = annotationBounds(annotation);
  const dx = Math.min(image.width - bounds.x - bounds.width, Math.max(-bounds.x, delta.x));
  const dy = Math.min(image.height - bounds.y - bounds.height, Math.max(-bounds.y, delta.y));
  if (annotation.type === 'freehand') {
    return { ...annotation, points: annotation.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) } as Value;
  }
  if (annotation.type === 'text') {
    return { ...annotation, start: { x: annotation.start.x + dx, y: annotation.start.y + dy } } as Value;
  }
  return {
    ...annotation,
    start: { x: annotation.start.x + dx, y: annotation.start.y + dy },
    end: { x: annotation.end.x + dx, y: annotation.end.y + dy }
  } as Value;
};

export const annotationArrowHead = (start: AnnotationPoint, end: AnnotationPoint, size: number) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  return [
    { x: end.x - size * Math.cos(angle - Math.PI / 6), y: end.y - size * Math.sin(angle - Math.PI / 6) },
    { x: end.x - size * Math.cos(angle + Math.PI / 6), y: end.y - size * Math.sin(angle + Math.PI / 6) }
  ] as const;
};

const rounded = (value: number, precision?: number) => {
  if (precision === undefined) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const annotationConnectorPath = (
  start: AnnotationPoint,
  end: AnnotationPoint,
  options: { minimumReach?: number; precision?: number } = {}
) => {
  const reach = Math.max(options.minimumReach ?? 54, (end.x - start.x) * 0.42);
  const curveOut = rounded(start.x + reach, options.precision);
  const curveIn = rounded(end.x - reach, options.precision);
  return `M ${start.x} ${start.y} C ${curveOut} ${start.y}, ${curveIn} ${end.y}, ${end.x} ${end.y}`;
};

export const wrapAnnotationText = (text: string, startX: number, image: AnnotationSize) => {
  const fontSize = Math.max(28, image.width * 0.045);
  const availableWidth = Math.max(fontSize * 6, image.width - startX - 12);
  const limit = Math.max(6, Math.floor(availableWidth / (fontSize * 0.58)));
  const characters = Array.from(text);
  return Array.from({ length: Math.ceil(characters.length / limit) }, (_, index) => ({
    id: `characters-${index * limit}`,
    text: characters.slice(index * limit, (index + 1) * limit).join('')
  })).slice(0, 5);
};

export interface CalloutBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface CalloutLayout {
  boxes: CalloutBox[];
  height: number;
  padding: number;
  sidecarLeft: number;
  sidecarWidth: number;
  width: number;
}

export const buildCalloutLayout = (imageSize: AnnotationSize, callouts: DrawnAnnotation[]): CalloutLayout => {
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

export const calloutConnector = (annotation: DrawnAnnotation, box: CalloutBox) => {
  const start = calloutAnchor(annotation);
  const end = { x: box.x - 18, y: box.y + box.height / 2 };
  return { start, end, d: annotationConnectorPath(start, end, { minimumReach: 80 }) };
};
