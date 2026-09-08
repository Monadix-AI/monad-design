import { expect, test } from 'bun:test';
import { type AgentRequestControllerOptions, useAgentRequest } from '@monaddesign/client-rtk/use-agent-request';
import { renderToStaticMarkup } from 'react-dom/server';

const selectedElement = {
  enabled: true,
  frame: { x: 10, y: 20, width: 100, height: 40 },
  id: 'save',
  isContainer: false,
  label: 'Save',
  path: '0.1',
  role: 'button',
  type: 'Button',
  value: ''
};

test('sends selection, annotation image, notes and the request together', async () => {
  let submitted: unknown;
  let send: ReturnType<typeof useAgentRequest>['sendAnnotatedAgentRequest'] | undefined;
  const snapshot = { elements: [selectedElement], screen: { width: 390, height: 844 } };
  const options = {
    activeSession: { id: 'live', status: 'awaiting_request', connection: { bundleIdentifier: 'test.app' } },
    agentRequest: 'Make Save easier to find',
    connected: { udid: 'sim', name: 'iPhone', runtime: 'iOS' },
    connection: { bundleIdentifier: 'test.app' },
    runtimeClient: {
      accessibility: async () => snapshot,
      submitAgentRequest: async (_id: string, payload: unknown) => {
        submitted = payload;
        return { status: 'change_requested' };
      }
    },
    selectedElement,
    snapshot,
    onRequestChanged: () => {},
    onSessionChanged: () => {},
    onSnapshotChanged: () => {}
  } as unknown as AgentRequestControllerOptions;
  function Harness() {
    send = useAgentRequest(options).sendAnnotatedAgentRequest;
    return null;
  }
  renderToStaticMarkup(<Harness />);
  await send?.('data:image/png;base64,annotation', '1. Increase contrast');
  expect(submitted).toMatchObject({
    annotationScreenshot: 'data:image/png;base64,annotation',
    request: 'Make Save easier to find\n\n1. Increase contrast',
    variantCount: 1,
    context: { selection: { selectedElement: { accessibilityId: 'save', path: '0.1' } } }
  });
});
