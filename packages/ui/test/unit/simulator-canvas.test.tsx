import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { liveSimulatorDeviceFrame } from '../../src/business/canvas-controls';
import { SimulatorCanvas } from '../../src/business/simulator-canvas';

const deviceFrame = liveSimulatorDeviceFrame({
  deviceHeight: 844,
  deviceName: 'iPhone',
  deviceWidth: 390,
  orientation: 'portrait'
});

const renderCanvas = (pointer?: { x: number; y: number; pressed: boolean }) =>
  renderToStaticMarkup(
    <SimulatorCanvas
      ariaLabel="Simulator"
      deviceFrame={deviceFrame}
      deviceHeight={844}
      deviceWidth={390}
      orientation="portrait"
      pointer={pointer}
      screenClassName="phone-frame interactive"
      streamUrl="/stream"
    />
  );

const renderLandscapeCanvas = () => {
  const landscapeFrame = liveSimulatorDeviceFrame({
    deviceHeight: 844,
    deviceName: 'iPhone',
    deviceWidth: 390,
    orientation: 'landscape_left'
  });
  return renderToStaticMarkup(
    <SimulatorCanvas
      ariaLabel="Simulator"
      deviceFrame={landscapeFrame}
      deviceHeight={844}
      deviceWidth={390}
      orientation="landscape_left"
      screenClassName="phone-frame interactive"
      streamUrl="/stream"
    />
  );
};

describe('shared Simulator canvas pointer', () => {
  test('keeps the system cursor visible when no simulated pointer is rendered', () => {
    expect(renderCanvas()).not.toContain('simulator-pointer-visible');
  });

  test('hides the system cursor only while the simulated pointer is rendered', () => {
    const markup = renderCanvas({ x: 0.5, y: 0.5, pressed: false });

    expect(markup).toContain('simulator-pointer-visible');
    expect(markup).toContain('simulator-pointer');
  });

  test('swaps the visible stage while keeping the portrait stream layer for landscape rotation', () => {
    const markup = renderLandscapeCanvas();

    expect(markup).toContain('width:844px;height:390px');
    expect(markup).toContain('width:390px;height:844px');
    expect(markup).toContain('rotate(90deg)');
  });
});
