import type { AccessibilityElement, AccessibilitySnapshot } from '@monaddesign/simulator';

const frameDistance = (left: AccessibilityElement, right: AccessibilityElement) =>
  Math.abs(left.frame.x - right.frame.x) +
  Math.abs(left.frame.y - right.frame.y) +
  Math.abs(left.frame.width - right.frame.width) +
  Math.abs(left.frame.height - right.frame.height);

const semanticMatchScore = (candidate: AccessibilityElement, target: AccessibilityElement) => {
  let score = 0;
  if (target.label && candidate.label === target.label) score += 4;
  if (target.value && candidate.value === target.value) score += 2;
  if (target.role && candidate.role === target.role) score += 1;
  if (target.type && candidate.type === target.type) score += 1;
  if (candidate.path === target.path) score += 2;
  return score;
};

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

export const findCaptureTarget = (snapshot: AccessibilitySnapshot, target: AccessibilityElement) => {
  const stableAccessibilityId = target.id && target.id !== target.path;
  if (stableAccessibilityId) {
    const exact = snapshot.elements.find(({ id }) => id === target.id);
    if (exact) return exact;
  }

  return snapshot.elements
    .map((candidate) => ({ candidate, score: semanticMatchScore(candidate, target) }))
    .filter(({ score }) => score >= 4)
    .sort(
      (left, right) =>
        right.score - left.score || frameDistance(left.candidate, target) - frameDistance(right.candidate, target)
    )[0]?.candidate;
};

export const captureTargetIsVisible = (snapshot: AccessibilitySnapshot, element: AccessibilityElement) => {
  const { frame } = element;
  if (frame.width <= 0 || frame.height <= 0) return false;
  const intersectionWidth = Math.max(0, Math.min(frame.x + frame.width, snapshot.screen.width) - Math.max(frame.x, 0));
  const intersectionHeight = Math.max(
    0,
    Math.min(frame.y + frame.height, snapshot.screen.height) - Math.max(frame.y, 0)
  );
  const visibleArea = intersectionWidth * intersectionHeight;
  const comparableArea = Math.min(frame.width * frame.height, snapshot.screen.width * snapshot.screen.height);
  return comparableArea > 0 && visibleArea / comparableArea >= 0.6;
};

export const captureTargetFramesAreStable = (left: AccessibilityElement, right: AccessibilityElement) =>
  frameDistance(left, right) <= 2;
