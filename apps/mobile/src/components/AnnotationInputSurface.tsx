import { useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  type GestureTouchEvent,
  PointerType,
  useManualGesture
} from 'react-native-gesture-handler';

export type AnnotationInputSample = { pointerId: number; pointerType: string; x: number; y: number };
export type AnnotationInputEvent = {
  phase: 'start' | 'move' | 'end' | 'cancel';
  pointerId: number;
  pointerType: string;
  points: { x: number; y: number }[];
};

/** Native touch recognition supports both direct touch and Apple Pencil without a local Expo module. */
export function AnnotationInputSurface({
  onInput,
  inputEnabled = true,
  ...props
}: ViewProps & {
  onInput: (event: AnnotationInputEvent) => void;
  inputEnabled?: boolean;
}) {
  const callback = useRef(onInput);
  callback.current = onInput;
  const dispatch = (phase: AnnotationInputEvent['phase'], event: GestureTouchEvent) => {
    for (const touch of event.changedTouches) {
      callback.current({
        phase,
        pointerId: touch.id,
        pointerType:
          event.pointerType === PointerType.STYLUS
            ? 'pen'
            : event.pointerType === PointerType.MOUSE
              ? 'mouse'
              : 'touch',
        points: [{ x: touch.x, y: touch.y }]
      });
    }
  };
  const gesture = useManualGesture({
    enabled: inputEnabled,
    runOnJS: true,
    cancelsTouchesInView: false,
    shouldCancelWhenOutside: false,
    onTouchesDown: (event) => {
      GestureStateManager.activate(event.handlerTag);
      dispatch('start', event);
    },
    onTouchesMove: (event) => dispatch('move', event),
    onTouchesUp: (event) => {
      dispatch('end', event);
      if (event.numberOfTouches === 0) GestureStateManager.deactivate(event.handlerTag);
    },
    onTouchesCancel: (event) => {
      dispatch('cancel', event);
      GestureStateManager.fail(event.handlerTag);
    }
  });
  return (
    <GestureDetector gesture={gesture}>
      <View
        {...props}
        collapsable={false}
      />
    </GestureDetector>
  );
}
