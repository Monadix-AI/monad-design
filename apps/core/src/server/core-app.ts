import type { ProjectTargetDetection } from '@monaddesign/client-contract';
import type { ProjectStore } from '../project-store';
import type { AgentSessionStore } from './agent-session-store';
import type { createMonadDesignMcpHandler } from './mcp-server';

import { node } from '@elysia/node';
import { healthResponseSchema, pairCoreRequestSchema, pairCoreResponseSchema } from '@monaddesign/client-contract';
import { Elysia } from 'elysia';

import { createAdminProjectRoutes } from './admin-project-routes';
import { createAgentSessionRoutes } from './agent-session-routes';
import { CoreApiError, projectHttpError, requestCorrelationId } from './api-error';
import { createProjectRoutes } from './project-routes';
import { createSimulatorRoutes } from './simulator-routes';

type CoreProjectStore = Pick<ProjectStore, 'list' | 'open' | 'add' | 'configureLiveTargets'> &
  Partial<Pick<ProjectStore, 'icons' | 'configure' | 'remove' | 'designDocument'>>;

export const createCoreApp = (
  projectStore: CoreProjectStore,
  pairingCode: string,
  mcp: ReturnType<typeof createMonadDesignMcpHandler>,
  agentSessions: AgentSessionStore,
  detectTargets: (path: string) => Promise<ProjectTargetDetection>,
  ui: ((pathname: string) => Response | Promise<Response>) | undefined
) => {
  const adapter = node();

  return new Elysia({ adapter, name: 'core.app' })
    .onRequest(({ set }) => {
      set.headers['access-control-allow-origin'] = '*';
      set.headers['access-control-allow-headers'] = 'content-type';
      set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    })
    .onError(({ code, error, set, status }) => {
      const requestId = requestCorrelationId();
      set.headers['x-monad-design-request-id'] = requestId;
      const publicError =
        code === 'NOT_FOUND'
          ? new CoreApiError(404, 'NOT_FOUND', 'not found')
          : code === 'PARSE' || code === 'VALIDATION'
            ? new CoreApiError(400, 'VALIDATION', 'request validation failed')
            : error;
      const mapped = projectHttpError(publicError, requestId);
      return status(mapped.status, mapped.body);
    })
    .options('/*', ({ status }) => status(204))
    .get('/', () => (ui ? ui('/') : new Response('not found', { status: 404 })))
    .get('/assets/*', ({ request }) =>
      ui ? ui(new URL(request.url).pathname) : new Response('not found', { status: 404 })
    )
    .all('/mcp', ({ body, request }) => mcp.fetch(request, request.method === 'POST' ? body : undefined))
    .group('/v1', (app) =>
      app
        .get(
          '/health',
          () => ({
            name: 'Monad Design Core' as const,
            protocolVersion: 1 as const,
            platform: process.platform,
            apiVersion: 'v1' as const
          }),
          { response: { 200: healthResponseSchema } }
        )
        .post(
          '/pair',
          ({ body }) => {
            if (body.pairingCode !== pairingCode) {
              throw new CoreApiError(409, 'PAIRING_MISMATCH', 'The pairing code does not match this Core.');
            }
            return { paired: true as const };
          },
          { body: pairCoreRequestSchema, response: { 200: pairCoreResponseSchema } }
        )
        .use(createAgentSessionRoutes(agentSessions))
        .use(createProjectRoutes(projectStore))
        .use(createAdminProjectRoutes(projectStore, detectTargets))
        .use(createSimulatorRoutes(projectStore, adapter))
    );
};

export type CoreApp = ReturnType<typeof createCoreApp>;
