export type AnnotationTool = 'rectangle' | 'ellipse' | 'arrow' | 'text';

export interface Point {
  x: number;
  y: number;
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

export interface FreehandAnnotation {
  id: string;
  type: 'freehand';
  points: Point[];
}

export type Annotation = DrawnAnnotation | TextAnnotation | FreehandAnnotation;
export interface Size {
  width: number;
  height: number;
}
export interface Frame extends Size {
  x: number;
  y: number;
}

export const annotationInk = '#ff4d67';
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
    if (!previous || !point) continue;
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
  }
  return distance >= 5;
};

export const containFrame = (container: Size, image: Size): Frame => {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
};

export const imagePoint = (point: Point, frame: Frame, image: Size): Point | null => {
  if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) return null;
  return {
    x: (point.x / frame.width) * image.width,
    y: (point.y / frame.height) * image.height
  };
};

export const calloutAnchor = (annotation: DrawnAnnotation): Point => {
  if (annotation.type === 'arrow') return annotation.start.x > annotation.end.x ? annotation.start : annotation.end;
  return {
    x: Math.max(annotation.start.x, annotation.end.x),
    y: (annotation.start.y + annotation.end.y) / 2
  };
};

export const calloutConnectorPath = (start: Point, end: Point) => {
  const reach = Math.max(54, (end.x - start.x) * 0.42);
  const curveOut = Math.round((start.x + reach) * 1_000) / 1_000;
  const curveIn = Math.round((end.x - reach) * 1_000) / 1_000;
  return `M ${start.x} ${start.y} C ${curveOut} ${start.y}, ${curveIn} ${end.y}, ${end.x} ${end.y}`;
};

export const arrowHead = (start: Point, end: Point, size: number) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  return [
    {
      x: end.x - size * Math.cos(angle - Math.PI / 6),
      y: end.y - size * Math.sin(angle - Math.PI / 6)
    },
    {
      x: end.x - size * Math.cos(angle + Math.PI / 6),
      y: end.y - size * Math.sin(angle + Math.PI / 6)
    }
  ] as const;
};

export const wrapAnnotationText = (text: string, startX: number, image: Size) => {
  const fontSize = Math.max(28, image.width * 0.045);
  const availableWidth = Math.max(fontSize * 6, image.width - startX - 12);
  const limit = Math.max(6, Math.floor(availableWidth / (fontSize * 0.58)));
  const characters = Array.from(text);
  return Array.from({ length: Math.ceil(characters.length / limit) }, (_, index) => ({
    id: `characters-${index * limit}`,
    text: characters.slice(index * limit, (index + 1) * limit).join('')
  })).slice(0, 5);
};
