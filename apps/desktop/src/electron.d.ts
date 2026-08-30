export interface IOSSimulator {
  udid: string;
  name: string;
  runtime: string;
  state: 'Booted' | 'Shutdown';
  connected: boolean;
  deviceTypeIdentifier?: string;
  productFamily?: string;
  modelIdentifier?: string;
  chromeIdentifier?: string;
  screen?: { width: number; height: number; scale: number };
  framebufferMask?: string;
  deviceChrome?: {
    image: string;
    frame: { width: number; height: number };
    body: { x: number; y: number; width: number; height: number };
    screen: { x: number; y: number; width: number; height: number };
    insets: { top: number; right: number; bottom: number; left: number };
  };
}

export interface AXElement {
  id: string;
  path: string;
  label: string;
  value: string;
  role: string;
  type: string;
  enabled: boolean;
  isContainer: boolean;
  frame: { x: number; y: number; width: number; height: number };
}

export interface AXSnapshot {
  screen: { width: number; height: number };
  elements: AXElement[];
  errors?: string[];
}

export type SimulatorVariantId = 'original' | 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

export interface MonadDesignProject {
  id: string;
  name: string;
  path: string;
  configPath: string;
  lastOpenedAt: string;
  targetApps: Array<{
    bundleIdentifier: string;
    name: string;
    sourcePath?: string;
    live?: ProjectFrameworkAdapter;
  }>;
}

export interface ProjectFrameworkAdapter {
  schemaVersion: 1;
  framework: 'swiftui' | 'uikit-swift' | 'uikit-objective-c' | 'react-native' | 'expo' | 'flutter';
  sourceRoots: string[];
  variant: {
    bridge: 'native-launch-arguments' | 'react-native-initial-properties' | 'flutter-method-channel';
    bootstrapPath: string;
    launchArgument: '-MonadDesignVariant';
    values: ['original', 'v1', 'v2', 'v3', 'v4', 'v5'];
  };
  build: {
    system: 'xcodebuild' | 'react-native' | 'expo' | 'flutter' | 'custom';
    workingDirectory: string;
    configuration: 'Debug';
    containerPath?: string;
    scheme?: string;
    flavor?: string;
    command?: string[];
    artifactPath?: string;
  };
  navigation: {
    strategy: 'app-router' | 'deep-link' | 'state-restoration' | 'debug-bootstrap';
    bootstrapPath: string;
  };
}

export interface AgentTurnContext {
  simulator: {
    udid: string;
    bundleIdentifier: string;
    name?: string;
    runtime?: string;
  };
  currentScreen?: {
    screen: { width: number; height: number };
    elements: Array<Record<string, unknown>>;
    accessibilityErrors?: string[];
  };
  selection?: {
    screen: { width: number; height: number };
    selectedElement: Record<string, unknown>;
    ancestors: Array<Record<string, unknown>>;
    nearbySiblings: Array<Record<string, unknown>>;
    accessibilityErrors?: string[];
  };
  annotation?: {
    screenshotPath: string;
    mimeType: 'image/png';
  };
}

export type AgentSessionStatus =
  | 'configuring_project'
  | 'selecting_simulator'
  | 'awaiting_request'
  | 'change_requested'
  | 'working'
  | 'variants_ready'
  | 'selection_confirmed'
  | 'closed';

export interface AgentSessionSnapshot {
  id: string;
  project: {
    id: string;
    name: string;
    lastOpenedAt: string;
    targetApps: Array<{
      bundleIdentifier: string;
      name: string;
      sourcePath?: string;
    }>;
  };
  task?: string;
  status: AgentSessionStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  connection?: { udid: string; bundleIdentifier: string };
  changeRequest?: { id: string; request: string; variantCount: number; context: AgentTurnContext; createdAt: string };
  publishedVariants?: { requestId: string; summary: string; publishedAt: string };
  confirmedSelection?: { requestId: string; variant: SimulatorVariantId; confirmedAt: string };
  lastResult?: { requestId: string; summary: string; completedAt: string };
}

export interface ProjectDirectorySelection {
  name: string;
  path: string;
}

export type ProjectTargetSource = 'project-config' | 'expo' | 'xcode';

export interface ProjectTargetCandidate {
  bundleIdentifier: string;
  name: string;
  source: ProjectTargetSource;
  sourcePath: string;
}

export interface ProjectTargetDetection {
  candidates: ProjectTargetCandidate[];
  inspectedFiles: number;
  warnings: string[];
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
          accessToken: string;
        }>;
        subscribeToAgentSession: (listener: (session: AgentSessionSnapshot) => void) => () => void;
      };
      projects: {
        choose: () => Promise<ProjectDirectorySelection | null>;
      };
    };
  }
}
