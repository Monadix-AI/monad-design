import { expect, test } from 'bun:test';
import {
  type LiveWorkspaceControllerOptions,
  useLiveWorkspaceController
} from '@monaddesign/client-rtk/use-live-workspace';
import { useSimulatorRuntime } from '@monaddesign/client-rtk/use-simulator-runtime';
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

test('does not attach mouse input to Apple TV', () => {
  let workspace: ReturnType<typeof useLiveWorkspaceController> | undefined;
  function Harness() {
    workspace = useLiveWorkspaceController({
      agentRequest: '',
      captureStableScreen: async () => {
        throw new Error('unused');
      },
      client: null,
      connected: { udid: 'tv', name: 'Apple TV 4K', runtime: 'tvOS 26', state: 'Booted', connected: true },
      connection: { bundleIdentifier: 'example.tv', wsUrl: 'ws://localhost/input' },
      connectionKey: 'tv',
      onError: () => {},
      onRequestChanged: () => {},
      onSessionChanged: () => {},
      selectedPath: null,
      selectionMode: false,
      session: null,
      setSelectedPath: () => {},
      setSelectionMode: () => {}
    });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!workspace) throw new Error('Workspace did not render');
  expect(workspace.simulator.isTelevision).toBe(true);
  expect(workspace.simulator.pointer).toBeNull();
  expect(workspace.simulator.onPointerCancel).toBeUndefined();
  expect(workspace.simulator.onPointerDown).toBeUndefined();
  expect(workspace.simulator.onPointerLeave).toBeUndefined();
  expect(workspace.simulator.onPointerMove).toBeUndefined();
  expect(workspace.simulator.onPointerUp).toBeUndefined();
});

test('attaches selection input to Apple TV without sending touch input', () => {
  let workspace: ReturnType<typeof useLiveWorkspaceController> | undefined;
  function Harness() {
    workspace = useLiveWorkspaceController({
      agentRequest: '',
      captureStableScreen: async () => {
        throw new Error('unused');
      },
      client: null,
      connected: { udid: 'tv', name: 'Apple TV 4K', runtime: 'tvOS 26', state: 'Booted', connected: true },
      connection: { bundleIdentifier: 'example.tv', wsUrl: 'ws://localhost/input' },
      connectionKey: 'tv',
      onError: () => {},
      onRequestChanged: () => {},
      onSessionChanged: () => {},
      selectedPath: null,
      selectionMode: true,
      session: null,
      setSelectedPath: () => {},
      setSelectionMode: () => {}
    });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!workspace) throw new Error('Workspace did not render');
  expect(workspace.simulator.onPointerDown).toBeFunction();
  expect(workspace.simulator.onPointerMove).toBeFunction();
  expect(workspace.simulator.pointer).toBeNull();
});

test('selects a tvOS accessibility element by clicking its landscape frame', () => {
  let runtime: ReturnType<typeof useSimulatorRuntime> | undefined;
  let selectedPath: string | null = null;
  function Harness() {
    runtime = useSimulatorRuntime({
      axSnapshot: {
        screen: { width: 1920, height: 1080 },
        elements: [
          {
            enabled: true,
            frame: { x: 192, y: 108, width: 384, height: 216 },
            id: 'button',
            isContainer: false,
            label: 'Button',
            path: '0.1',
            role: 'button',
            type: 'button',
            value: ''
          }
        ]
      },
      connection: null,
      hasConnectedSimulator: true,
      isSelectionMode: true,
      isTelevision: true,
      onError: () => {},
      onHoveredPathChange: () => {},
      onSelectedPathChange: (next) => {
        selectedPath = typeof next === 'function' ? next(selectedPath) : next;
      },
      runtimeClient: null
    });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!runtime) throw new Error('Simulator runtime did not render');
  runtime.screenImage.current = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  } as HTMLImageElement;
  runtime.handlePointerDown({
    clientX: 20,
    clientY: 20,
    currentTarget: { focus: () => {} }
  } as unknown as Parameters<typeof runtime.handlePointerDown>[0]);
  expect(selectedPath as string | null).toBe('0.1');
});
