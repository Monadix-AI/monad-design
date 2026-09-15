import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  LiveSimulatorWorkspaceCanvas,
  orientedSimulatorImageSize
} from '../../src/business/live-session/simulator-workspace-canvas';

describe('simulator workspace canvas', () => {
  test.each([
    ['portrait', { height: 844, width: 390 }],
    ['portrait_upside_down', { height: 844, width: 390 }],
    ['landscape_left', { height: 390, width: 844 }],
    ['landscape_right', { height: 390, width: 844 }]
  ] as const)('uses the oriented annotation coordinate space for %s', (orientation, expected) => {
    expect(orientedSimulatorImageSize(orientation, { deviceHeight: 844, deviceWidth: 390 })).toEqual(expected);
  });

  test('draws a tvOS selection frame over its landscape screen', () => {
    const markup = renderToStaticMarkup(
      <LiveSimulatorWorkspaceCanvas
        annotation={{ captureImage: async () => '', onCancel: () => {}, onFinish: async () => {} }}
        appearance="light"
        canvasOffset={{ x: 0, y: 0 }}
        canvasScale={1}
        deviceFrame={{
          frameHeight: 1080,
          frameWidth: 1920,
          hardware: null,
          insets: { bottom: 0, left: 0, right: 0, top: 0 },
          kind: 'dynamic-island',
          outerRadius: 0,
          screenRadius: 0
        }}
        deviceHeight={1080}
        deviceName="Apple TV"
        deviceWidth={1920}
        isTelevision
        mode="select"
        onChangeAppearance={() => {}}
        onHome={() => {}}
        onRotateLeft={() => {}}
        onRotateRight={() => {}}
        orientation="portrait"
        selection={{
          elements: [
            { frame: { x: 192, y: 108, width: 384, height: 216 }, id: 'button', isContainer: false, path: '0.1' }
          ],
          screen: { width: 1920, height: 1080 },
          selectedPath: '0.1'
        }}
        streamUrl="/simulator-stream"
      />
    );

    expect(markup).toContain('class="ax-element-box selected"');
    expect(markup).toContain('left:10%;top:10%;width:20%;height:20%');
    expect(markup).not.toContain('Preparing selection');
  });

  test('keeps a full-screen tvOS container free of the page container width limit', () => {
    const markup = renderToStaticMarkup(
      <LiveSimulatorWorkspaceCanvas
        annotation={{ captureImage: async () => '', onCancel: () => {}, onFinish: async () => {} }}
        appearance="light"
        canvasOffset={{ x: 0, y: 0 }}
        canvasScale={1}
        deviceFrame={{
          frameHeight: 1080,
          frameWidth: 1920,
          hardware: null,
          insets: { bottom: 0, left: 0, right: 0, top: 0 },
          kind: 'dynamic-island',
          outerRadius: 0,
          screenRadius: 0
        }}
        deviceHeight={1080}
        deviceName="Apple TV"
        deviceWidth={1920}
        isTelevision
        mode="select"
        onChangeAppearance={() => {}}
        onHome={() => {}}
        onRotateLeft={() => {}}
        onRotateRight={() => {}}
        orientation="portrait"
        selection={{
          elements: [{ frame: { x: 0, y: 0, width: 1920, height: 1080 }, id: 'app', isContainer: true, path: '0' }],
          screen: { width: 1920, height: 1080 },
          selectedPath: '0'
        }}
        streamUrl="/simulator-stream"
      />
    );

    expect(markup).toContain('class="ax-element-box ax-container selected"');
    expect(markup).toContain('left:0%;top:0%;width:100%;height:100%');
  });
});
