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

import { Button } from '../primitives/button';
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
export const televisionRemoteReservedWidth = 134;

export const fitLiveWorkspaceCanvas = (
  viewport: { height: number; width: number },
  device: { height: number; width: number },
  insets: CanvasFitInsets = { top: 190, right: 380, bottom: 80, left: 88 },
  sidecarWidth = 0
) => {
  // Floating controls stay at CSS pixel size, independently of the device zoom.
  const width = Math.max(1, viewport.width - insets.left - insets.right - sidecarWidth);
  const controlsHeight = sidecarWidth ? 0 : webDeviceControlsReservedHeight;
  const height = Math.max(1, viewport.height - insets.top - insets.bottom - controlsHeight);
  return {
    offset: {
      x: (insets.left - insets.right - sidecarWidth) / 2,
      y: (insets.top - insets.bottom - controlsHeight) / 2
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
  isTelevision = false,
  orientation
}: {
  deviceChrome?: LiveSimulatorDeviceChrome;
  deviceHeight: number;
  deviceName: string;
  deviceWidth: number;
  isTelevision?: boolean;
  orientation: SimulatorOrientation;
}) => {
  const fallback = deviceFrameMetrics({
    deviceName,
    screenWidth: orientation === 'landscape_left' || orientation === 'landscape_right' ? deviceHeight : deviceWidth,
    screenHeight: orientation === 'landscape_left' || orientation === 'landscape_right' ? deviceWidth : deviceHeight,
    orientation
  });
  if (isTelevision) {
    const bezel = Math.max(8, Math.min(deviceWidth, deviceHeight) * 0.012);
    return {
      ...fallback,
      insets: { top: bezel, right: bezel, bottom: bezel, left: bezel },
      frameWidth: deviceWidth + bezel * 2,
      frameHeight: deviceHeight + bezel * 2,
      screenRadius: 0,
      outerRadius: 0,
      hardware: null
    };
  }
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
  supportsAppearance = true,
  supportsRotation = true,
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
  supportsAppearance?: boolean;
  supportsRotation?: boolean;
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
      data-canvas-ui
      style={{ top: `calc(100% + ${canvasFitGap / scale}px)`, transform: `translateX(-50%) scale(${1 / scale})` }}
    >
      <legend className="sr-only">Simulator controls</legend>
      {supportsRotation ? (
        <Button
          aria-label="Rotate Simulator left"
          disabled={disabled}
          onClick={onRotateLeft}
          type="button"
          variant="ghost"
        >
          {rotateLeftIcon ?? <ActionIcon icon={RotateCcwIcon} />}
          <span>Rotate</span>
        </Button>
      ) : null}
      <Button
        disabled={disabled}
        onClick={onHome}
        type="button"
        variant="ghost"
      >
        {homeIcon ?? <ActionIcon icon={Home01Icon} />}
        <span>Home</span>
      </Button>
      {supportsAppearance ? (
        <Button
          disabled={disabled || isAppearanceChanging}
          onClick={onChangeAppearance}
          type="button"
          variant="ghost"
        >
          {appearanceIcon ?? <ActionIcon icon={appearance === 'dark' ? Moon02Icon : Sun03Icon} />}
          <span>{appearance === 'dark' ? 'Dark' : 'Light'}</span>
        </Button>
      ) : null}
      {supportsRotation ? (
        <Button
          aria-label="Rotate Simulator right"
          disabled={disabled}
          onClick={onRotateRight}
          type="button"
          variant="ghost"
        >
          {rotateRightIcon ?? <ActionIcon icon={RotateCwIcon} />}
          <span>Rotate</span>
        </Button>
      ) : null}
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
      <Button
        aria-label="Zoom out"
        disabled={scale <= minimumScale}
        onClick={onZoomOut}
        size="icon"
        type="button"
        variant="ghost"
      >
        {zoomOutIcon ?? <ActionIcon icon={ZoomOutIcon} />}
      </Button>
      <output aria-live="polite">{Math.round(scale * 100)}%</output>
      <Button
        aria-label="Zoom in"
        disabled={scale >= maximumScale}
        onClick={onZoomIn}
        size="icon"
        type="button"
        variant="ghost"
      >
        {zoomInIcon ?? <ActionIcon icon={ZoomInIcon} />}
      </Button>
      <Button
        aria-label="Fit Simulator to view"
        className="fit-control"
        onClick={onFit}
        size="icon"
        type="button"
        variant="ghost"
      >
        {fitIcon ?? <ActionIcon icon={FitToScreenIcon} />}
      </Button>
    </div>
  );
}
