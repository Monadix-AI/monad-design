import type { AccessibilityElement, AccessibilitySnapshot } from './index';

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

export const findCaptureTarget = <Element extends AccessibilityElement>(
  snapshot: Pick<AccessibilitySnapshot, 'elements'>,
  target: AccessibilityElement
) => {
  const stableAccessibilityId = target.id && target.id !== target.path;
  if (stableAccessibilityId) {
    const exact = snapshot.elements.find(({ id }) => id === target.id);
    if (exact) return exact as Element;
  }

  return snapshot.elements
    .map((candidate) => ({ candidate, score: semanticMatchScore(candidate, target) }))
    .filter(({ score }) => score >= 4)
    .sort(
      (left, right) =>
        right.score - left.score || frameDistance(left.candidate, target) - frameDistance(right.candidate, target)
    )[0]?.candidate as Element | undefined;
};

export const captureTargetIsVisible = (
  snapshot: Pick<AccessibilitySnapshot, 'screen'>,
  element: AccessibilityElement
) => {
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
