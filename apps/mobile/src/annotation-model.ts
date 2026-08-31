import { annotationConnectorPath } from '@monaddesign/simulator';

export type {
  Annotation,
  AnnotationFrame as Frame,
  AnnotationPoint as Point,
  AnnotationSize as Size,
  AnnotationTool,
  DrawnAnnotation,
  FreehandAnnotation,
  TextAnnotation
} from '@monaddesign/simulator';

export {
  annotationArrowHead as arrowHead,
  annotationBounds,
  annotationContainsPoint,
  annotationId,
  annotationImagePoint as imagePoint,
  annotationInk,
  annotationIsVisible,
  calloutAnchor,
  calloutBadgeGeometry,
  containAnnotationFrame as containFrame,
  freehandIsVisible,
  isDrawnAnnotation,
  isFreehandAnnotation,
  translateAnnotation,
  wrapAnnotationText
} from '@monaddesign/simulator';

export const calloutConnectorPath = (start: { x: number; y: number }, end: { x: number; y: number }) =>
  annotationConnectorPath(start, end, { minimumReach: 54, precision: 3 });
