import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { liveSimulatorDeviceFrame } from '../../src/business/canvas-controls';
import { LiveSimulatorWorkspaceCanvas } from '../../src/business/live-session/simulator-workspace-canvas';

const deviceFrame = liveSimulatorDeviceFrame({
  deviceHeight: 844,
  deviceName: 'iPhone',
  deviceWidth: 390,
  orientation: 'portrait'
});

describe('live Simulator workspace canvas', () => {
  test('owns device controls and accessibility presentation', () => {
    const markup = renderToStaticMarkup(
      <LiveSimulatorWorkspaceCanvas
        annotation={{
          captureImage: async () => 'image',
          onCancel: () => undefined,
          onFinish: async () => undefined
        }}
        appearance="dark"
        canvasOffset={{ x: 0, y: 0 }}
        canvasScale={1}
        deviceFrame={deviceFrame}
        deviceHeight={844}
        deviceName="iPhone"
        deviceWidth={390}
        mode="select"
        onChangeAppearance={() => undefined}
        onHome={() => undefined}
        onRotateLeft={() => undefined}
        onRotateRight={() => undefined}
        orientation="portrait"
        selection={{
          elements: [
            {
              frame: { height: 100, width: 100, x: 10, y: 20 },
              id: 'button',
              isContainer: false,
              path: '/button'
            }
          ],
          screen: { height: 844, width: 390 },
          selectedPath: '/button'
        }}
        streamUrl="/stream"
      />
    );

    expect(markup).toContain('class="device-cluster canvas-mode-interact"');
    expect(markup).toContain('class="device-controls"');
    expect(markup).toMatch(/class="ax-element-box\s+selected"/);
    expect(markup).toContain('iPhone interactive screen');
  });

  test('keeps the Desktop annotation workbench as the shared annotation presentation', () => {
    const markup = renderToStaticMarkup(
      <LiveSimulatorWorkspaceCanvas
        annotation={{
          captureImage: async () => 'image',
          onCancel: () => undefined,
          onFinish: async () => undefined
        }}
        appearance="light"
        canvasOffset={{ x: 0, y: 0 }}
        canvasScale={1}
        deviceFrame={deviceFrame}
        deviceHeight={844}
        deviceName="iPhone"
        deviceWidth={390}
        mode="annotate"
        onChangeAppearance={() => undefined}
        onHome={() => undefined}
        onRotateLeft={() => undefined}
        onRotateRight={() => undefined}
        orientation="portrait"
        streamUrl="/stream"
      />
    );

    expect(markup).toContain('class="canvas-annotation-layer tool-rectangle"');
    expect(markup).toContain('class="canvas-annotation-toolbar"');
    expect(markup).toContain('aria-label="Annotation controls"');
    expect(markup).toContain('aria-label="Drawing tools"');
    expect(markup).toContain('title="Undo (⌘Z)"');
    expect(markup).toContain('title="Redo (⌘⇧Z)"');
    expect(markup).toContain('aria-label="Clear annotations"');
  });
});
