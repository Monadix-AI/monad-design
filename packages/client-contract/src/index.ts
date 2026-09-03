import { z } from 'zod';

export const requestIdSchema = z.string().min(1).max(128);
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const httpErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  retryable: z.boolean(),
  requestId: requestIdSchema,
  details: z.record(z.string(), z.unknown()).optional()
});
export type HttpError = z.infer<typeof httpErrorSchema>;

export const remoteProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastOpenedAt: z.string(),
  targetApps: z.array(z.object({ bundleIdentifier: z.string(), name: z.string(), sourcePath: z.string().optional() }))
});
export type RemoteProject = z.infer<typeof remoteProjectSchema>;
export const listProjectsResponseSchema = z.object({
  projects: z.array(remoteProjectSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
});
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;
export const projectIconsResponseSchema = z.object({ icons: z.record(z.string(), z.string()) });
export type ProjectIconsResponse = z.infer<typeof projectIconsResponseSchema>;
export const openProjectRequestSchema = z.object({ id: z.string().min(1) });
export type OpenProjectRequest = z.infer<typeof openProjectRequestSchema>;

export const projectFrameworkAdapterSchema = z.object({
  schemaVersion: z.literal(1),
  framework: z.enum(['swiftui', 'uikit-swift', 'uikit-objective-c', 'react-native', 'expo', 'flutter']),
  sourceRoots: z.array(z.string().min(1)).min(1),
  variant: z.object({
    bridge: z.enum(['native-launch-arguments', 'react-native-initial-properties', 'flutter-method-channel']),
    bootstrapPath: z.string().min(1),
    launchArgument: z.literal('-MonadDesignVariant'),
    values: z.union([
      z.tuple([z.literal('original'), z.literal('v1'), z.literal('v2'), z.literal('v3')]),
      z.tuple([
        z.literal('original'),
        z.literal('v1'),
        z.literal('v2'),
        z.literal('v3'),
        z.literal('v4'),
        z.literal('v5')
      ])
    ])
  }),
  build: z.object({
    system: z.enum(['xcodebuild', 'react-native', 'expo', 'flutter', 'custom']),
    workingDirectory: z.string().min(1),
    configuration: z.literal('Debug'),
    containerPath: z.string().min(1).optional(),
    scheme: z.string().min(1).optional(),
    flavor: z.string().min(1).optional(),
    command: z.array(z.string().min(1)).min(1).optional(),
    artifactPath: z.string().min(1).optional()
  }),
  navigation: z.object({
    strategy: z.enum(['app-router', 'deep-link', 'state-restoration', 'debug-bootstrap']),
    bootstrapPath: z.string().min(1)
  })
});
export type ProjectFrameworkAdapter = z.infer<typeof projectFrameworkAdapterSchema>;

export const coreProjectTargetSchema = z.object({
  bundleIdentifier: z.string().min(1),
  name: z.string().min(1),
  sourcePath: z.string().optional(),
  live: projectFrameworkAdapterSchema.optional()
});
export type CoreProjectTarget = z.infer<typeof coreProjectTargetSchema>;

export const coreProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  configPath: z.string(),
  lastOpenedAt: z.string(),
  targetApps: z.array(coreProjectTargetSchema)
});
export type CoreProject = z.infer<typeof coreProjectSchema>;
export const coreProjectListResponseSchema = z.object({ projects: z.array(coreProjectSchema) });
export type CoreProjectListResponse = z.infer<typeof coreProjectListResponseSchema>;

export const projectTargetInputSchema = coreProjectTargetSchema.omit({ live: true });
export type ProjectTargetInput = z.infer<typeof projectTargetInputSchema>;
export const addCoreProjectRequestSchema = z.object({
  path: z.string().min(1),
  targetApps: z.array(projectTargetInputSchema).min(1)
});
export type AddCoreProjectRequest = z.infer<typeof addCoreProjectRequestSchema>;
export const configureCoreProjectRequestSchema = z.object({ targetApps: z.array(projectTargetInputSchema).min(1) });
export type ConfigureCoreProjectRequest = z.infer<typeof configureCoreProjectRequestSchema>;
export const detectProjectTargetsRequestSchema = z.object({ path: z.string().min(1) });
export type DetectProjectTargetsRequest = z.infer<typeof detectProjectTargetsRequestSchema>;
export const projectTargetCandidateSchema = z.object({
  bundleIdentifier: z.string(),
  name: z.string(),
  source: z.enum(['project-config', 'expo', 'xcode']),
  sourcePath: z.string()
});
export const projectTargetDetectionSchema = z.object({
  candidates: z.array(projectTargetCandidateSchema),
  inspectedFiles: z.number().int().nonnegative(),
  warnings: z.array(z.string())
});
export type ProjectTargetDetection = z.infer<typeof projectTargetDetectionSchema>;
export const removedProjectResponseSchema = z.object({ removed: z.literal(true) });
export type RemovedProjectResponse = z.infer<typeof removedProjectResponseSchema>;

export const healthResponseSchema = z.object({
  name: z.literal('Monad Design Core'),
  protocolVersion: z.literal(1),
  platform: z.string(),
  apiVersion: z.literal('v1')
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const pairCoreRequestSchema = z.object({ pairingCode: z.string().regex(/^\d{6}$/u) });
export type PairCoreRequest = z.infer<typeof pairCoreRequestSchema>;
export const pairCoreResponseSchema = z.object({ paired: z.literal(true) });
export type PairCoreResponse = z.infer<typeof pairCoreResponseSchema>;

export const iosSimulatorSchema = z.object({
  udid: z.string(),
  name: z.string(),
  runtime: z.string(),
  state: z.enum(['Booted', 'Shutdown']),
  connected: z.boolean(),
  deviceTypeIdentifier: z.string().optional(),
  productFamily: z.string().optional(),
  modelIdentifier: z.string().optional(),
  chromeIdentifier: z.string().optional(),
  screen: z.object({ width: z.number(), height: z.number(), scale: z.number() }).optional(),
  framebufferMask: z.string().optional(),
  deviceChrome: z
    .object({
      image: z.string(),
      frame: z.object({ width: z.number(), height: z.number() }),
      body: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
      screen: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
      insets: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })
    })
    .optional()
});
export type IOSSimulator = z.infer<typeof iosSimulatorSchema>;
export const listSimulatorsResponseSchema = z.object({ simulators: z.array(iosSimulatorSchema) });
export type ListSimulatorsResponse = z.infer<typeof listSimulatorsResponseSchema>;

export const connectSimulatorRequestSchema = z.object({
  projectId: z.string().min(1),
  udid: z.string().min(1),
  bundleIdentifier: z.string().min(1)
});
export type ConnectSimulatorRequest = z.infer<typeof connectSimulatorRequestSchema>;
export const simulatorConnectionSchema = z.object({
  udid: z.string(),
  projectId: z.string(),
  bundleIdentifier: z.string(),
  streamPath: z.literal('/v1/simulator/stream'),
  inputPath: z.literal('/v1/simulator/input'),
  orientation: z.enum(['portrait', 'landscape_left', 'portrait_upside_down', 'landscape_right']).optional()
});
export type SimulatorConnectionResponse = z.infer<typeof simulatorConnectionSchema>;
export const disconnectedResponseSchema = z.object({ connected: z.literal(false) });
export type DisconnectedResponse = z.infer<typeof disconnectedResponseSchema>;

const frameSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
export const accessibilitySnapshotSchema = z.object({
  screen: z.object({ width: z.number(), height: z.number() }),
  elements: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      label: z.string(),
      value: z.string(),
      role: z.string(),
      type: z.string(),
      enabled: z.boolean(),
      isContainer: z.boolean(),
      frame: frameSchema
    })
  ),
  errors: z.array(z.string()).optional()
});
export type AccessibilitySnapshotResponse = z.infer<typeof accessibilitySnapshotSchema>;

export const appearanceSchema = z.enum(['light', 'dark']);
export const appearanceResponseSchema = z.object({ appearance: appearanceSchema });
export const setAppearanceRequestSchema = appearanceResponseSchema;
export type AppearanceResponse = z.infer<typeof appearanceResponseSchema>;
export const setPasteboardRequestSchema = z.object({ text: z.string().min(1).max(10_000) });
export const copiedResponseSchema = z.object({ copied: z.literal(true) });
export type CopiedResponse = z.infer<typeof copiedResponseSchema>;
export const screenshotResponseSchema = z.object({ image: z.string() });
export type ScreenshotResponse = z.infer<typeof screenshotResponseSchema>;

export const simulatorVariantSchema = z.enum(['original', 'v1', 'v2', 'v3', 'v4', 'v5']);
export const launchVariantRequestSchema = z.object({ variant: simulatorVariantSchema });
export type LaunchVariantRequest = z.infer<typeof launchVariantRequestSchema>;
export const launchAppResponseSchema = z.object({ bundleId: z.string(), process: z.string().nullable() });
export type LaunchAppResponse = z.infer<typeof launchAppResponseSchema>;
export const launchVariantResponseSchema = launchAppResponseSchema.extend({ variant: simulatorVariantSchema });
export type LaunchVariantResponse = z.infer<typeof launchVariantResponseSchema>;

export const agentSessionStatusSchema = z.enum([
  'configuring_project',
  'selecting_simulator',
  'awaiting_request',
  'change_requested',
  'working',
  'variants_ready',
  'selection_confirmed',
  'closed'
]);
export type AgentSessionStatus = z.infer<typeof agentSessionStatusSchema>;

const agentElementSchema = z.record(z.string(), z.unknown());
const agentTurnInputContextSchema = z.object({
  simulator: z.object({
    udid: z.string().min(1),
    bundleIdentifier: z.string().min(1),
    name: z.string().optional(),
    runtime: z.string().optional()
  }),
  currentScreen: z
    .object({
      screen: z.object({ width: z.number().positive(), height: z.number().positive() }),
      elements: z.array(agentElementSchema),
      accessibilityErrors: z.array(z.string()).optional()
    })
    .optional(),
  selection: z
    .object({
      screen: z.object({ width: z.number().positive(), height: z.number().positive() }),
      selectedElement: agentElementSchema,
      ancestors: z.array(agentElementSchema),
      nearbySiblings: z.array(agentElementSchema),
      accessibilityErrors: z.array(z.string()).optional()
    })
    .optional()
});
export const agentTurnContextSchema = agentTurnInputContextSchema.extend({
  annotation: z.object({ screenshotPath: z.string().min(1), mimeType: z.literal('image/png') }).optional()
});
export type AgentTurnContext = z.infer<typeof agentTurnContextSchema>;

export const agentChangeRequestSchema = z.object({
  id: z.string(),
  request: z.string(),
  variantCount: z.number().int().min(1).max(5),
  context: agentTurnContextSchema,
  createdAt: z.string()
});
export const agentSessionSnapshotSchema = z.object({
  id: z.string(),
  project: remoteProjectSchema,
  task: z.string().optional(),
  status: agentSessionStatusSchema,
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  connection: z.object({ udid: z.string(), bundleIdentifier: z.string() }).optional(),
  changeRequest: agentChangeRequestSchema.optional(),
  publishedVariants: z.object({ requestId: z.string(), summary: z.string(), publishedAt: z.string() }).optional(),
  captureFailure: z
    .object({ requestId: z.string(), variant: simulatorVariantSchema, message: z.string(), failedAt: z.string() })
    .optional(),
  confirmedSelection: z
    .object({ requestId: z.string(), variant: simulatorVariantSchema, confirmedAt: z.string() })
    .optional(),
  lastResult: z.object({ requestId: z.string(), summary: z.string(), completedAt: z.string() }).optional()
});
export type AgentSessionSnapshot = z.infer<typeof agentSessionSnapshotSchema>;
export const activeAgentSessionResponseSchema = z.object({ session: agentSessionSnapshotSchema.nullable() });
export type ActiveAgentSessionResponse = z.infer<typeof activeAgentSessionResponseSchema>;
export const connectAgentSessionRequestSchema = z.object({
  udid: z.string().min(1),
  bundleIdentifier: z.string().min(1)
});
export type ConnectAgentSessionRequest = z.infer<typeof connectAgentSessionRequestSchema>;
export const submitAgentRequestSchema = z.object({
  request: z.string().trim().min(1).max(10_000),
  variantCount: z.number().int().min(1).max(5),
  context: agentTurnInputContextSchema,
  annotationScreenshot: z
    .string()
    .max(40_000_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u)
    .optional()
});
export type SubmitAgentRequest = z.infer<typeof submitAgentRequestSchema>;
export const confirmAgentSelectionRequestSchema = z.object({
  requestId: z.string().min(1),
  variant: simulatorVariantSchema
});
export type ConfirmAgentSelectionRequest = z.infer<typeof confirmAgentSelectionRequestSchema>;
export const reportVariantCaptureFailureRequestSchema = z.object({
  requestId: z.string().min(1),
  variant: simulatorVariantSchema,
  message: z.string().trim().min(1).max(2_000)
});
export type ReportVariantCaptureFailureRequest = z.infer<typeof reportVariantCaptureFailureRequestSchema>;
