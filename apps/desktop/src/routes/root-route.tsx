import { EdgeAtmosphere } from '@monaddesign/ui/business/edge-atmosphere';
import { useRouterState } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import { DesktopAppProvider } from '@/desktop-app-provider';

const RouterDevtools =
  import.meta.env.VITE_ROUTER_DEVTOOLS === 'true'
    ? lazy(async () => {
        const { TanStackRouterDevtools } = await import('@tanstack/react-router-devtools');
        return { default: TanStackRouterDevtools };
      })
    : null;

export function RootRoute() {
  const showEdgeAtmosphere = useRouterState({ select: ({ location }) => location.pathname === '/' });

  return (
    <>
      <div className="app-shell">
        <EdgeAtmosphere active={showEdgeAtmosphere} />
        <DesktopAppProvider />
      </div>
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      )}
    </>
  );
}
