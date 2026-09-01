import type { AccessibilityElement } from '@monaddesign/simulator';

export {
  captureTargetFramesAreStable,
  captureTargetIsVisible,
  findCaptureTarget
} from '@monaddesign/simulator/accessibility-target';

const stringValue = (value: unknown) => (typeof value === 'string' ? value : '');

const captureTargetFromSummary = (source?: Record<string, unknown>) => {
  const frame = source?.frame;
  if (!source || !frame || typeof frame !== 'object') return undefined;
  const values = frame as Record<string, unknown>;
  if (![values.x, values.y, values.width, values.height].every((value) => typeof value === 'number')) return undefined;

  return {
    id: stringValue(source.accessibilityId),
    path: stringValue(source.path),
    label: stringValue(source.label),
    value: stringValue(source.value),
    role: stringValue(source.role),
    type: stringValue(source.type),
    enabled: source.enabled !== false,
    isContainer: source.container === true,
    frame: {
      x: values.x as number,
      y: values.y as number,
      width: values.width as number,
      height: values.height as number
    }
  } satisfies AccessibilityElement;
};

export const captureTargetFromSelection = (selection?: { selectedElement: Record<string, unknown> }) =>
  captureTargetFromSummary(selection?.selectedElement);

export const captureTargetFromContext = (context: {
  selection?: { selectedElement: Record<string, unknown> };
  currentScreen?: { screen: { width: number; height: number }; elements: Record<string, unknown>[] };
}) => {
  const selected = captureTargetFromSelection(context.selection);
  if (selected) return selected;
  const currentScreen = context.currentScreen;
  if (!currentScreen) return undefined;
  const center = { x: currentScreen.screen.width / 2, y: currentScreen.screen.height / 2 };
  return currentScreen.elements
    .map(captureTargetFromSummary)
    .filter((element): element is AccessibilityElement => Boolean(element))
    .filter(
      (element) =>
        !element.isContainer &&
        element.frame.width * element.frame.height < currentScreen.screen.width * currentScreen.screen.height * 0.8 &&
        Boolean(element.id || element.label || element.value)
    )
    .sort((left, right) => {
      const leftStableId = left.id && left.id !== left.path ? 1 : 0;
      const rightStableId = right.id && right.id !== right.path ? 1 : 0;
      if (leftStableId !== rightStableId) return rightStableId - leftStableId;
      const centerDistance = (element: AccessibilityElement) =>
        Math.abs(element.frame.x + element.frame.width / 2 - center.x) +
        Math.abs(element.frame.y + element.frame.height / 2 - center.y);
      return centerDistance(left) - centerDistance(right);
    })[0];
};
