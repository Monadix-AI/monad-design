export type DeviceOrientation = 'portrait' | 'landscape_left' | 'portrait_upside_down' | 'landscape_right';

export type DeviceFrameKind = 'dynamic-island' | 'notch' | 'home-button' | 'tablet' | 'generic';

export type DeviceHardwareKind = 'dynamic-island' | 'notch' | 'home-button' | 'camera';

type Edge = 'top' | 'right' | 'bottom' | 'left';

interface FrameProfile {
  kind: DeviceFrameKind;
  sideInset: number;
  topInset: number;
  bottomInset: number;
  screenRadius: number;
  outerRadius: number;
  hardware: DeviceHardwareKind | null;
}

export interface DeviceFrameMetrics {
  kind: DeviceFrameKind;
  insets: { top: number; right: number; bottom: number; left: number };
  frameWidth: number;
  frameHeight: number;
  screenRadius: number;
  outerRadius: number;
  hardware: {
    kind: DeviceHardwareKind;
    edge: Edge;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface SimulatorDeviceGlyphMetrics {
  kind: DeviceFrameKind;
  width: number;
  height: number;
  outerRadius: number;
  screenRadius: number;
  iosMajorVersion: string;
  artwork: {
    shell: { start: string; middle: string; end: string };
    screen: { base: string; middle: string; bridge: string; end: string; glow: string; bloom: string };
  };
}

const profiles: Record<DeviceFrameKind, FrameProfile> = {
  'dynamic-island': {
    kind: 'dynamic-island',
    sideInset: 0.021,
    topInset: 0.021,
    bottomInset: 0.021,
    screenRadius: 0.142,
    outerRadius: 0.16,
    hardware: 'dynamic-island'
  },
  notch: {
    kind: 'notch',
    sideInset: 0.022,
    topInset: 0.022,
    bottomInset: 0.022,
    screenRadius: 0.115,
    outerRadius: 0.135,
    hardware: 'notch'
  },
  'home-button': {
    kind: 'home-button',
    sideInset: 0.019,
    topInset: 0.132,
    bottomInset: 0.132,
    screenRadius: 0,
    outerRadius: 0.105,
    hardware: 'home-button'
  },
  tablet: {
    kind: 'tablet',
    sideInset: 0.036,
    topInset: 0.036,
    bottomInset: 0.036,
    screenRadius: 0.042,
    outerRadius: 0.066,
    hardware: 'camera'
  },
  generic: {
    kind: 'generic',
    sideInset: 0.024,
    topInset: 0.024,
    bottomInset: 0.024,
    screenRadius: 0.09,
    outerRadius: 0.116,
    hardware: null
  }
};

export const deviceFrameKind = (deviceName: string, screen: { width: number; height: number }): DeviceFrameKind => {
  const name = deviceName.toLowerCase();
  if (name.includes('ipad')) return 'tablet';
  if (/iphone\s+(se|8|7|6)/.test(name)) return 'home-button';
  if (/iphone\s+(x|xs|xr|11|12|13)/.test(name) || /iphone\s+14(?:\s+plus)?$/.test(name)) return 'notch';
  if (/iphone\s+(1[4-9]|[2-9]\d)/.test(name)) return 'dynamic-island';

  const longEdge = Math.max(screen.width, screen.height);
  const shortEdge = Math.max(1, Math.min(screen.width, screen.height));
  return longEdge / shortEdge < 1.7 ? 'tablet' : 'generic';
};

const simulatorScreenArtwork = (iosMajorVersion: string): SimulatorDeviceGlyphMetrics['artwork']['screen'] => {
  if (iosMajorVersion === '18') {
    return {
      base: '#161a72',
      middle: '#336cf1',
      bridge: '#336cf1',
      end: '#ff667e',
      glow: '#ffe268',
      bloom: '#9a4dff'
    };
  }
  if (iosMajorVersion === '17') {
    return {
      base: '#2c134f',
      middle: '#6c42c7',
      bridge: '#6c42c7',
      end: '#f197bd',
      glow: '#f1b4ff',
      bloom: '#5078ff'
    };
  }
  return {
    base: '#11144c',
    middle: '#287ad0',
    bridge: '#c7f1da',
    end: '#f5e2a6',
    glow: '#fff4b7',
    bloom: '#22bbff'
  };
};

export const simulatorDeviceGlyphMetrics = ({
  deviceName,
  runtime,
  screen = deviceName.toLowerCase().includes('ipad') ? { width: 820, height: 1180 } : { width: 390, height: 844 }
}: {
  deviceName: string;
  runtime: string;
  screen?: { width: number; height: number };
}): SimulatorDeviceGlyphMetrics => {
  const shortEdge = Math.min(screen.width, screen.height);
  const longEdge = Math.max(screen.width, screen.height);
  const kind = deviceFrameKind(deviceName, screen);
  const modelScale = /\b(max|plus)\b/i.test(deviceName) ? 1 : /\b(mini|se)\b/i.test(deviceName) ? 0.86 : 0.93;
  const height = (kind === 'tablet' ? 26 : 30) * modelScale;
  const width = height * (shortEdge / longEdge);
  const iosMajorVersion = runtime.match(/iOS\s+(\d+)/i)?.[1] ?? 'current';

  return {
    kind,
    width,
    height,
    outerRadius: width * (kind === 'tablet' ? 0.12 : 0.27),
    screenRadius: width * (kind === 'tablet' ? 0.08 : 0.22),
    iosMajorVersion,
    artwork: {
      shell: { start: '#a4a8af', middle: '#565b63', end: '#9a9ea6' },
      screen: simulatorScreenArtwork(iosMajorVersion)
    }
  };
};

const physicalTopEdge = (orientation: DeviceOrientation): Edge => {
  if (orientation === 'landscape_left') return 'left';
  if (orientation === 'landscape_right') return 'right';
  if (orientation === 'portrait_upside_down') return 'bottom';
  return 'top';
};

const oppositeEdge = (edge: Edge): Edge =>
  edge === 'top' ? 'bottom' : edge === 'bottom' ? 'top' : edge === 'left' ? 'right' : 'left';

const rotateInsets = (
  portrait: { top: number; right: number; bottom: number; left: number },
  orientation: DeviceOrientation
) => {
  if (orientation === 'landscape_left')
    return {
      top: portrait.right,
      right: portrait.bottom,
      bottom: portrait.left,
      left: portrait.top
    };
  if (orientation === 'landscape_right')
    return {
      top: portrait.left,
      right: portrait.top,
      bottom: portrait.right,
      left: portrait.bottom
    };
  if (orientation === 'portrait_upside_down')
    return {
      top: portrait.bottom,
      right: portrait.left,
      bottom: portrait.top,
      left: portrait.right
    };
  return portrait;
};

const hardwareRect = ({
  kind,
  edge,
  shortEdge,
  frameWidth,
  frameHeight,
  insets,
  screenWidth,
  screenHeight
}: {
  kind: DeviceHardwareKind;
  edge: Edge;
  shortEdge: number;
  frameWidth: number;
  frameHeight: number;
  insets: DeviceFrameMetrics['insets'];
  screenWidth: number;
  screenHeight: number;
}) => {
  const long =
    kind === 'dynamic-island'
      ? shortEdge * 0.31
      : kind === 'notch'
        ? shortEdge * 0.52
        : kind === 'home-button'
          ? shortEdge * 0.118
          : shortEdge * 0.018;
  const thickness = kind === 'dynamic-island' ? shortEdge * 0.074 : kind === 'notch' ? shortEdge * 0.083 : long;
  const vertical = edge === 'top' || edge === 'bottom';
  const width = vertical ? long : thickness;
  const height = vertical ? thickness : long;
  const centeredX = (frameWidth - width) / 2;
  const centeredY = (frameHeight - height) / 2;
  const screenInset = kind === 'dynamic-island' ? shortEdge * 0.025 : 0;
  const bezelCentered = (available: number, size: number) => Math.max(1, (available - size) / 2);

  if (edge === 'top')
    return {
      x: centeredX,
      y: kind === 'home-button' || kind === 'camera' ? bezelCentered(insets.top, height) : insets.top + screenInset,
      width,
      height
    };
  if (edge === 'bottom')
    return {
      x: centeredX,
      y:
        kind === 'home-button' || kind === 'camera'
          ? insets.top + screenHeight + bezelCentered(insets.bottom, height)
          : insets.top + screenHeight - screenInset - height,
      width,
      height
    };
  if (edge === 'left')
    return {
      x: kind === 'home-button' || kind === 'camera' ? bezelCentered(insets.left, width) : insets.left + screenInset,
      y: centeredY,
      width,
      height
    };
  return {
    x:
      kind === 'home-button' || kind === 'camera'
        ? insets.left + screenWidth + bezelCentered(insets.right, width)
        : insets.left + screenWidth - screenInset - width,
    y: centeredY,
    width,
    height
  };
};

export const deviceFrameMetrics = ({
  deviceName,
  screenWidth,
  screenHeight,
  orientation
}: {
  deviceName: string;
  screenWidth: number;
  screenHeight: number;
  orientation: DeviceOrientation;
}): DeviceFrameMetrics => {
  const shortEdge = Math.max(1, Math.min(screenWidth, screenHeight));
  const kind = deviceFrameKind(deviceName, {
    width: screenWidth,
    height: screenHeight
  });
  const profile = profiles[kind];
  const side = shortEdge * profile.sideInset;
  const portraitInsets = {
    top: shortEdge * profile.topInset,
    right: side,
    bottom: shortEdge * profile.bottomInset,
    left: side
  };
  const insets = rotateInsets(portraitInsets, orientation);
  const frameWidth = screenWidth + insets.left + insets.right;
  const frameHeight = screenHeight + insets.top + insets.bottom;
  const topEdge = physicalTopEdge(orientation);
  const hardwareKind = profile.hardware;
  const hardwareEdge = hardwareKind === 'home-button' ? oppositeEdge(topEdge) : topEdge;
  const rect = hardwareKind
    ? hardwareRect({
        kind: hardwareKind,
        edge: hardwareEdge,
        shortEdge,
        frameWidth,
        frameHeight,
        insets,
        screenWidth,
        screenHeight
      })
    : null;

  return {
    kind,
    insets,
    frameWidth,
    frameHeight,
    screenRadius: shortEdge * profile.screenRadius,
    outerRadius: shortEdge * profile.outerRadius,
    hardware: hardwareKind && rect ? { kind: hardwareKind, edge: hardwareEdge, ...rect } : null
  };
};
