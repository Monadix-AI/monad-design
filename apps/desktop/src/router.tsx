import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  ErrorComponent,
  lazyRouteComponent
} from '@tanstack/react-router';

import { RootRoute } from './routes/root-route';
import { showViteRuntimeOverlay } from './vite-runtime-overlay';

const rootRoute = createRootRoute({
  component: RootRoute
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./routes/simulators-route'), 'SimulatorsRoute')
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace',
  component: lazyRouteComponent(() => import('./routes/workspace-route'), 'WorkspaceRoute')
});

const routeTree = rootRoute.addChildren([indexRoute, workspaceRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: ErrorComponent,
  defaultOnCatch: showViteRuntimeOverlay
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
