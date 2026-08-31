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

describe('shared Simulator canvas pointer', () => {
  test('keeps the system cursor visible when no simulated pointer is rendered', () => {
    expect(renderCanvas()).not.toContain('simulator-pointer-visible');
  });

  test('hides the system cursor only while the simulated pointer is rendered', () => {
    const markup = renderCanvas({ x: 0.5, y: 0.5, pressed: false });

    expect(markup).toContain('simulator-pointer-visible');
    expect(markup).toContain('simulator-pointer');
  });
});
