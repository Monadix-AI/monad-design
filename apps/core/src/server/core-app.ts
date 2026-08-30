import type { ProjectStore } from '../project-store';
import type { AgentSessionStore } from './agent-session-store';
import type { createMonadDesignMcpHandler } from './mcp-server';

import { node } from '@elysia/node';
import { Elysia } from 'elysia';

import { createAdminProjectRoutes } from './admin-project-routes';
import { createAgentSessionRoutes } from './agent-session-routes';
import { healthResponseSchema } from './api-contract';
import { CoreApiError, projectHttpError, requestCorrelationId } from './api-error';
import { createProjectRoutes } from './project-routes';
import { createSimulatorRoutes } from './simulator-routes';

type CoreProjectStore = Pick<ProjectStore, 'list' | 'open' | 'add' | 'configureLiveTargets'> &
  Partial<Pick<ProjectStore, 'icons' | 'configure' | 'remove'>>;

export const createCoreApp = (
  projectStore: CoreProjectStore,
  accessTokens: string | readonly string[],
  adminAccessToken: string,
  mcp: ReturnType<typeof createMonadDesignMcpHandler>,
  agentSessions: AgentSessionStore,
  detectTargets: (path: string) => Promise<import('./api-contract').ProjectTargetDetection>,
  ui: ((pathname: string) => Response | Promise<Response>) | undefined
) => {
  const adapter = node();

  return new Elysia({ adapter, name: 'core.app' })
    .onRequest(({ set }) => {
      set.headers['access-control-allow-origin'] = '*';
      set.headers['access-control-allow-headers'] =
        'authorization, content-type, x-monad-design-client-id, x-monad-design-client-kind';
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
        .use(createAgentSessionRoutes(agentSessions, accessTokens))
        .use(createProjectRoutes(projectStore, accessTokens))
        .use(createAdminProjectRoutes(projectStore, adminAccessToken, detectTargets))
        .use(createSimulatorRoutes(projectStore, accessTokens, adapter))
    );
};

export type CoreApp = ReturnType<typeof createCoreApp>;
