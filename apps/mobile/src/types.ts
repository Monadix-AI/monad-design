import type {
  AccessibilitySnapshotResponse,
  IOSSimulator as ClientIOSSimulator,
  RemoteProject as ClientRemoteProject,
  SimulatorConnectionResponse
} from '@monaddesign/client-rtk';
export type IOSSimulator = ClientIOSSimulator;
export type AXSnapshot = AccessibilitySnapshotResponse;
export type AXElement = AXSnapshot['elements'][number];
export type { SimulatorOrientation, SimulatorVariantId } from '@monaddesign/simulator';

export interface ClientConnection {
  origin: string;
  pairingCode: string;
}

export type RemoteProject = ClientRemoteProject;
export type SimulatorConnection = SimulatorConnectionResponse;
