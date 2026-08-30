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
  IOSSimulator,
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

import { createEntityAdapter } from '@reduxjs/toolkit';

import { coreApi } from './api-slice';
import { clientOf, runTreaty } from './endpoint-helpers';

export const projectAdapter = createEntityAdapter<RemoteProject, string>({
  selectId: (project) => project.id
});
export const projectSelectors = projectAdapter.getSelectors();

export const simulatorAdapter = createEntityAdapter<IOSSimulator, string>({
  selectId: (simulator) => simulator.udid
});
export const simulatorSelectors = simulatorAdapter.getSelectors();

export type ListProjectsResult = Omit<ListProjectsResponse, 'projects'> & {
  projects: ReturnType<typeof projectAdapter.getInitialState>;
};

export type ListSimulatorsResult = Omit<ListSimulatorsResponse, 'simulators'> & {
  simulators: ReturnType<typeof simulatorAdapter.getInitialState>;
};

export const coreEndpoints = coreApi.injectEndpoints({
  endpoints: (builder) => ({
    getHealth: builder.query<HealthResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.health.get()),
      providesTags: ['Health']
    }),
    getActiveAgentSession: builder.query<ActiveAgentSessionResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.agentSession.active.get()),
      providesTags: ['AgentSession']
    }),
    connectAgentSession: builder.mutation<AgentSessionSnapshot, { id: string; body: ConnectAgentSessionRequest }>({
      queryFn: ({ body, id }, api: { extra: unknown }) =>
        runTreaty(() => clientOf(api).v1.agentSession({ id }).connected.post(body)),
      invalidatesTags: ['AgentSession']
    }),
    submitAgentRequest: builder.mutation<AgentSessionSnapshot, { id: string; body: SubmitAgentRequest }>({
      queryFn: ({ body, id }, api: { extra: unknown }) =>
        runTreaty(() => clientOf(api).v1.agentSession({ id }).request.post(body)),
      invalidatesTags: ['AgentSession']
    }),
    confirmAgentSelection: builder.mutation<AgentSessionSnapshot, { id: string; body: ConfirmAgentSelectionRequest }>({
      queryFn: ({ body, id }, api: { extra: unknown }) =>
        runTreaty(() => clientOf(api).v1.agentSession({ id }).confirmSelection.post(body)),
      invalidatesTags: ['AgentSession']
    }),
    listProjects: builder.query<ListProjectsResult, PaginationQuery | undefined>({
      queryFn: (query, api: { extra: unknown }) =>
        runTreaty(
          () =>
            clientOf(api).v1.projects.get({
              query: query ?? { limit: 50, offset: 0 }
            }),
          (raw) => ({
            ...raw,
            projects: projectAdapter.setAll(projectAdapter.getInitialState(), raw.projects)
          })
        ),
      providesTags: (result) => [
        'Projects',
        ...(result?.projects.ids.map((id) => ({
          type: 'Projects' as const,
          id
        })) ?? [])
      ]
    }),
    openProject: builder.mutation<RemoteProject, string>({
      queryFn: (id, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.projects({ id }).open.post()),
      invalidatesTags: (_result, _error, id) => ['Projects', { type: 'Projects', id }]
    }),
    getProjectIcons: builder.query<ProjectIconsResponse, string>({
      queryFn: (id, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.projects({ id }).icons.get()),
      providesTags: (_result, _error, id) => [{ type: 'Projects', id }]
    }),
    listSimulators: builder.query<ListSimulatorsResult, void>({
      queryFn: (_arg, api: { extra: unknown }) =>
        runTreaty(
          () => clientOf(api).v1.simulators.get(),
          (raw) => ({
            ...raw,
            simulators: simulatorAdapter.setAll(simulatorAdapter.getInitialState(), raw.simulators)
          })
        ),
      providesTags: ['Simulators']
    }),
    connectSimulator: builder.mutation<SimulatorConnectionResponse, ConnectSimulatorRequest>({
      queryFn: (body, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulators.connect.post(body)),
      invalidatesTags: ['Simulator', 'Simulators']
    }),
    disconnectSimulator: builder.mutation<DisconnectedResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.connection.delete()),
      invalidatesTags: ['Simulator', 'Simulators']
    }),
    getAccessibilitySnapshot: builder.query<AccessibilitySnapshotResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.accessibility.get()),
      providesTags: ['Simulator']
    }),
    getSimulatorAppearance: builder.query<AppearanceResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.appearance.get()),
      providesTags: ['Simulator']
    }),
    setSimulatorAppearance: builder.mutation<AppearanceResponse, AppearanceResponse>({
      queryFn: (body, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.appearance.put(body)),
      invalidatesTags: ['Simulator']
    }),
    setSimulatorPasteboard: builder.mutation<CopiedResponse, string>({
      queryFn: (text, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.pasteboard.post({ text }))
    }),
    captureSimulatorScreenshot: builder.query<ScreenshotResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.screenshot.get())
    }),
    launchSimulatorApp: builder.mutation<LaunchAppResponse, void>({
      queryFn: (_arg, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.app.post())
    }),
    launchSimulatorVariant: builder.mutation<LaunchVariantResponse, LaunchVariantRequest>({
      queryFn: (body, api: { extra: unknown }) => runTreaty(() => clientOf(api).v1.simulator.variant.post(body))
    })
  })
});

export const {
  useCaptureSimulatorScreenshotQuery,
  useConfirmAgentSelectionMutation,
  useConnectAgentSessionMutation,
  useConnectSimulatorMutation,
  useDisconnectSimulatorMutation,
  useGetAccessibilitySnapshotQuery,
  useGetActiveAgentSessionQuery,
  useGetHealthQuery,
  useGetProjectIconsQuery,
  useGetSimulatorAppearanceQuery,
  useLaunchSimulatorAppMutation,
  useLaunchSimulatorVariantMutation,
  useLazyCaptureSimulatorScreenshotQuery,
  useListProjectsQuery,
  useListSimulatorsQuery,
  useOpenProjectMutation,
  useSetSimulatorAppearanceMutation,
  useSetSimulatorPasteboardMutation,
  useSubmitAgentRequestMutation
} = coreEndpoints;
