import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

import { DesktopAppProvider } from '@/desktop-app-provider';

export function RootRoute() {
  return (
    <>
      <DesktopAppProvider />
      {import.meta.env.VITE_ROUTER_DEVTOOLS === 'true' && <TanStackRouterDevtools />}
    </>
  );
}
