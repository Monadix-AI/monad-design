import type { Annotation } from '@monaddesign/simulator/annotation';

export interface AnnotationHistory {
  future: Annotation[][];
  past: Annotation[][];
  present: Annotation[];
}

export type AnnotationHistoryAction =
  | { type: 'commit'; next: Annotation[] }
  | { type: 'record'; previous: Annotation[] }
  | { type: 'redo' }
  | { type: 'replace'; next: Annotation[] }
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
