import type { ClientApi } from '@monaddesign/client-rtk';
import type { AXElement, AXSnapshot, SimulatorVariantId } from '../electron';

import { variantLabels } from '../desktop-model';

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));

const frameDistance = (left: AXElement, right: AXElement) =>
  Math.abs(left.frame.x - right.frame.x) +
  Math.abs(left.frame.y - right.frame.y) +
  Math.abs(left.frame.width - right.frame.width) +
  Math.abs(left.frame.height - right.frame.height);

const semanticMatchScore = (candidate: AXElement, target: AXElement) => {
  let score = 0;
  if (target.label && candidate.label === target.label) score += 4;
  if (target.value && candidate.value === target.value) score += 2;
  if (target.role && candidate.role === target.role) score += 1;
  if (target.type && candidate.type === target.type) score += 1;
  if (candidate.path === target.path) score += 2;
  return score;
};

export const findCaptureTarget = (snapshot: AXSnapshot, target: AXElement) => {
  const stableAccessibilityId = target.id && target.id !== target.path;
  if (stableAccessibilityId) {
    const exact = snapshot.elements.find(({ id }) => id === target.id);
    if (exact) return exact;
  }

  return snapshot.elements
    .map((candidate) => ({
      candidate,
      score: semanticMatchScore(candidate, target)
    }))
    .filter(({ score }) => score >= 4)
    .sort(
      (left, right) =>
        right.score - left.score || frameDistance(left.candidate, target) - frameDistance(right.candidate, target)
    )[0]?.candidate;
};

export const captureTargetIsVisible = (snapshot: AXSnapshot, element: AXElement) => {
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

export const captureTargetFramesAreStable = (left: AXElement, right: AXElement) => frameDistance(left, right) <= 2;

const waitForVisibleCaptureTarget = async (client: ClientApi, target: AXElement, variant: SimulatorVariantId) => {
  let previous: AXElement | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    try {
      const snapshot = await client.accessibility();
      const current = findCaptureTarget(snapshot, target);
      if (
        current &&
        captureTargetIsVisible(snapshot, current) &&
        previous &&
        captureTargetFramesAreStable(previous, current)
      ) {
        return;
      }
      previous = current && captureTargetIsVisible(snapshot, current) ? current : undefined;
      lastError = undefined;
    } catch (error) {
      previous = undefined;
      lastError = error;
    }
    await wait(250);
  }

  const detail = lastError instanceof Error ? ` ${lastError.message}` : '';
  throw new Error(`${variantLabels[variant]} did not expose the selected target in the visible viewport.${detail}`);
};

const loadCaptureImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not inspect the captured frame.'));
    image.src = source;
  });

const capturesAreVisuallyStable = async (left: string, right: string) => {
  const [leftImage, rightImage] = await Promise.all([loadCaptureImage(left), loadCaptureImage(right)]);
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 96;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not compare the captured frames.');

  context.drawImage(leftImage, 0, 0, canvas.width, canvas.height);
  const leftPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(rightImage, 0, 0, canvas.width, canvas.height);
  const rightPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  let difference = 0;
  for (let index = 0; index < leftPixels.length; index += 4) {
    difference += Math.abs((leftPixels[index] ?? 0) - (rightPixels[index] ?? 0));
    difference += Math.abs((leftPixels[index + 1] ?? 0) - (rightPixels[index + 1] ?? 0));
    difference += Math.abs((leftPixels[index + 2] ?? 0) - (rightPixels[index + 2] ?? 0));
  }

  return difference / (canvas.width * canvas.height * 3) < 1.5;
};

export const captureStableSimulatorScreen = async (
  client: ClientApi,
  variant: SimulatorVariantId,
  target?: AXElement
) => {
  if (target) await waitForVisibleCaptureTarget(client, target, variant);
  else await wait(700);
  let previous = (await client.screenshot()).image;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(450);
    const current = (await client.screenshot()).image;
    if (await capturesAreVisuallyStable(previous, current)) return current;
    previous = current;
  }

  throw new Error(
    `${variantLabels[variant]} did not reach a stable frame. Keep the app on a steady screen and capture again.`
  );
};
