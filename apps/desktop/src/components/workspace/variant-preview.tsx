import type { SimulatorVariantId } from '@/electron';

import { VariantComparison } from '@monaddesign/ui/business/variant-comparison';

import { useCanvasViewportOffset, useCanvasViewportScale } from '@/canvas-viewport-provider';
import { useDesktopApp } from '@/desktop-app-provider';

export function VariantPreview() {
  const {
    capturingVariant,
    connected,
    deviceFrame,
    deviceHeight,
    deviceWidth,
    orientation,
    selectedVariant,
    setSelectedVariant,
    variantCaptures,
    variantIds,
    variantLabels
  } = useDesktopApp();
  const canvasOffset = useCanvasViewportOffset();
  const canvasScale = useCanvasViewportScale();
  const previewVariants = variantIds.filter((variant) => variant !== 'original');

  return (
    <VariantComparison
      captures={variantCaptures}
      capturingVariant={capturingVariant}
      deviceChrome={connected?.deviceChrome}
      deviceFrame={deviceFrame}
      deviceHeight={deviceHeight}
      deviceWidth={deviceWidth}
      framebufferMask={connected?.framebufferMask}
      labels={variantLabels}
      offset={canvasOffset}
      onSelect={(value) => setSelectedVariant(value as SimulatorVariantId)}
      orientation={orientation}
      scale={canvasScale}
      selectedVariant={selectedVariant}
      variants={previewVariants}
    />
  );
}
