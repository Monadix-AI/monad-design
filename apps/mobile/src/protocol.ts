import type { AgentTurnContext } from '@monaddesign/client-rtk';
import type { AXElement, AXSnapshot, IOSSimulator, SimulatorOrientation } from './types';

const orientations: SimulatorOrientation[] = ['portrait', 'landscape_left', 'portrait_upside_down', 'landscape_right'];

export const rotatedOrientation = (current: SimulatorOrientation, direction: 'left' | 'right') =>
  orientations[(orientations.indexOf(current) + (direction === 'left' ? -1 : 1) + 4) % 4] ?? 'portrait';

export const simulatorPoint = (point: { x: number; y: number }, orientation: SimulatorOrientation) =>
  orientation === 'landscape_left'
    ? { x: point.y, y: 1 - point.x }
    : orientation === 'landscape_right'
      ? { x: 1 - point.y, y: point.x }
      : orientation === 'portrait_upside_down'
        ? { x: 1 - point.x, y: 1 - point.y }
        : point;

export const axElementAtPoint = (snapshot: AXSnapshot, point: { x: number; y: number }) => {
  const x = point.x * snapshot.screen.width;
  const y = point.y * snapshot.screen.height;
  return snapshot.elements
    .filter(
      ({ frame }) =>
        frame.width > 0 &&
        frame.height > 0 &&
        x >= frame.x &&
        x <= frame.x + frame.width &&
        y >= frame.y &&
        y <= frame.y + frame.height
    )
    .sort(
      (left, right) =>
        left.frame.width * left.frame.height - right.frame.width * right.frame.height ||
        right.path.split('.').length - left.path.split('.').length
    )[0];
};

const summary = (element: AXElement) => ({
  name: element.label || element.value || element.role || element.type || 'Element',
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
  element?: AXElement;
  snapshot?: AXSnapshot;
  simulator: IOSSimulator;
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
        elements: snapshot.elements.map(summary),
        ...(snapshot.errors?.length ? { accessibilityErrors: snapshot.errors } : {})
      }
    };
  }
  const parts = element.path.split('.');
  const parent = parts.slice(0, -1).join('.');
  const ancestors = parts
    .slice(0, -1)
    .map((_, index) => parts.slice(0, index + 1).join('.'))
    .map((path) => snapshot.elements.find((item) => item.path === path))
    .filter((item): item is AXElement => Boolean(item))
    .map(summary);
  const nearbySiblings = snapshot.elements
    .filter((item) => {
      const candidate = item.path.split('.');
      return (
        item.path !== element.path && candidate.length === parts.length && candidate.slice(0, -1).join('.') === parent
      );
    })
    .slice(0, 8)
    .map(summary);
  return {
    ...context,
    selection: {
      screen: snapshot.screen,
      selectedElement: summary(element),
      ancestors,
      nearbySiblings,
      ...(snapshot.errors?.length ? { accessibilityErrors: snapshot.errors } : {})
    }
  };
};

export const serializeAgentTurn = (request: string, context: AgentTurnContext) =>
  JSON.stringify({ request: request.trim(), context }, null, 2);

export const buildAgentTurnPayload = ({
  bundleIdentifier,
  request,
  element,
  snapshot,
  simulator
}: {
  bundleIdentifier: string;
  request: string;
  element: AXElement;
  snapshot: AXSnapshot;
  simulator: IOSSimulator;
}) => serializeAgentTurn(request, buildAgentTurnContext({ bundleIdentifier, element, snapshot, simulator }));

export const encodeFrame = (tag: number, payload: object) => {
  const json = JSON.stringify(payload);
  const body = new TextEncoder().encode(json);
  const frame = new Uint8Array(body.length + 1);
  frame[0] = tag;
  frame.set(body, 1);
  return frame.buffer;
};
