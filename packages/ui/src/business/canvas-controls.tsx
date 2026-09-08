import type { SimulatorOrientation } from '@monaddesign/simulator';
import type { ReactNode } from 'react';

import {
  FitToScreenIcon,
  Home01Icon,
  Moon02Icon,
  RotateCcwIcon,
  RotateCwIcon,
  Sun03Icon,
  ZoomInIcon,
  ZoomOutIcon
} from '@hugeicons/core-free-icons';
import { deviceFrameMetrics } from '@monaddesign/device-frame';

import { ActionIcon } from './action-icon';

export type CanvasMode = 'annotate' | 'interact' | 'variants';
export const webDeviceControlsReservedHeight = 76;
export const liveWorkspaceInspectorReservedWidth = 380;

export const canvasModeShowsSelectionOverlay = (mode: CanvasMode, selectionMode: boolean) =>
  mode === 'interact' && selectionMode;

export interface CanvasFitInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const canvasFitGap = 24;

export const fitLiveWorkspaceCanvas = (
  viewport: { height: number; width: number },
  device: { height: number; width: number },
  insets: CanvasFitInsets = { top: 190, right: 380, bottom: 80, left: 88 }
) => {
  // Floating controls stay at CSS pixel size, independently of the device zoom.
  const width = Math.max(1, viewport.width - insets.left - insets.right);
  const height = Math.max(1, viewport.height - insets.top - insets.bottom - webDeviceControlsReservedHeight);
  return {
    offset: {
      x: (insets.left - insets.right) / 2,
      y: (insets.top - insets.bottom - webDeviceControlsReservedHeight) / 2
    },
    scale: Math.min(1, width / device.width, height / device.height)
  };
};

export const liveWorkspaceCanvasPlacement = (mode: CanvasMode) => ({
  left: mode === 'variants' ? '18%' : '50%',
  scale: mode === 'variants' ? 0.56 : 1
});

export interface LiveSimulatorDeviceChrome {
  frame: { height: number; width: number };
  insets: { bottom: number; left: number; right: number; top: number };
  screen: { height: number; width: number; x: number; y: number };
}

const orientedInsets = (portrait: LiveSimulatorDeviceChrome['insets'], orientation: SimulatorOrientation) => {
  if (orientation === 'landscape_left') {
    return { top: portrait.right, right: portrait.bottom, bottom: portrait.left, left: portrait.top };
  }
  if (orientation === 'landscape_right') {
    return { top: portrait.left, right: portrait.top, bottom: portrait.right, left: portrait.bottom };
  }
  if (orientation === 'portrait_upside_down') {
    return { top: portrait.bottom, right: portrait.left, bottom: portrait.top, left: portrait.right };
  }
  return portrait;
};

export const liveSimulatorDeviceFrame = ({
  deviceChrome,
  deviceHeight,
  deviceName,
  deviceWidth,
  orientation
}: {
  deviceChrome?: LiveSimulatorDeviceChrome;
  deviceHeight: number;
  deviceName: string;
  deviceWidth: number;
  orientation: SimulatorOrientation;
}) => {
  const fallback = deviceFrameMetrics({
    deviceName,
    screenWidth: orientation === 'landscape_left' || orientation === 'landscape_right' ? deviceHeight : deviceWidth,
    screenHeight: orientation === 'landscape_left' || orientation === 'landscape_right' ? deviceWidth : deviceHeight,
    orientation
  });
  if (!deviceChrome) return fallback;

  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const orientedScreenWidth = landscape ? deviceHeight : deviceWidth;
  const chromeScreenWidth = landscape ? deviceChrome.screen.height : deviceChrome.screen.width;
  const chromeScale = orientedScreenWidth / chromeScreenWidth;
  return {
    ...fallback,
    insets: orientedInsets(
      {
        top: deviceChrome.insets.top * chromeScale,
        right: deviceChrome.insets.right * chromeScale,
        bottom: deviceChrome.insets.bottom * chromeScale,
        left: deviceChrome.insets.left * chromeScale
      },
      orientation
    ),
    frameWidth: (landscape ? deviceChrome.frame.height : deviceChrome.frame.width) * chromeScale,
    frameHeight: (landscape ? deviceChrome.frame.width : deviceChrome.frame.height) * chromeScale
  };
};

export function SimulatorDeviceControls({
  appearance,
  appearanceIcon,
  homeIcon,
  isAppearanceChanging = false,
  disabled = false,
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
  disabled?: boolean;
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
      style={{ top: `calc(100% + ${canvasFitGap / scale}px)`, transform: `translateX(-50%) scale(${1 / scale})` }}
    >
      <legend className="sr-only">Simulator controls</legend>
      <button
        aria-label="Rotate Simulator left"
        disabled={disabled}
        onClick={onRotateLeft}
        type="button"
      >
        {rotateLeftIcon ?? <ActionIcon icon={RotateCcwIcon} />}
        <span>Rotate</span>
      </button>
      <button
        disabled={disabled}
        onClick={onHome}
        type="button"
      >
        {homeIcon ?? <ActionIcon icon={Home01Icon} />}
        <span>Home</span>
      </button>
      <button
        disabled={disabled || isAppearanceChanging}
        onClick={onChangeAppearance}
        type="button"
      >
        {appearanceIcon ?? <ActionIcon icon={appearance === 'dark' ? Moon02Icon : Sun03Icon} />}
        <span>{appearance === 'dark' ? 'Dark' : 'Light'}</span>
      </button>
      <button
        aria-label="Rotate Simulator right"
        disabled={disabled}
        onClick={onRotateRight}
        type="button"
      >
        {rotateRightIcon ?? <ActionIcon icon={RotateCwIcon} />}
        <span>Rotate</span>
      </button>
    </fieldset>
  );
}

export interface CanvasZoomControlsProps {
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
}: CanvasZoomControlsProps) {
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
        {zoomOutIcon ?? <ActionIcon icon={ZoomOutIcon} />}
      </button>
      <output aria-live="polite">{Math.round(scale * 100)}%</output>
      <button
        aria-label="Zoom in"
        disabled={scale >= maximumScale}
        onClick={onZoomIn}
        type="button"
      >
        {zoomInIcon ?? <ActionIcon icon={ZoomInIcon} />}
      </button>
      <button
        aria-label="Fit Simulator to view"
        className="fit-control"
        onClick={onFit}
        type="button"
      >
        {fitIcon ?? <ActionIcon icon={FitToScreenIcon} />}
      </button>
    </div>
  );
}
