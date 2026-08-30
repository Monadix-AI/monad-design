import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { RootRoute } from './routes/root-route';
import { SimulatorsRoute } from './routes/simulators-route';
import { WorkspaceRoute } from './routes/workspace-route';

const rootRoute = createRootRoute({
  component: RootRoute
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SimulatorsRoute
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace',
  component: WorkspaceRoute
});

const routeTree = rootRoute.addChildren([indexRoute, workspaceRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory()
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
