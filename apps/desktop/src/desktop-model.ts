import type { SimulatorOrientation, SimulatorVariantId } from '@monaddesign/simulator';
import type { CanvasMode } from '@monaddesign/ui/business/canvas-controls';

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

export const workspaceCanvasMode = (isAnnotationMode: boolean, isVariantPreviewOpen: boolean): CanvasMode =>
  isAnnotationMode ? 'annotate' : isVariantPreviewOpen ? 'variants' : 'interact';
