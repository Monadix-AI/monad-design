import type { ReactNode } from 'react';

import { fitCanvasScale, maximumCanvasScale } from '@monaddesign/simulator';

export type CanvasMode = 'annotate' | 'interact' | 'variants';
export const webDeviceControlsReservedHeight = 64;
export const liveWorkspaceInspectorReservedWidth = 380;

export const fitLiveWorkspaceCanvas = (
  viewport: { height: number; width: number },
  device: { height: number; width: number }
) => ({
  offset: {
    x: -liveWorkspaceInspectorReservedWidth / 2,
    y: -webDeviceControlsReservedHeight / 2
  },
  scale: fitCanvasScale(
    viewport,
    { width: device.width, height: device.height + webDeviceControlsReservedHeight },
    {
      horizontalReserve: liveWorkspaceInspectorReservedWidth,
      maximumScale: maximumCanvasScale,
      verticalReserve: 180
    }
  )
});

export function SimulatorDeviceControls({
  appearance,
  appearanceIcon,
  homeIcon,
  isAppearanceChanging = false,
  onChangeAppearance,
  onHome,
  onRotateLeft,
  onRotateRight,
  rotateLeftIcon,
  rotateRightIcon,
  scale
}: {
  appearance: 'light' | 'dark';
  appearanceIcon?: ReactNode;
  homeIcon?: ReactNode;
  isAppearanceChanging?: boolean;
  onChangeAppearance: () => void;
  onHome: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  rotateLeftIcon?: ReactNode;
  rotateRightIcon?: ReactNode;
  scale: number;
}) {
  return (
    <fieldset
      className="device-controls"
      style={{ transform: `translateX(-50%) scale(${1 / scale})` }}
    >
      <legend className="sr-only">Simulator controls</legend>
      <button
        aria-label="Rotate Simulator left"
        onClick={onRotateLeft}
        type="button"
      >
        {rotateLeftIcon}
        <span>Rotate</span>
      </button>
      <button
        onClick={onHome}
        type="button"
      >
        {homeIcon}
        <span>Home</span>
      </button>
      <button
        disabled={isAppearanceChanging}
        onClick={onChangeAppearance}
        type="button"
      >
        {appearanceIcon}
        <span>{appearance === 'dark' ? 'Dark' : 'Light'}</span>
      </button>
      <button
        aria-label="Rotate Simulator right"
        onClick={onRotateRight}
        type="button"
      >
        {rotateRightIcon}
        <span>Rotate</span>
      </button>
    </fieldset>
  );
}

export function CanvasZoomControls({
  fitIcon,
  maximumScale,
  minimumScale,
  mode,
  onFit,
  onZoomIn,
  onZoomOut,
  scale,
  zoomInIcon,
  zoomOutIcon
}: {
  fitIcon?: ReactNode;
  maximumScale: number;
  minimumScale: number;
  mode: CanvasMode;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale: number;
  zoomInIcon?: ReactNode;
  zoomOutIcon?: ReactNode;
}) {
  return (
    <div
      className={`zoom-controls canvas-mode-${mode}`}
      data-canvas-ui
    >
      <button
        aria-label="Zoom out"
        disabled={scale <= minimumScale}
        onClick={onZoomOut}
        type="button"
      >
        {zoomOutIcon ?? '−'}
      </button>
      <output aria-live="polite">{Math.round(scale * 100)}%</output>
      <button
        aria-label="Zoom in"
        disabled={scale >= maximumScale}
        onClick={onZoomIn}
        type="button"
      >
        {zoomInIcon ?? '+'}
      </button>
      <button
        aria-label="Fit Simulator to view"
        className="fit-control"
        onClick={onFit}
        type="button"
      >
        {fitIcon ?? 'Fit'}
      </button>
    </div>
  );
}
