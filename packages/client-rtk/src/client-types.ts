import type {
  ConfirmAgentSelectionRequest,
  ConnectAgentSessionRequest,
  LaunchVariantRequest,
  SubmitAgentRequest
} from '@monaddesign/client-contract';

export type {
  AddCoreProjectRequest,
  ConfigureCoreProjectRequest,
  CoreProject,
  CoreProjectListResponse,
  ProjectTargetDetection,
  RemovedProjectResponse
} from '@monaddesign/client-contract';
export type { ConfirmAgentSelectionRequest, ConnectAgentSessionRequest, SubmitAgentRequest };

export type SimulatorVariantId = LaunchVariantRequest['variant'];
