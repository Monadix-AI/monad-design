import type {
  AgentSessionStatus,
  AgentTurnContext,
  ConfirmAgentSelectionRequest,
  AgentSessionSnapshot as PublicAgentSessionSnapshot
} from '@monaddesign/client-contract';
import type { MonadDesignProject, ProjectStore } from '../project-store';

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';

import { CoreApiError } from './api-error';

export type { AgentSessionStatus, AgentTurnContext } from '@monaddesign/client-contract';

export type AgentChangeRequest = NonNullable<PublicAgentSessionSnapshot['changeRequest']>;
type SimulatorVariantId = ConfirmAgentSelectionRequest['variant'];

export interface AgentSessionSnapshot extends Omit<PublicAgentSessionSnapshot, 'project'> {
  project: MonadDesignProject;
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
const annotationFileNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/iu;
const annotationTemporaryFileNamePattern = /^[0-9a-f-]{36}\.png\.\d+\.[0-9a-f-]{36}\.tmp$/iu;
const maximumAnnotationScreenshotBytes = 30_000_000;
const retainedClosedSessionCount = 20;
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

    if (this.#activeId) await this.close(this.#activeId);
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
      const removeListener = () => {
        listeners?.delete(listener);
        if (listeners?.size === 0) this.#waiters.delete(id);
      };
      const listener = (session: AgentSessionSnapshot) => {
        clearTimeout(timer);
        removeListener();
        resolveWait(copySession(session));
      };
      listeners.add(listener);
      timer = setTimeout(() => {
        removeListener();
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

  async request(
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
    let screenshotPath: string | undefined;
    try {
      let context: AgentTurnContext = structuredClone(input.context);
      if (input.annotationScreenshot) {
        screenshotPath = await this.#persistAnnotation(session, requestId, input.annotationScreenshot);
        context = {
          ...context,
          annotation: { screenshotPath, mimeType: 'image/png' }
        };
      }
      const current = this.#requireStatus(id, ['awaiting_request']);
      if (current.revision !== session.revision) {
        throw new CoreApiError(409, 'CONFLICT', 'This agent session changed while the request was being stored.');
      }
      return this.#update(current, {
        status: 'change_requested',
        changeRequest: {
          id: requestId,
          request: input.request.trim(),
          variantCount: input.variantCount,
          context,
          createdAt: now
        }
      });
    } catch (error) {
      if (screenshotPath) await unlink(screenshotPath).catch(() => undefined);
      throw error;
    }
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
    const updated = this.#update(session, {
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
    await this.#removeAnnotation(session);
    return updated;
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

  async close(id: string) {
    const session = this.#requireStatus(id, [
      'configuring_project',
      'selecting_simulator',
      'awaiting_request',
      'change_requested',
      'working',
      'variants_ready',
      'selection_confirmed'
    ]);
    if (this.#activeId === id) this.#activeId = null;
    const updated = this.#update(session, { status: 'closed', changeRequest: undefined });
    await this.#removeAnnotation(session);
    return updated;
  }

  async #persistAnnotation(session: AgentSessionSnapshot, requestId: string, dataUrl: string) {
    const prefix = 'data:image/png;base64,';
    if (!dataUrl.startsWith(prefix)) {
      throw new CoreApiError(400, 'VALIDATION', 'The annotated screenshot is not a valid PNG.');
    }
    const screenshot = Buffer.from(dataUrl.slice(prefix.length), 'base64');
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (
      screenshot.length < pngSignature.length ||
      screenshot.length > maximumAnnotationScreenshotBytes ||
      !screenshot.subarray(0, pngSignature.length).equals(pngSignature)
    ) {
      throw new CoreApiError(400, 'VALIDATION', 'The annotated screenshot is not a valid PNG.');
    }

    const annotationDirectory = join(session.project.path, '.monaddesign', 'tmp', 'annotations');
    await mkdir(annotationDirectory, { recursive: true });
    await this.#pruneAnnotations(annotationDirectory);
    const screenshotPath = join(annotationDirectory, `${requestId}.png`);
    const temporaryPath = `${screenshotPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, screenshot, { mode: 0o600 });
      await rename(temporaryPath, screenshotPath);
      return screenshotPath;
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async #pruneAnnotations(annotationDirectory: string) {
    const protectedPaths = new Set(
      [...this.#sessions.values()].flatMap(({ changeRequest }) =>
        changeRequest?.context.annotation?.screenshotPath
          ? [resolve(changeRequest.context.annotation.screenshotPath)]
          : []
      )
    );
    const entries = await readdir(annotationDirectory, { withFileTypes: true }).catch(() => []);
    await Promise.all(
      entries.flatMap((entry) => {
        if (
          !entry.isFile() ||
          (!annotationFileNamePattern.test(entry.name) && !annotationTemporaryFileNamePattern.test(entry.name))
        ) {
          return [];
        }
        const path = resolve(annotationDirectory, entry.name);
        return protectedPaths.has(path) ? [] : [unlink(path).catch(() => undefined)];
      })
    );
  }

  async #removeAnnotation(session: AgentSessionSnapshot) {
    const screenshotPath = session.changeRequest?.context.annotation?.screenshotPath;
    if (!screenshotPath || !annotationFileNamePattern.test(basename(screenshotPath))) return;
    const annotationDirectory = resolve(session.project.path, '.monaddesign', 'tmp', 'annotations');
    if (dirname(resolve(screenshotPath)) !== annotationDirectory) return;
    await unlink(screenshotPath).catch(() => undefined);
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
    this.#pruneClosedSessions();
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
      this.#pruneClosedSessions();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Invalid or partially written state is ignored; the next change replaces it atomically.
      }
    }
  }

  #pruneClosedSessions() {
    const expired = [...this.#sessions.values()]
      .filter(({ status }) => status === 'closed')
      .reverse()
      .slice(retainedClosedSessionCount);
    for (const session of expired) {
      this.#sessions.delete(session.id);
      this.#waiters.delete(session.id);
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
