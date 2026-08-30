import type { Treaty } from '@elysiajs/eden';
import type {
  AccessibilitySnapshotResponse,
  ActiveAgentSessionResponse,
  AgentSessionSnapshot,
  AppearanceResponse,
  ConfirmAgentSelectionRequest,
  ConnectAgentSessionRequest,
  ConnectSimulatorRequest,
  CopiedResponse,
  DisconnectedResponse,
  HealthResponse,
  LaunchAppResponse,
  LaunchVariantRequest,
  LaunchVariantResponse,
  ListProjectsResponse,
  ListSimulatorsResponse,
  PaginationQuery,
  ProjectIconsResponse,
  RemoteProject,
  ScreenshotResponse,
  SimulatorConnectionResponse,
  SubmitAgentRequest
} from '@monaddesign/client-contract';

import { treaty } from '@elysiajs/eden';

type TreatyResponse<T> = Promise<{ data: T | null; error: unknown }>;

type ProjectsTreaty = {
  get(options: { query: PaginationQuery }): TreatyResponse<ListProjectsResponse>;
} & ((params: { id: string }) => {
  icons: { get(): TreatyResponse<ProjectIconsResponse> };
  open: { post(): TreatyResponse<RemoteProject> };
});

export interface CoreTreaty {
  v1: {
    health: { get(): TreatyResponse<HealthResponse> };
    agentSession: {
      active: { get(): TreatyResponse<ActiveAgentSessionResponse> };
    } & ((params: { id: string }) => {
      connected: { post(body: ConnectAgentSessionRequest): TreatyResponse<AgentSessionSnapshot> };
      request: { post(body: SubmitAgentRequest): TreatyResponse<AgentSessionSnapshot> };
      confirmSelection: { post(body: ConfirmAgentSelectionRequest): TreatyResponse<AgentSessionSnapshot> };
    });
    projects: ProjectsTreaty;
    simulators: {
      get(): TreatyResponse<ListSimulatorsResponse>;
      connect: {
        post(body: ConnectSimulatorRequest): TreatyResponse<SimulatorConnectionResponse>;
      };
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
  pairingCode?: string;
  clientId?: string;
  clientKind?: 'agent' | 'companion' | 'desktop';
  config?: CoreTreatyConfig;
}

export const createCoreTreaty = ({
  baseUrl,
  pairingCode,
  clientId,
  clientKind,
  config
}: CreateCoreTreatyOptions): CoreTreaty => {
  const headers: Record<string, string> = {};
  if (pairingCode) headers.authorization = `Bearer ${pairingCode}`;
  if (clientId) headers['x-monad-design-client-id'] = clientId;
  if (clientKind) headers['x-monad-design-client-kind'] = clientKind;
  return treaty(baseUrl.replace(/\/$/, ''), {
    ...config,
    parseDate: false,
    headers: config?.headers ? [headers, config.headers] : headers
  }) as unknown as CoreTreaty;
};
