import type { SimulatorVariantId } from './electron';

export interface ActiveConnection {
  udid: string;
  projectId: string;
  bundleIdentifier: string;
  streamUrl: string;
  wsUrl: string;
  orientation: SimulatorOrientation;
}

export type SimulatorAppearance = 'light' | 'dark';
export type SimulatorOrientation = 'portrait' | 'landscape_left' | 'portrait_upside_down' | 'landscape_right';

export const orientations: SimulatorOrientation[] = [
  'portrait',
  'landscape_left',
  'portrait_upside_down',
  'landscape_right'
];

export interface VariantCapture {
  id: SimulatorVariantId;
  image: string;
  orientation: SimulatorOrientation;
}

export const variantIds: SimulatorVariantId[] = ['original', 'v1', 'v2', 'v3', 'v4', 'v5'];

export const variantLabels: Record<SimulatorVariantId, string> = {
  original: 'Original',
  v1: 'Variant 1',
  v2: 'Variant 2',
  v3: 'Variant 3',
  v4: 'Variant 4',
  v5: 'Variant 5'
};

export const variantIdsForCount = (count: number): SimulatorVariantId[] => variantIds.slice(0, count + 1);

export const minimumCanvasScale = 0.25;
export const maximumCanvasScale = 2;
export const canvasScaleStep = 0.1;
