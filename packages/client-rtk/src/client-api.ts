import type {
  AddCoreProjectRequest,
  ConfigureCoreProjectRequest,
  ConfirmAgentSelectionRequest,
  ConnectAgentSessionRequest,
  LaunchVariantRequest,
  ReportVariantCaptureFailureRequest,
  SimulatorConnectStatus,
  SubmitAgentRequest
} from '@monaddesign/client-contract';

import { coreApi } from './api-slice';
import { coreEndpoints, projectSelectors, simulatorSelectors } from './endpoints';
import { type ClientStore, createClientStore } from './store';
import { createCoreTreaty } from './treaty-client';

type SimulatorVariantId = LaunchVariantRequest['variant'];

export interface ClientConnection {
  origin: string;
  accessToken?: string;
  pairingCode?: string;
}

export interface ClientApiOptions {
  requestTimeoutMilliseconds?: number;
  signal?: AbortSignal;
}

const normalizeOrigin = (value: string) => {
  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `http://${value.trim()}`;
  return withProtocol.replace(/\/+$/, '');
};

export class ClientApi<TConnection extends ClientConnection = ClientConnection> {
  readonly connection: TConnection;
  readonly store: ClientStore;

  constructor(connection: TConnection, options: ClientApiOptions = {}) {
    const accessToken = connection.accessToken?.trim();
    const requestTimeoutMilliseconds = options.requestTimeoutMilliseconds;
    const signal = options.signal;
    this.connection = {
      ...connection,
      origin: normalizeOrigin(connection.origin),
      ...(accessToken ? { accessToken } : {}),
      ...(connection.pairingCode ? { pairingCode: connection.pairingCode.trim() } : {})
    } as TConnection;
    this.store = createClientStore(
      createCoreTreaty({
        baseUrl: this.connection.origin,
        ...(accessToken || requestTimeoutMilliseconds || signal
          ? {
              config: {
                ...(requestTimeoutMilliseconds || signal
                  ? {
                      onRequest: () => ({
                        signal:
                          signal && requestTimeoutMilliseconds
                            ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMilliseconds)])
                            : (signal ?? AbortSignal.timeout(requestTimeoutMilliseconds as number))
                      })
                    }
                  : {}),
                ...(accessToken
                  ? { headers: { authorization: `Bearer ${accessToken}`, 'x-monad-design-client-kind': 'desktop' } }
                  : {})
              }
            }
          : {})
      })
    );
  }

  url(path: string) {
    return `${this.connection.origin}${path}`;
  }

  streamUrl(path: string) {
    const url = this.url(path);
    return this.connection.accessToken
      ? `${url}${url.includes('?') ? '&' : '?'}accessToken=${encodeURIComponent(this.connection.accessToken)}`
      : url;
  }

  inputUrl(path: string) {
    return this.streamUrl(path).replace(/^http/, 'ws');
  }

  dispose() {
    this.store.dispatch(coreApi.util.resetApiState());
  }

  async adminProjects() {
    const response = await this.store
      .dispatch(coreEndpoints.endpoints.listAdminProjects.initiate(undefined, { forceRefetch: true, subscribe: false }))
      .unwrap();
    return response.projects;
  }

  openAdminProject(id: string) {
    return this.store.dispatch(coreEndpoints.endpoints.openAdminProject.initiate(id)).unwrap();
  }

  projectDesignDocument(id: string) {
    return this.store
      .dispatch(coreEndpoints.endpoints.getProjectDesignDocument.initiate(id, { forceRefetch: true, subscribe: false }))
      .unwrap();
  }

  detectProjectTargets(path: string) {
    return this.store.dispatch(coreEndpoints.endpoints.detectProjectTargets.initiate(path)).unwrap();
  }

  addAdminProject(body: AddCoreProjectRequest) {
    return this.store.dispatch(coreEndpoints.endpoints.addAdminProject.initiate(body)).unwrap();
  }

  configureAdminProject(id: string, body: ConfigureCoreProjectRequest) {
    return this.store.dispatch(coreEndpoints.endpoints.configureAdminProject.initiate({ id, body })).unwrap();
  }

  removeAdminProject(id: string) {
    return this.store.dispatch(coreEndpoints.endpoints.removeAdminProject.initiate(id)).unwrap();
  }

  health() {
    return this.store.dispatch(coreEndpoints.endpoints.getHealth.initiate(undefined, { subscribe: false })).unwrap();
  }

  pair() {
    if (!this.connection.pairingCode) throw new Error('A pairing code is required to establish this connection.');
    return this.store
      .dispatch(coreEndpoints.endpoints.pairCore.initiate({ pairingCode: this.connection.pairingCode }))
      .unwrap();
  }

  activeAgentSession() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getActiveAgentSession.initiate(undefined, { forceRefetch: true, subscribe: false })
      )
      .unwrap();
  }

  connectAgentSession(id: string, body: ConnectAgentSessionRequest) {
    return this.store.dispatch(coreEndpoints.endpoints.connectAgentSession.initiate({ id, body })).unwrap();
  }

  submitAgentRequest(id: string, body: SubmitAgentRequest) {
    return this.store.dispatch(coreEndpoints.endpoints.submitAgentRequest.initiate({ id, body })).unwrap();
  }

  confirmAgentSelection(id: string, body: ConfirmAgentSelectionRequest) {
    return this.store.dispatch(coreEndpoints.endpoints.confirmAgentSelection.initiate({ id, body })).unwrap();
  }

  reportVariantCaptureFailure(id: string, body: ReportVariantCaptureFailureRequest) {
    return this.store.dispatch(coreEndpoints.endpoints.reportVariantCaptureFailure.initiate({ id, body })).unwrap();
  }

  closeAgentSession(id: string) {
    return this.store.dispatch(coreEndpoints.endpoints.closeAgentSession.initiate(id)).unwrap();
  }

  async projects() {
    const projects = [];
    const limit = 100;
    while (true) {
      const page = await this.store
        .dispatch(
          coreEndpoints.endpoints.listProjects.initiate(
            { limit, offset: projects.length },
            { forceRefetch: true, subscribe: false }
          )
        )
        .unwrap();
      const items = projectSelectors.selectAll(page.projects);
      projects.push(...items);
      if (projects.length >= page.total || items.length === 0) return projects;
    }
  }

  openProject(id: string) {
    return this.store.dispatch(coreEndpoints.endpoints.openProject.initiate(id)).unwrap();
  }

  async projectIcons(id: string) {
    const response = await this.store
      .dispatch(coreEndpoints.endpoints.getProjectIcons.initiate(id, { forceRefetch: true, subscribe: false }))
      .unwrap();
    return response.icons;
  }

  async simulators() {
    const page = await this.store
      .dispatch(coreEndpoints.endpoints.listSimulators.initiate(undefined, { forceRefetch: true, subscribe: false }))
      .unwrap();
    return simulatorSelectors.selectAll(page.simulators);
  }

  async connect(
    projectId: string,
    udid: string,
    bundleIdentifier: string,
    options: {
      rebuild?: boolean;
      onProgress?: (label: string) => void;
    } = {}
  ) {
    const query = { projectId, udid, bundleIdentifier };
    const labels: Record<SimulatorConnectStatus['phase'], string> = {
      preparing: 'Preparing Simulator…',
      checking: 'Checking app installation…',
      building: 'Building Debug app…',
      installing: 'Installing app…',
      connecting: 'Connecting…'
    };
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await this.store
          .dispatch(
            coreEndpoints.endpoints.getSimulatorConnectStatus.initiate(query, {
              forceRefetch: true,
              subscribe: false
            })
          )
          .unwrap();
        if (!stopped) options.onProgress?.(labels[status.phase]);
      } catch {
        /* The connect request owns error reporting. */
      }
      if (!stopped) timer = setTimeout(() => void poll(), 500);
    };
    options.onProgress?.(labels.preparing);
    if (options.onProgress) timer = setTimeout(() => void poll(), 500);
    try {
      return await this.store
        .dispatch(
          coreEndpoints.endpoints.connectSimulator.initiate({
            ...query,
            ...(options.rebuild ? { rebuild: true } : {})
          })
        )
        .unwrap();
    } finally {
      stopped = true;
      clearTimeout(timer);
    }
  }

  disconnect() {
    return this.store.dispatch(coreEndpoints.endpoints.disconnectSimulator.initiate()).unwrap();
  }

  accessibility() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getAccessibilitySnapshot.initiate(undefined, { forceRefetch: true, subscribe: false })
      )
      .unwrap();
  }

  appearance() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getSimulatorAppearance.initiate(undefined, { forceRefetch: true, subscribe: false })
      )
      .unwrap();
  }

  setAppearance(appearance: 'light' | 'dark') {
    return this.store.dispatch(coreEndpoints.endpoints.setSimulatorAppearance.initiate({ appearance })).unwrap();
  }

  setPasteboard(text: string) {
    return this.store.dispatch(coreEndpoints.endpoints.setSimulatorPasteboard.initiate(text)).unwrap();
  }

  screenshot() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.captureSimulatorScreenshot.initiate(undefined, { forceRefetch: true, subscribe: false })
      )
      .unwrap();
  }

  launchApp() {
    return this.store.dispatch(coreEndpoints.endpoints.launchSimulatorApp.initiate()).unwrap();
  }

  launchVariant(variant: SimulatorVariantId) {
    return this.store.dispatch(coreEndpoints.endpoints.launchSimulatorVariant.initiate({ variant })).unwrap();
  }
}
