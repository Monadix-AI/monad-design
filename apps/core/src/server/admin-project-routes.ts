import type { ProjectStore } from '../project-store';

import {
  addCoreProjectRequestSchema,
  configureCoreProjectRequestSchema,
  coreProjectListResponseSchema,
  coreProjectSchema,
  detectProjectTargetsRequestSchema,
  openProjectRequestSchema,
  projectTargetDetectionSchema,
  removedProjectResponseSchema
} from '@monaddesign/client-contract';
import { Elysia } from 'elysia';

type AdminProjectStore = Pick<ProjectStore, 'list' | 'open' | 'add'> &
  Partial<Pick<ProjectStore, 'configure' | 'remove'>>;

export const createAdminProjectRoutes = (
  projectStore: AdminProjectStore,
  detectTargets: (path: string) => Promise<typeof projectTargetDetectionSchema._output>
) =>
  new Elysia({ name: 'core.admin-projects', prefix: '/admin/projects' })
    .get('/', async () => ({ projects: await projectStore.list() }), {
      response: { 200: coreProjectListResponseSchema }
    })
    .post('/detect-targets', ({ body: { path } }) => detectTargets(path), {
      body: detectProjectTargetsRequestSchema,
      response: { 200: projectTargetDetectionSchema }
    })
    .post('/', ({ body: { path, targetApps } }) => projectStore.add(path, targetApps), {
      body: addCoreProjectRequestSchema,
      response: { 200: coreProjectSchema }
    })
    .put(
      '/:id',
      ({ body: { targetApps }, params: { id } }) => {
        if (!projectStore.configure) throw new Error('Project configuration is not available.');
        return projectStore.configure(id, targetApps);
      },
      {
        params: openProjectRequestSchema,
        body: configureCoreProjectRequestSchema,
        response: { 200: coreProjectSchema }
      }
    )
    .post('/:id/open', ({ params: { id } }) => projectStore.open(id), {
      params: openProjectRequestSchema,
      response: { 200: coreProjectSchema }
    })
    .delete(
      '/:id',
      async ({ params: { id } }) => {
        if (!projectStore.remove) throw new Error('Project removal is not available.');
        await projectStore.remove(id);
        return { removed: true as const };
      },
      {
        params: openProjectRequestSchema,
        response: { 200: removedProjectResponseSchema }
      }
    );
