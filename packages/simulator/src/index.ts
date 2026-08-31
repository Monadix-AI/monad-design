import type { AgentTurnContext, LaunchVariantRequest } from '@monaddesign/client-contract';

export * from './annotation';

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasOffset {
  x: number;
  y: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export type SimulatorOrientation = 'portrait' | 'landscape_left' | 'portrait_upside_down' | 'landscape_right';
export type SimulatorVariantId = LaunchVariantRequest['variant'];

export const simulatorOrientations: SimulatorOrientation[] = [
  'portrait',
  'landscape_left',
  'portrait_upside_down',
  'landscape_right'
];
export const simulatorVariantIds: SimulatorVariantId[] = ['original', 'v1', 'v2', 'v3', 'v4', 'v5'];
export const simulatorVariantLabels: Record<SimulatorVariantId, string> = {
  original: 'Original',
  v1: 'Variant 1',
  v2: 'Variant 2',
  v3: 'Variant 3',
  v4: 'Variant 4',
  v5: 'Variant 5'
};
export const simulatorVariantIdsForCount = (count: number): SimulatorVariantId[] =>
  simulatorVariantIds.slice(0, count + 1);

export const minimumCanvasScale = 0.25;
export const maximumCanvasScale = 2;
export const canvasScaleStep = 0.1;

const minimumVisibleCanvasContent = 96;

const axisLimit = (viewportSize: number, contentSize: number, minimumVisible: number) => {
  const visibleContent = Math.min(minimumVisible, contentSize);
  return Math.max(0, (viewportSize + contentSize) / 2 - visibleContent);
};

export const clampCanvasOffset = (
  offset: CanvasOffset,
  viewport: CanvasSize,
  content: CanvasSize,
  minimumVisible = minimumVisibleCanvasContent
): CanvasOffset => {
  const xLimit = axisLimit(viewport.width, content.width, minimumVisible);
  const yLimit = axisLimit(viewport.height, content.height, minimumVisible);
  return {
    x: Math.min(xLimit, Math.max(-xLimit, offset.x)),
    y: Math.min(yLimit, Math.max(-yLimit, offset.y))
  };
};

export const canvasOffsetForZoom = (
  offset: CanvasOffset,
  viewport: CanvasSize,
  anchor: CanvasPoint,
  currentScale: number,
  nextScale: number
): CanvasOffset => {
  if (currentScale <= 0 || nextScale <= 0) return offset;
  const scaleRatio = nextScale / currentScale;
  const anchorFromCenter = { x: anchor.x - viewport.width / 2, y: anchor.y - viewport.height / 2 };
  return {
    x: anchorFromCenter.x - (anchorFromCenter.x - offset.x) * scaleRatio,
    y: anchorFromCenter.y - (anchorFromCenter.y - offset.y) * scaleRatio
  };
};

export const fitCanvasScale = (
  viewport: CanvasSize,
  content: CanvasSize,
  options: {
    horizontalReserve?: number;
    maximumScale?: number;
    minimumHeight?: number;
    minimumWidth?: number;
    verticalReserve?: number;
  } = {}
) => {
  const availableWidth = Math.max(options.minimumWidth ?? 260, viewport.width - (options.horizontalReserve ?? 0));
  const availableHeight = Math.max(options.minimumHeight ?? 300, viewport.height - (options.verticalReserve ?? 0));
  return Math.min(
    options.maximumScale ?? maximumCanvasScale,
    availableWidth / content.width,
    availableHeight / content.height
  );
};

export const normalizedCanvasPoint = (
  point: CanvasPoint,
  bounds: { height: number; left: number; top: number; width: number }
): CanvasPoint | null => {
  const normalized = { x: (point.x - bounds.left) / bounds.width, y: (point.y - bounds.top) / bounds.height };
  return normalized.x < 0 || normalized.x > 1 || normalized.y < 0 || normalized.y > 1 ? null : normalized;
};

export const orientCanvasPoint = (point: CanvasPoint, orientation: SimulatorOrientation): CanvasPoint => {
  if (orientation === 'landscape_left') return { x: point.y, y: 1 - point.x };
  if (orientation === 'landscape_right') return { x: 1 - point.y, y: point.x };
  if (orientation === 'portrait_upside_down') return { x: 1 - point.x, y: 1 - point.y };
  return point;
};

export const rotatedSimulatorOrientation = (
  current: SimulatorOrientation,
  direction: 'left' | 'right'
): SimulatorOrientation =>
  simulatorOrientations[
    (simulatorOrientations.indexOf(current) + (direction === 'left' ? -1 : 1) + simulatorOrientations.length) %
      simulatorOrientations.length
  ] ?? 'portrait';

export const encodeSimulatorFrame = (tag: number, payload: object) => {
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const value = new Uint8Array(body.length + 1);
  value[0] = tag;
  value.set(body, 1);
  return value;
};

const simulatorKeycodes = {
  ArrowDown: 81,
  ArrowLeft: 80,
  ArrowRight: 79,
  ArrowUp: 82,
  Backquote: 53,
  Backslash: 49,
  Backspace: 42,
  BracketLeft: 47,
  BracketRight: 48,
  Comma: 54,
  Enter: 40,
  Equal: 46,
  Escape: 41,
  MetaLeft: 227,
  MetaRight: 231,
  Minus: 45,
  Period: 55,
  Quote: 52,
  Semicolon: 51,
  ShiftLeft: 225,
  ShiftRight: 229,
  Slash: 56,
  Space: 44,
  Tab: 43
} as const;

export const simulatorKeyUsage = (code: string) => {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3) - 61;
  if (/^Digit[1-9]$/.test(code)) return Number(code.at(-1)) + 29;
  if (code === 'Digit0') return 39;
  return simulatorKeycodes[code as keyof typeof simulatorKeycodes];
};

export interface AccessibilityElement {
  enabled: boolean;
  frame: { height: number; width: number; x: number; y: number };
  id: string;
  isContainer: boolean;
  label: string;
  path: string;
  role: string;
  type: string;
  value: string;
}

export interface AccessibilitySnapshot {
  elements: AccessibilityElement[];
  errors?: string[];
  screen: CanvasSize;
}

export const accessibilityElementName = (element: AccessibilityElement) =>
  element.label || element.value || element.role || element.type || 'Element';

export const accessibilityElementAtPoint = <Element extends AccessibilityElement>(
  snapshot: { elements: Element[]; screen: CanvasSize },
  point: CanvasPoint
) => {
  const x = point.x * snapshot.screen.width;
  const y = point.y * snapshot.screen.height;
  const candidates = snapshot.elements.filter(({ frame }) => {
    return (
      frame.width > 0 &&
      frame.height > 0 &&
      x >= frame.x &&
      x <= frame.x + frame.width &&
      y >= frame.y &&
      y <= frame.y + frame.height
    );
  });
  const bySmallestFrame = (left: Element, right: Element) => {
    const areaDifference = left.frame.width * left.frame.height - right.frame.width * right.frame.height;
    return areaDifference || right.path.split('.').length - left.path.split('.').length;
  };
  const containerAtEdge = candidates
    .filter(({ frame, isContainer }) => {
      if (!isContainer) return false;
      const edgeDistance = Math.min(x - frame.x, frame.x + frame.width - x, y - frame.y, frame.y + frame.height - y);
      return edgeDistance <= 10;
    })
    .sort(bySmallestFrame)[0];
  return containerAtEdge ?? candidates.sort(bySmallestFrame)[0];
};

const accessibilityElementSummary = (element: AccessibilityElement): Record<string, unknown> => ({
  name: accessibilityElementName(element),
  accessibilityId: element.id,
  path: element.path,
  label: element.label || null,
  value: element.value || null,
  role: element.role || null,
  type: element.type || null,
  enabled: element.enabled,
  container: element.isContainer,
  frame: element.frame
});

export const buildAgentTurnContext = ({
  bundleIdentifier,
  element,
  snapshot,
  simulator
}: {
  bundleIdentifier: string;
  element?: AccessibilityElement;
  snapshot?: AccessibilitySnapshot;
  simulator: { name?: string; runtime?: string; udid: string };
}): AgentTurnContext => {
  const context: AgentTurnContext = {
    simulator: { udid: simulator.udid, bundleIdentifier, name: simulator.name, runtime: simulator.runtime }
  };
  if (!snapshot) return context;
  if (!element) {
    return {
      ...context,
      currentScreen: {
        screen: snapshot.screen,
        elements: snapshot.elements.map(accessibilityElementSummary),
        ...(snapshot.errors?.length ? { accessibilityErrors: snapshot.errors } : {})
      }
    };
  }
  const pathParts = element.path.split('.');
  const parentPath = pathParts.slice(0, -1).join('.');
  const ancestors = pathParts
    .slice(0, -1)
    .map((_, index) => pathParts.slice(0, index + 1).join('.'))
    .map((path) => snapshot.elements.find((candidate) => candidate.path === path))
    .filter((candidate): candidate is AccessibilityElement => Boolean(candidate))
    .map(accessibilityElementSummary);
  const nearbySiblings = snapshot.elements
    .filter((candidate) => {
      if (candidate.path === element.path) return false;
      const candidateParts = candidate.path.split('.');
      return candidateParts.length === pathParts.length && candidateParts.slice(0, -1).join('.') === parentPath;
    })
    .slice(0, 8)
    .map(accessibilityElementSummary);
  return {
    ...context,
    selection: {
      screen: snapshot.screen,
      selectedElement: accessibilityElementSummary(element),
      ancestors,
      nearbySiblings,
      ...(snapshot.errors?.length ? { accessibilityErrors: snapshot.errors } : {})
    }
  };
};

export const serializeAgentTurn = (request: string, context: AgentTurnContext) =>
  JSON.stringify({ request: request.trim(), context }, null, 2);
