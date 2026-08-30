import type { AgentTurnContext, AXElement, AXSnapshot, IOSSimulator } from './electron';

const elementName = (element: AXElement) => element.label || element.value || element.role || element.type || 'Element';

const elementSummary = (element: AXElement): Record<string, unknown> => ({
  name: elementName(element),
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
  simulator: Pick<IOSSimulator, 'udid' | 'name' | 'runtime'>;
}): AgentTurnContext => {
  const context: AgentTurnContext = {
    simulator: {
      udid: simulator.udid,
      bundleIdentifier,
      name: simulator.name,
      runtime: simulator.runtime
    }
  };
  if (!snapshot) return context;
  if (!element) {
    return {
      ...context,
      currentScreen: {
        screen: snapshot.screen,
        elements: snapshot.elements.map(elementSummary),
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
    .filter((candidate): candidate is AXElement => Boolean(candidate))
    .map(elementSummary);
  const nearbySiblings = snapshot.elements
    .filter((candidate) => {
      if (candidate.path === element.path) return false;
      const candidateParts = candidate.path.split('.');
      return candidateParts.length === pathParts.length && candidateParts.slice(0, -1).join('.') === parentPath;
    })
    .slice(0, 8)
    .map(elementSummary);

  return {
    ...context,
    selection: {
      screen: snapshot.screen,
      selectedElement: elementSummary(element),
      ancestors,
      nearbySiblings,
      ...(snapshot.errors?.length ? { accessibilityErrors: snapshot.errors } : {})
    }
  };
};

export const serializeAgentTurn = (request: string, context: AgentTurnContext) =>
  JSON.stringify({ request: request.trim(), context }, null, 2);
