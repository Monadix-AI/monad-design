import type { MonadDesignProject, ProjectStore } from '../project-store';

import {
  listProjectsResponseSchema,
  openProjectRequestSchema,
  paginationQuerySchema,
  projectIconsResponseSchema,
  remoteProjectSchema
} from '@monaddesign/client-contract';
import { Elysia } from 'elysia';

import { CoreApiError } from './api-error';

type ProjectResolver = Pick<ProjectStore, 'list' | 'open'> & Partial<Pick<ProjectStore, 'icons'>>;

const projectResponse = ({ id, name, lastOpenedAt, targetApps }: MonadDesignProject) => ({
  id,
  name,
  lastOpenedAt,
  targetApps
});

export const createProjectRoutes = (projectStore: ProjectResolver) =>
  new Elysia({ name: 'core.projects', prefix: '/projects' })
    .get(
      '/',
      async ({ query: { limit, offset } }) => {
        const projects = (await projectStore.list()).map(projectResponse);
        return {
          projects: projects.slice(offset, offset + limit),
          limit,
          offset,
          total: projects.length
        };
      },
      {
        query: paginationQuerySchema,
        response: { 200: listProjectsResponseSchema }
      }
    )
    .get(
      '/:id/icons',
      async ({ params: { id } }) => {
        const project = (await projectStore.list()).find((item) => item.id === id);
        if (!project) {
          throw new CoreApiError(404, 'NOT_FOUND', 'Project not found.');
        }
        return { icons: projectStore.icons ? await projectStore.icons(id) : {} };
      },
      {
        params: openProjectRequestSchema,
        response: { 200: projectIconsResponseSchema }
      }
    )
    .post(
      '/:id/open',
      async ({ params: { id } }) => {
        const project = (await projectStore.list()).find((item) => item.id === id);
        if (!project) {
          throw new CoreApiError(404, 'NOT_FOUND', 'Project not found.');
        }
        return projectResponse(await projectStore.open(id));
      },
      {
        params: openProjectRequestSchema,
        response: { 200: remoteProjectSchema }
      }
    );
