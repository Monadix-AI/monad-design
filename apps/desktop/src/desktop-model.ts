import type { SimulatorOrientation, SimulatorVariantId } from '@monaddesign/simulator';

export interface ActiveConnection {
  udid: string;
  projectId: string;
  bundleIdentifier: string;
  streamUrl: string;
  wsUrl: string;
  orientation: SimulatorOrientation;
}

export type SimulatorAppearance = 'light' | 'dark';
export type { SimulatorOrientation } from '@monaddesign/simulator';

export interface VariantCapture {
  id: SimulatorVariantId;
  image: string;
  orientation: SimulatorOrientation;
}

export {
  canvasScaleStep,
  maximumCanvasScale,
  minimumCanvasScale,
  simulatorOrientations as orientations,
  simulatorVariantIds as variantIds,
  simulatorVariantIdsForCount as variantIdsForCount,
  simulatorVariantLabels as variantLabels
} from '@monaddesign/simulator';
