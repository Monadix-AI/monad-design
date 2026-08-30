import type { MonadDesignProject, ProjectStore } from '../project-store';
import type { SimulatorVariantId } from '../simulator-variants';

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { CoreApiError } from './api-error';

export type AgentSessionStatus =
  | 'configuring_project'
  | 'selecting_simulator'
  | 'awaiting_request'
  | 'change_requested'
  | 'working'
  | 'variants_ready'
  | 'selection_confirmed'
  | 'closed';

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

export interface AgentChangeRequest {
  id: string;
  request: string;
  variantCount: number;
  context: AgentTurnContext;
  createdAt: string;
}

export interface AgentSessionSnapshot {
  id: string;
  project: MonadDesignProject;
  task?: string;
  status: AgentSessionStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  connection?: {
    udid: string;
    bundleIdentifier: string;
  };
  changeRequest?: AgentChangeRequest;
  publishedVariants?: {
    requestId: string;
    summary: string;
    publishedAt: string;
  };
  confirmedSelection?: {
    requestId: string;
    variant: SimulatorVariantId;
    confirmedAt: string;
  };
  lastResult?: {
    requestId: string;
    summary: string;
    completedAt: string;
  };
}

type ProjectResolver = Pick<ProjectStore, 'list' | 'open' | 'configureLiveTargets'>;
type SessionListener = (session: AgentSessionSnapshot) => void;

export interface AgentSessionStoreOptions {
  persistencePath?: string;
  onChanged?: SessionListener;
  restartApp?: (session: AgentSessionSnapshot) => Promise<void>;
}

const copySession = (session: AgentSessionSnapshot): AgentSessionSnapshot => structuredClone(session);
const canonicalPath = async (path: string) => realpath(resolve(path)).catch(() => resolve(path));
const sessionStatuses = new Set<AgentSessionStatus>([
  'configuring_project',
  'selecting_simulator',
  'awaiting_request',
  'change_requested',
  'working',
  'variants_ready',
  'selection_confirmed',
  'closed'
]);

interface PersistedAgentSessions {
  schemaVersion: 1;
  activeId: string | null;
  sessions: AgentSessionSnapshot[];
}

const isSessionSnapshot = (value: unknown): value is AgentSessionSnapshot => {
  const session = value as Partial<AgentSessionSnapshot>;
  return (
    typeof session?.id === 'string' &&
    sessionStatuses.has(session.status as AgentSessionStatus) &&
    typeof session.revision === 'number' &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    typeof session.project?.id === 'string' &&
    typeof session.project.path === 'string'
  );
};

export class AgentSessionStore {
  readonly #sessions = new Map<string, AgentSessionSnapshot>();
  readonly #waiters = new Map<string, Set<SessionListener>>();
  readonly #onChanged?: SessionListener;
  readonly #restartApp?: (session: AgentSessionSnapshot) => Promise<void>;
  readonly #persistencePath?: string;
  #activeId: string | null = null;

  constructor(
    private readonly projectStore: ProjectResolver,
    options: AgentSessionStoreOptions = {}
  ) {
    this.#onChanged = options.onChanged;
    this.#restartApp = options.restartApp;
    this.#persistencePath = options.persistencePath;
    this.#restore();
  }

  active() {
    return this.#activeId ? this.get(this.#activeId) : null;
  }

  get(id: string) {
    const session = this.#sessions.get(id);
    if (!session) throw new CoreApiError(404, 'NOT_FOUND', 'Agent session not found.');
    return copySession(session);
  }

  async create(workspacePath: string, task?: string) {
    const requestedPath = await canonicalPath(workspacePath);
    const projectPaths = await Promise.all(
      (await this.projectStore.list()).map(async (project) => ({
        project,
        path: await canonicalPath(project.path)
      }))
    );
    const project = projectPaths
      .filter(({ path }) => requestedPath === path || requestedPath.startsWith(`${path}${sep}`))
      .sort((left, right) => right.path.length - left.path.length)[0]?.project;
    if (!project) {
      throw new CoreApiError(
        404,
        'NOT_FOUND',
        'Monad Design project binding did not complete before live session creation.'
      );
    }

    if (this.#activeId) this.close(this.#activeId);
    const opened = await this.projectStore.open(project.id);
    const now = new Date().toISOString();
    const session: AgentSessionSnapshot = {
      id: randomUUID(),
      project: opened,
      ...(task?.trim() ? { task: task.trim() } : {}),
      status: opened.targetApps.every(({ live }) => Boolean(live)) ? 'selecting_simulator' : 'configuring_project',
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.#sessions.set(session.id, session);
    this.#activeId = session.id;
    this.#publish(session);
    return copySession(session);
  }

  async configureProject(id: string, targets: Parameters<ProjectStore['configureLiveTargets']>[1]) {
    const session = this.#requireStatus(id, ['configuring_project']);
    const project = await this.projectStore.configureLiveTargets(session.project.id, targets);
    return this.#update(session, { project, status: 'selecting_simulator' });
  }

  async wait(id: string, afterRevision: number, waitMs: number) {
    const current = this.get(id);
    if (current.revision > afterRevision || waitMs === 0) return current;

    return new Promise<AgentSessionSnapshot>((resolveWait) => {
      let listeners = this.#waiters.get(id);
      if (!listeners) {
        listeners = new Set();
        this.#waiters.set(id, listeners);
      }
      let timer: ReturnType<typeof setTimeout>;
      const listener = (session: AgentSessionSnapshot) => {
        clearTimeout(timer);
        listeners?.delete(listener);
        resolveWait(copySession(session));
      };
      listeners.add(listener);
      timer = setTimeout(() => {
        listeners?.delete(listener);
        resolveWait(this.get(id));
      }, waitMs);
    });
  }

  connected(id: string, connection: { udid: string; bundleIdentifier: string }) {
    const session = this.#requireStatus(id, ['selecting_simulator', 'awaiting_request']);
    if (!session.project.targetApps.some(({ bundleIdentifier }) => bundleIdentifier === connection.bundleIdentifier)) {
      throw new CoreApiError(409, 'CONFLICT', 'The connected app does not belong to this agent session project.');
    }
    return this.#update(session, {
      status: 'awaiting_request',
      connection,
      changeRequest: undefined
    });
  }

  request(
    id: string,
    input: {
      request: string;
      variantCount: number;
      context: Omit<AgentTurnContext, 'annotation'>;
      annotationScreenshot?: string;
    }
  ) {
    const session = this.#requireStatus(id, ['awaiting_request']);
    if (
      !session.connection ||
      input.context.simulator.udid !== session.connection.udid ||
      input.context.simulator.bundleIdentifier !== session.connection.bundleIdentifier
    ) {
      throw new CoreApiError(409, 'CONFLICT', 'The request context does not match the connected Simulator app.');
    }
    if (!Number.isInteger(input.variantCount) || input.variantCount < 1 || input.variantCount > 5) {
      throw new CoreApiError(400, 'VALIDATION', 'Variant count must be between 1 and 5.');
    }
    const now = new Date().toISOString();
    const requestId = randomUUID();
    let context: AgentTurnContext = structuredClone(input.context);
    if (input.annotationScreenshot) {
      const encoded = input.annotationScreenshot.slice('data:image/png;base64,'.length);
      const screenshot = Buffer.from(encoded, 'base64');
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (
        screenshot.length < pngSignature.length ||
        !screenshot.subarray(0, pngSignature.length).equals(pngSignature)
      ) {
        throw new CoreApiError(400, 'VALIDATION', 'The annotated screenshot is not a valid PNG.');
      }
      const annotationDirectory = join(session.project.path, '.monaddesign', 'tmp', 'annotations');
      const screenshotPath = join(annotationDirectory, `${requestId}.png`);
      mkdirSync(annotationDirectory, { recursive: true });
      writeFileSync(screenshotPath, screenshot, { mode: 0o600 });
      context = {
        ...context,
        annotation: { screenshotPath, mimeType: 'image/png' }
      };
    }
    return this.#update(session, {
      status: 'change_requested',
      changeRequest: {
        id: requestId,
        request: input.request.trim(),
        variantCount: input.variantCount,
        context,
        createdAt: now
      }
    });
  }

  claim(id: string, requestId: string) {
    const session = this.#requireRequest(id, requestId, ['change_requested']);
    return this.#update(session, { status: 'working' });
  }

  async publishVariants(id: string, requestId: string, summary: string) {
    const session = this.#requireRequest(id, requestId, ['working']);
    await this.#restartConnectedApp(session);
    return this.#update(session, {
      status: 'variants_ready',
      publishedVariants: {
        requestId,
        summary: summary.trim(),
        publishedAt: new Date().toISOString()
      },
      confirmedSelection: undefined
    });
  }

  confirmSelection(id: string, requestId: string, variant: SimulatorVariantId) {
    const session = this.#requireRequest(id, requestId, ['variants_ready']);
    const allowed = [
      'original',
      ...Array.from({ length: session.changeRequest?.variantCount ?? 0 }, (_, index) => `v${index + 1}`)
    ];
    if (!allowed.includes(variant)) {
      throw new CoreApiError(400, 'VALIDATION', 'The selected variant was not published for this request.');
    }
    return this.#update(session, {
      status: 'selection_confirmed',
      confirmedSelection: { requestId, variant, confirmedAt: new Date().toISOString() }
    });
  }

  async complete(id: string, requestId: string, summary: string) {
    const session = this.#requireRequest(id, requestId, ['selection_confirmed']);
    await this.#restartConnectedApp(session);
    const completedAt = new Date().toISOString();
    return this.#update(session, {
      status: 'awaiting_request',
      changeRequest: undefined,
      publishedVariants: undefined,
      confirmedSelection: undefined,
      lastResult: {
        requestId,
        summary: summary.trim(),
        completedAt
      }
    });
  }

  async #restartConnectedApp(session: AgentSessionSnapshot) {
    if (!session.connection) {
      throw new CoreApiError(409, 'CONFLICT', 'Choose and connect a Simulator before completing this change.');
    }
    if (!this.#restartApp) {
      throw new CoreApiError(409, 'CONFLICT', 'App restart is unavailable in this Monad Design runtime.');
    }
    await this.#restartApp(copySession(session));
  }

  close(id: string) {
    const session = this.#requireStatus(id, [
      'configuring_project',
      'selecting_simulator',
      'awaiting_request',
      'change_requested',
      'working',
      'variants_ready',
      'selection_confirmed'
    ]);
    const closed = this.#update(session, { status: 'closed', changeRequest: undefined });
    if (this.#activeId === id) this.#activeId = null;
    this.#persist();
    return closed;
  }

  #requireStatus(id: string, expected: AgentSessionStatus[]) {
    const session = this.#sessions.get(id);
    if (!session) throw new CoreApiError(404, 'NOT_FOUND', 'Agent session not found.');
    if (!expected.includes(session.status)) {
      throw new CoreApiError(409, 'CONFLICT', `Agent session is ${session.status}; expected ${expected.join(' or ')}.`);
    }
    return session;
  }

  #requireRequest(id: string, requestId: string, expected: AgentSessionStatus[]) {
    const session = this.#requireStatus(id, expected);
    if (session.changeRequest?.id !== requestId) {
      throw new CoreApiError(409, 'CONFLICT', 'This change request is no longer active.');
    }
    return session;
  }

  #update(session: AgentSessionSnapshot, patch: Partial<AgentSessionSnapshot>) {
    const updated: AgentSessionSnapshot = {
      ...session,
      ...patch,
      revision: session.revision + 1,
      updatedAt: new Date().toISOString()
    };
    this.#sessions.set(updated.id, updated);
    this.#publish(updated);
    return copySession(updated);
  }

  #publish(session: AgentSessionSnapshot) {
    const snapshot = copySession(session);
    this.#persist();
    this.#onChanged?.(snapshot);
    for (const listener of this.#waiters.get(session.id) ?? []) listener(snapshot);
    this.#waiters.delete(session.id);
  }

  #restore() {
    if (!this.#persistencePath) return;
    try {
      const value = JSON.parse(readFileSync(this.#persistencePath, 'utf8')) as Partial<PersistedAgentSessions>;
      if (value.schemaVersion !== 1 || !Array.isArray(value.sessions) || !value.sessions.every(isSessionSnapshot)) {
        return;
      }
      for (const session of value.sessions) this.#sessions.set(session.id, copySession(session));
      if (typeof value.activeId === 'string' && this.#sessions.get(value.activeId)?.status !== 'closed') {
        this.#activeId = value.activeId;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Invalid or partially written state is ignored; the next change replaces it atomically.
      }
    }
  }

  #persist() {
    if (!this.#persistencePath) return;
    const value: PersistedAgentSessions = {
      schemaVersion: 1,
      activeId: this.#activeId,
      sessions: [...this.#sessions.values()].map(copySession)
    };
    mkdirSync(dirname(this.#persistencePath), { recursive: true });
    const temporaryPath = `${this.#persistencePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, this.#persistencePath);
  }
}
