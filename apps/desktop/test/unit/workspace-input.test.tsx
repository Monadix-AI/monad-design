import { expect, test } from 'bun:test';
import {
  type LiveWorkspaceControllerOptions,
  useLiveWorkspaceController
} from '@monaddesign/client-rtk/use-live-workspace';
import { renderToStaticMarkup } from 'react-dom/server';

test('accepts mouse input after Connect even when discovery still reports disconnected', () => {
  for (const active of [true, false]) {
    let workspace: ReturnType<typeof useLiveWorkspaceController> | undefined;
    const errors: Array<string | null> = [];
    const options: LiveWorkspaceControllerOptions = {
      agentRequest: '',
      canAutoCapture: false,
      captureStableScreen: async () => {
        throw new Error('unused');
      },
      client: null,
      connected: { udid: 'device', name: 'iPad', runtime: 'iOS', state: 'Booted', connected: false },
      connection: active ? { bundleIdentifier: 'example.app', wsUrl: 'ws://localhost/input' } : null,
      connectionKey: active ? 'device' : null,
      onError: (error) => errors.push(error),
      onRequestChanged: () => {},
      onSessionChanged: () => {},
      selectedPath: null,
      selectionMode: false,
      session: null,
      setSelectedPath: () => {},
      setSelectionMode: () => {}
    };
    function Harness() {
      workspace = useLiveWorkspaceController(options);
      return null;
    }
    renderToStaticMarkup(<Harness />);
    if (!workspace) throw new Error('Workspace did not render');
    const runtime = workspace;
    runtime.screenImage.current = {
      getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 100 })
    } as HTMLImageElement;
    let captured = false;
    runtime.simulator.onPointerDown?.({
      clientX: 50,
      clientY: 50,
      pointerId: 1,
      currentTarget: {
        focus: () => {},
        setPointerCapture: () => {
          captured = true;
        }
      }
    } as unknown as Parameters<NonNullable<typeof runtime.simulator.onPointerDown>>[0]);
    expect(captured).toBe(active);
    // SSR has no socket: reaching sendTouch reports unavailable input instead of silently dropping the mouse event.
    expect(errors).toEqual(active ? ['The simulator input channel is not ready yet.'] : []);
  }
});
