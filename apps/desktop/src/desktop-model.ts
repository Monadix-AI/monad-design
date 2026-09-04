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
export interface VariantCapture {
  id: SimulatorVariantId;
  image: string;
  orientation: SimulatorOrientation;
}
