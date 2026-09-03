import type { AgentSessionSnapshot, AgentSessionStore } from './agent-session-store';

import {
  activeAgentSessionResponseSchema,
  agentSessionSnapshotSchema,
  confirmAgentSelectionRequestSchema,
  connectAgentSessionRequestSchema,
  reportVariantCaptureFailureRequestSchema,
  submitAgentRequestSchema
} from '@monaddesign/client-contract';
import { Elysia, t } from 'elysia';

const publicSession = (session: AgentSessionSnapshot): typeof agentSessionSnapshotSchema._output => ({
  ...session,
  project: {
    id: session.project.id,
    name: session.project.name,
    lastOpenedAt: session.project.lastOpenedAt,
    targetApps: session.project.targetApps.map(({ bundleIdentifier, name, sourcePath }) => ({
      bundleIdentifier,
      name,
      ...(sourcePath ? { sourcePath } : {})
    }))
  }
});

export const createAgentSessionRoutes = (sessions: AgentSessionStore) =>
  new Elysia({ name: 'core.agent-sessions', prefix: '/agent-session' })
    .get(
      '/active',
      () => {
        const session = sessions.active();
        return { session: session ? publicSession(session) : null };
      },
      { response: { 200: activeAgentSessionResponseSchema } }
    )
    .post('/:id/connected', ({ body, params: { id } }) => publicSession(sessions.connected(id, body)), {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      body: connectAgentSessionRequestSchema,
      response: { 200: agentSessionSnapshotSchema }
    })
    .post('/:id/request', async ({ body, params: { id } }) => publicSession(await sessions.request(id, body)), {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      body: submitAgentRequestSchema,
      response: { 200: agentSessionSnapshotSchema }
    })
    .post('/:id/close', async ({ params: { id } }) => publicSession(await sessions.close(id)), {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      response: { 200: agentSessionSnapshotSchema }
    })
    .post(
      '/:id/capture-failure',
      ({ body: { message, requestId, variant }, params: { id } }) =>
        publicSession(sessions.reportCaptureFailure(id, requestId, variant, message)),
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        body: reportVariantCaptureFailureRequestSchema,
        response: { 200: agentSessionSnapshotSchema }
      }
    )
    .post(
      '/:id/confirm-selection',
      ({ body: { requestId, variant }, params: { id } }) =>
        publicSession(sessions.confirmSelection(id, requestId, variant)),
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        body: confirmAgentSelectionRequestSchema,
        response: { 200: agentSessionSnapshotSchema }
      }
    );
