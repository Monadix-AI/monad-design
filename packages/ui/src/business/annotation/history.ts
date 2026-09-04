import type { AnnotationSize, ShapeAnnotation } from '@monaddesign/simulator/annotation';

import { isDrawnAnnotation, translateAnnotation } from '@monaddesign/simulator/annotation';

export type AnnotationArrowKey = 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp';

export const transformAnnotationWithKeyboard = ({
  accelerated,
  annotation,
  imageSize,
  key,
  resize
}: {
  accelerated: boolean;
  annotation: ShapeAnnotation;
  imageSize: AnnotationSize;
  key: AnnotationArrowKey;
  resize: boolean;
}): ShapeAnnotation => {
  const step = accelerated ? 10 : 1;
  const delta = {
    x: key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0,
    y: key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0
  };
  if (!resize || !isDrawnAnnotation(annotation)) return translateAnnotation(annotation, delta, imageSize);
  return {
    ...annotation,
    end: {
      x: Math.max(0, Math.min(imageSize.width, annotation.end.x + delta.x)),
      y: Math.max(0, Math.min(imageSize.height, annotation.end.y + delta.y))
    }
  };
};

export interface AnnotationHistory {
  future: ShapeAnnotation[][];
  past: ShapeAnnotation[][];
  present: ShapeAnnotation[];
}

export type AnnotationHistoryAction =
  | { type: 'commit'; next: ShapeAnnotation[] }
  | { type: 'record'; previous: ShapeAnnotation[] }
  | { type: 'redo' }
  | { type: 'replace'; next: ShapeAnnotation[] }
  | { type: 'reset' }
  | { type: 'undo' };

export const initialAnnotationHistory: AnnotationHistory = { future: [], past: [], present: [] };

export const annotationHistoryReducer = (
  state: AnnotationHistory,
  action: AnnotationHistoryAction
): AnnotationHistory => {
  if (action.type === 'reset') return initialAnnotationHistory;
  if (action.type === 'replace') return { ...state, present: action.next };
  if (action.type === 'record') {
    if (action.previous === state.present) return state;
    return { future: [], past: [...state.past, action.previous], present: state.present };
  }
  if (action.type === 'commit') {
    if (action.next === state.present) return state;
    return { future: [], past: [...state.past, state.present], present: action.next };
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { future: [state.present, ...state.future], past: state.past.slice(0, -1), present: previous };
  }
  const next = state.future[0];
  if (!next) return state;
  return { future: state.future.slice(1), past: [...state.past, state.present], present: next };
};
