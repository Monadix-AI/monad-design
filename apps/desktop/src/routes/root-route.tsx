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
  return (
    <>
      <DesktopAppProvider />
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      )}
    </>
  );
}
