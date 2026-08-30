import type {
  AddCoreProjectRequest,
  ConfigureCoreProjectRequest,
  ConfirmAgentSelectionRequest,
  ConnectAgentSessionRequest,
  CoreProject,
  CoreProjectListResponse,
  ProjectTargetDetection,
  RemovedProjectResponse,
  SimulatorVariantId,
  SubmitAgentRequest
} from './client-types';

import { coreEndpoints, projectSelectors, simulatorSelectors } from './endpoints';
import { type ClientStore, createClientStore } from './store';
import { createCoreTreaty } from './treaty-client';

export interface ClientConnection {
  origin: string;
  accessToken: string;
  pairingCode?: string;
}

export type ClientKind = 'agent' | 'companion' | 'desktop';

const normalizeOrigin = (value: string) => {
  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `http://${value.trim()}`;
  return withProtocol.replace(/\/+$/, '');
};

export class ClientApi<TConnection extends ClientConnection = ClientConnection> {
  readonly connection: TConnection;
  readonly store: ClientStore;

  constructor(connection: TConnection, clientKind: ClientKind = 'companion') {
    this.connection = {
      ...connection,
      origin: normalizeOrigin(connection.origin),
      accessToken: connection.accessToken.trim(),
      ...(connection.pairingCode ? { pairingCode: connection.pairingCode.trim() } : {})
    } as TConnection;
    this.store = createClientStore(
      createCoreTreaty({
        baseUrl: this.connection.origin,
        pairingCode: this.connection.accessToken,
        clientKind
      })
    );
  }

  url(path: string) {
    return `${this.connection.origin}${path}`;
  }

  streamUrl(path: string) {
    return `${this.url(path)}?accessToken=${encodeURIComponent(this.connection.accessToken)}`;
  }

  inputUrl(path: string) {
    return this.streamUrl(path).replace(/^http/, 'ws');
  }

  async #adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.url(path), {
      ...init,
      headers: {
        authorization: `Bearer ${this.connection.accessToken}`,
        'content-type': 'application/json',
        'x-monad-design-client-kind': 'desktop',
        ...init?.headers
      }
    });
    const body = (await response.json()) as T | { error?: string };
    if (!response.ok) {
      const error = (body as { error?: unknown }).error;
      throw new Error(typeof error === 'string' ? error : 'Core request failed.');
    }
    return body as T;
  }

  async adminProjects() {
    return (await this.#adminRequest<CoreProjectListResponse>('/v1/admin/projects/')).projects;
  }

  openAdminProject(id: string) {
    return this.#adminRequest<CoreProject>(`/v1/admin/projects/${encodeURIComponent(id)}/open`, {
      method: 'POST'
    });
  }

  detectProjectTargets(path: string) {
    return this.#adminRequest<ProjectTargetDetection>('/v1/admin/projects/detect-targets', {
      method: 'POST',
      body: JSON.stringify({ path })
    });
  }

  addAdminProject(body: AddCoreProjectRequest) {
    return this.#adminRequest<CoreProject>('/v1/admin/projects/', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  configureAdminProject(id: string, body: ConfigureCoreProjectRequest) {
    return this.#adminRequest<CoreProject>(`/v1/admin/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  removeAdminProject(id: string) {
    return this.#adminRequest<RemovedProjectResponse>(`/v1/admin/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  health() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getHealth.initiate(undefined, {
          subscribe: false
        })
      )
      .unwrap();
  }

  activeAgentSession() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getActiveAgentSession.initiate(undefined, {
          forceRefetch: true,
          subscribe: false
        })
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
      .dispatch(
        coreEndpoints.endpoints.getProjectIcons.initiate(id, {
          forceRefetch: true,
          subscribe: false
        })
      )
      .unwrap();
    return response.icons;
  }

  async simulators() {
    const page = await this.store
      .dispatch(
        coreEndpoints.endpoints.listSimulators.initiate(undefined, {
          forceRefetch: true,
          subscribe: false
        })
      )
      .unwrap();
    return simulatorSelectors.selectAll(page.simulators);
  }

  connect(projectId: string, udid: string, bundleIdentifier: string) {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.connectSimulator.initiate({
          projectId,
          udid,
          bundleIdentifier
        })
      )
      .unwrap();
  }

  disconnect() {
    return this.store.dispatch(coreEndpoints.endpoints.disconnectSimulator.initiate()).unwrap();
  }

  accessibility() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getAccessibilitySnapshot.initiate(undefined, {
          forceRefetch: true,
          subscribe: false
        })
      )
      .unwrap();
  }

  appearance() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.getSimulatorAppearance.initiate(undefined, {
          forceRefetch: true,
          subscribe: false
        })
      )
      .unwrap();
  }

  setAppearance(appearance: 'light' | 'dark') {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.setSimulatorAppearance.initiate({
          appearance
        })
      )
      .unwrap();
  }

  setPasteboard(text: string) {
    return this.store.dispatch(coreEndpoints.endpoints.setSimulatorPasteboard.initiate(text)).unwrap();
  }

  screenshot() {
    return this.store
      .dispatch(
        coreEndpoints.endpoints.captureSimulatorScreenshot.initiate(undefined, {
          forceRefetch: true,
          subscribe: false
        })
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
