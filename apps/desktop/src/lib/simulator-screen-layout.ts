import type { SimulatorOrientation } from '@monaddesign/simulator';

export const simulatorScreenLayer = ({
  height,
  orientation,
  width
}: {
  height: number;
  orientation: SimulatorOrientation;
  width: number;
}) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';

  return {
    width: landscape ? height : width,
    height: landscape ? width : height,
    transform:
      orientation === 'landscape_left'
        ? 'translate(-50%, -50%) rotate(90deg)'
        : orientation === 'landscape_right'
          ? 'translate(-50%, -50%) rotate(-90deg)'
          : orientation === 'portrait_upside_down'
            ? 'translate(-50%, -50%) rotate(180deg)'
            : 'translate(-50%, -50%)'
  };
};
