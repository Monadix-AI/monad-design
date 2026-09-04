import type { Treaty } from '@elysiajs/eden';
import type {
  AccessibilitySnapshotResponse,
  ActiveAgentSessionResponse,
  AddCoreProjectRequest,
  AgentSessionSnapshot,
  AppearanceResponse,
  ConfigureCoreProjectRequest,
  ConfirmAgentSelectionRequest,
  ConnectAgentSessionRequest,
  ConnectSimulatorRequest,
  CopiedResponse,
  CoreProject,
  CoreProjectListResponse,
  DisconnectedResponse,
  HealthResponse,
  LaunchAppResponse,
  LaunchVariantRequest,
  LaunchVariantResponse,
  ListProjectsResponse,
  ListSimulatorsResponse,
  PaginationQuery,
  PairCoreRequest,
  PairCoreResponse,
  ProjectDesignDocument,
  ProjectIconsResponse,
  ProjectTargetDetection,
  RemoteProject,
  RemovedProjectResponse,
  ReportVariantCaptureFailureRequest,
  ScreenshotResponse,
  SimulatorConnectionResponse,
  SubmitAgentRequest
} from '@monaddesign/client-contract';

import { treaty } from '@elysiajs/eden';

type TreatyResponse<T> = Promise<{ data: T | null; error: unknown }>;

type ProjectsTreaty = { get(options: { query: PaginationQuery }): TreatyResponse<ListProjectsResponse> } & ((params: {
  id: string;
}) => { icons: { get(): TreatyResponse<ProjectIconsResponse> }; open: { post(): TreatyResponse<RemoteProject> } });

type AdminProjectsTreaty = {
  get(): TreatyResponse<CoreProjectListResponse>;
  post(body: AddCoreProjectRequest): TreatyResponse<CoreProject>;
  'detect-targets': { post(body: { path: string }): TreatyResponse<ProjectTargetDetection> };
} & ((params: { id: string }) => {
  delete(): TreatyResponse<RemovedProjectResponse>;
  put(body: ConfigureCoreProjectRequest): TreatyResponse<CoreProject>;
  'design-document': { get(): TreatyResponse<ProjectDesignDocument> };
  open: { post(): TreatyResponse<CoreProject> };
});

export interface CoreTreaty {
  v1: {
    health: { get(): TreatyResponse<HealthResponse> };
    pair: { post(body: PairCoreRequest): TreatyResponse<PairCoreResponse> };
    admin: { projects: AdminProjectsTreaty };
    'agent-session': { active: { get(): TreatyResponse<ActiveAgentSessionResponse> } } & ((params: { id: string }) => {
      connected: { post(body: ConnectAgentSessionRequest): TreatyResponse<AgentSessionSnapshot> };
      request: { post(body: SubmitAgentRequest): TreatyResponse<AgentSessionSnapshot> };
      'capture-failure': { post(body: ReportVariantCaptureFailureRequest): TreatyResponse<AgentSessionSnapshot> };
      'confirm-selection': { post(body: ConfirmAgentSelectionRequest): TreatyResponse<AgentSessionSnapshot> };
      close: { post(): TreatyResponse<AgentSessionSnapshot> };
    });
    projects: ProjectsTreaty;
    simulators: {
      get(): TreatyResponse<ListSimulatorsResponse>;
      connect: { post(body: ConnectSimulatorRequest): TreatyResponse<SimulatorConnectionResponse> };
    };
    simulator: {
      connection: { delete(): TreatyResponse<DisconnectedResponse> };
      accessibility: { get(): TreatyResponse<AccessibilitySnapshotResponse> };
      appearance: {
        get(): TreatyResponse<AppearanceResponse>;
        put(body: AppearanceResponse): TreatyResponse<AppearanceResponse>;
      };
      pasteboard: { post(body: { text: string }): TreatyResponse<CopiedResponse> };
      screenshot: { get(): TreatyResponse<ScreenshotResponse> };
      app: { post(): TreatyResponse<LaunchAppResponse> };
      variant: { post(body: LaunchVariantRequest): TreatyResponse<LaunchVariantResponse> };
    };
  };
}
export type CoreTreatyConfig = Treaty.Config;

export interface CreateCoreTreatyOptions {
  baseUrl: string;
  config?: CoreTreatyConfig;
}

export const createCoreTreaty = ({ baseUrl, config }: CreateCoreTreatyOptions): CoreTreaty => {
  return treaty(baseUrl.replace(/\/$/, ''), { ...config, parseDate: false }) as unknown as CoreTreaty;
};
