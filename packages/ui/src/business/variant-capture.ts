import type { AccessibilityElement, AccessibilitySnapshot, SimulatorVariantId } from '@monaddesign/simulator';

import { simulatorVariantLabels } from '@monaddesign/simulator';
import {
  captureTargetFramesAreStable,
  captureTargetIsVisible,
  findCaptureTarget
} from '@monaddesign/simulator/accessibility-target';

export interface VariantCaptureClient {
  accessibility: () => Promise<AccessibilitySnapshot>;
  screenshot: () => Promise<{ image: string }>;
}

export interface StableVariantCaptureOptions {
  stableFrameError?: (variant: SimulatorVariantId) => string;
  targetVisibilityError?: (variant: SimulatorVariantId, detail: string) => string;
}

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));

const loadCaptureImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not inspect the captured frame.'));
    image.src = source;
  });

export const capturesAreVisuallyStable = async (left: string, right: string) => {
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

const waitForVisibleCaptureTarget = async (
  client: VariantCaptureClient,
  target: AccessibilityElement,
  variant: SimulatorVariantId,
  options: StableVariantCaptureOptions
) => {
  let previous: AccessibilityElement | undefined;
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
  throw new Error(
    options.targetVisibilityError?.(variant, detail) ??
      `${simulatorVariantLabels[variant]} did not expose the selected target in the visible viewport.${detail}`
  );
};

export const captureStableSimulatorScreen = async (
  client: VariantCaptureClient,
  variant: SimulatorVariantId,
  target?: AccessibilityElement,
  options: StableVariantCaptureOptions = {}
) => {
  if (target) await waitForVisibleCaptureTarget(client, target, variant, options);
  else await wait(700);
  let previous = (await client.screenshot()).image;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(450);
    const current = (await client.screenshot()).image;
    if (await capturesAreVisuallyStable(previous, current)) return current;
    previous = current;
  }

  throw new Error(
    options.stableFrameError?.(variant) ??
      `${simulatorVariantLabels[variant]} did not reach a stable frame. Keep the app on a steady screen and capture again.`
  );
};
