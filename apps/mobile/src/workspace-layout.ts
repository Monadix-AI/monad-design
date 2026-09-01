import type { IOSSimulator } from '@monaddesign/client-contract';
import type { SimulatorOrientation } from '@monaddesign/simulator';

type DeviceChrome = NonNullable<IOSSimulator['deviceChrome']>;

import { deviceFrameMetrics } from '@monaddesign/device-frame';

const canvasHorizontalPadding = 48;
const canvasVerticalPadding = 120;
const deviceControlsHeight = 68;
const preferredLongEdge = 600;

export const simulatorMaskGeometry = ({
  frame,
  orientation
}: {
  frame: { width: number; height: number };
  orientation: SimulatorOrientation;
}) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  return {
    width: landscape ? frame.height : frame.width,
    height: landscape ? frame.width : frame.height,
    rotation:
      orientation === 'landscape_left'
        ? ('90deg' as const)
        : orientation === 'landscape_right'
          ? ('-90deg' as const)
          : orientation === 'portrait_upside_down'
            ? ('180deg' as const)
            : ('0deg' as const)
  };
};

const orientedInsets = (insets: DeviceChrome['insets'], orientation: SimulatorOrientation) => {
  if (orientation === 'landscape_left') {
    return { top: insets.right, right: insets.bottom, bottom: insets.left, left: insets.top };
  }
  if (orientation === 'landscape_right') {
    return { top: insets.left, right: insets.top, bottom: insets.right, left: insets.bottom };
  }
  if (orientation === 'portrait_upside_down') {
    return { top: insets.bottom, right: insets.left, bottom: insets.top, left: insets.right };
  }
  return insets;
};

export const simulatorChromeLayout = ({
  chrome,
  screenFrame,
  orientation
}: {
  chrome: DeviceChrome;
  screenFrame: { width: number; height: number };
  orientation: SimulatorOrientation;
}) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const scale = screenFrame.width / (landscape ? chrome.screen.height : chrome.screen.width);
  const insets = orientedInsets(
    {
      top: chrome.insets.top * scale,
      right: chrome.insets.right * scale,
      bottom: chrome.insets.bottom * scale,
      left: chrome.insets.left * scale
    },
    orientation
  );
  const portraitCenter = {
    x: (chrome.body.x + chrome.body.width / 2) * scale,
    y: (chrome.body.y + chrome.body.height / 2) * scale
  };
  const portraitFrame = {
    width: chrome.frame.width * scale,
    height: chrome.frame.height * scale
  };
  const bodyCenter =
    orientation === 'landscape_left'
      ? { x: portraitFrame.height - portraitCenter.y, y: portraitCenter.x }
      : orientation === 'landscape_right'
        ? { x: portraitCenter.y, y: portraitFrame.width - portraitCenter.x }
        : orientation === 'portrait_upside_down'
          ? {
              x: portraitFrame.width - portraitCenter.x,
              y: portraitFrame.height - portraitCenter.y
            }
          : portraitCenter;
  const body = {
    width: chrome.body.width * scale,
    height: chrome.body.height * scale
  };

  return {
    frameWidth: landscape ? portraitFrame.height : portraitFrame.width,
    frameHeight: landscape ? portraitFrame.width : portraitFrame.height,
    insets,
    body: {
      left: bodyCenter.x - body.width / 2,
      top: bodyCenter.y - body.height / 2,
      ...body,
      rotation:
        orientation === 'landscape_left'
          ? ('90deg' as const)
          : orientation === 'landscape_right'
            ? ('-90deg' as const)
            : orientation === 'portrait_upside_down'
              ? ('180deg' as const)
              : ('0deg' as const)
    }
  };
};

export const simulatorFrameSize = ({
  screen,
  deviceName,
  orientation,
  viewport,
  scale,
  deviceChrome
}: {
  screen: { width: number; height: number };
  deviceName: string;
  orientation: SimulatorOrientation;
  viewport: { width: number; height: number } | null;
  scale: number;
  deviceChrome?: DeviceChrome;
}) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const shortEdge = Math.max(1, Math.min(screen.width, screen.height));
  const longEdge = Math.max(screen.width, screen.height);
  const portraitAspectRatio = shortEdge / longEdge;
  const preferredSize = landscape
    ? { width: preferredLongEdge, height: preferredLongEdge * portraitAspectRatio }
    : { width: preferredLongEdge * portraitAspectRatio, height: preferredLongEdge };
  const preferredFrame = deviceChrome
    ? simulatorChromeLayout({ chrome: deviceChrome, screenFrame: preferredSize, orientation })
    : deviceFrameMetrics({
        deviceName,
        screenWidth: preferredSize.width,
        screenHeight: preferredSize.height,
        orientation
      });

  if (!viewport) {
    return {
      width: preferredSize.width * scale,
      height: preferredSize.height * scale
    };
  }

  const availableWidth = Math.max(1, viewport.width - canvasHorizontalPadding);
  const availableHeight = Math.max(1, viewport.height - canvasVerticalPadding - deviceControlsHeight);
  const fitScale = Math.min(
    1,
    availableWidth / preferredFrame.frameWidth,
    availableHeight / preferredFrame.frameHeight
  );

  return {
    width: preferredSize.width * fitScale * scale,
    height: preferredSize.height * fitScale * scale
  };
};
