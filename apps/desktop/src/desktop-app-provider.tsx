import { Outlet } from '@tanstack/react-router';
import { createContext, type ReactNode, useContext } from 'react';

import { useDesktopController } from './desktop-controller';

export type DesktopAppContextValue = ReturnType<typeof useDesktopController>;

const DesktopAppContext = createContext<DesktopAppContextValue | null>(null);

export function useDesktopApp() {
  const context = useContext(DesktopAppContext);
  if (!context) {
    throw new Error('useDesktopApp must be used inside DesktopAppProvider.');
  }
  return context;
}

export function DesktopAppProvider({ children }: { children?: ReactNode }) {
  const value = useDesktopController();
  return <DesktopAppContext.Provider value={value}>{children ?? <Outlet />}</DesktopAppContext.Provider>;
}
