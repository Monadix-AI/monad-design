import type {
  AccessibilitySnapshotResponse,
  AgentSessionSnapshot,
  AgentSessionStatus,
  AgentTurnContext,
  CoreProject,
  IOSSimulator,
  ProjectFrameworkAdapter,
  ProjectTargetDetection
} from '@monaddesign/client-contract';
import type { SimulatorVariantId } from '@monaddesign/simulator';

export type AXElement = AccessibilitySnapshotResponse['elements'][number];
export type AXSnapshot = AccessibilitySnapshotResponse;
export type MonadDesignProject = CoreProject;
export type ProjectTargetSource = ProjectTargetDetection['candidates'][number]['source'];
export type {
  AgentSessionSnapshot,
  AgentSessionStatus,
  AgentTurnContext,
  IOSSimulator,
  ProjectFrameworkAdapter,
  ProjectTargetDetection,
  SimulatorVariantId
};

export interface ProjectDirectorySelection {
  name: string;
  path: string;
}

declare global {
  interface Window {
    client: {
      platform: NodeJS.Platform;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
      core: {
        status: () => Promise<{
          port: number;
          pairingCode: string;
          addresses: string[];
        }>;
        bootstrap: () => Promise<{
          origin: string;
          accessToken?: string;
        }>;
        subscribeToAgentSession: (listener: (session: AgentSessionSnapshot | null) => void) => () => void;
      };
      projects: {
        choose: () => Promise<ProjectDirectorySelection | null>;
      };
    };
  }
}
