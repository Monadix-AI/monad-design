import type { ClientApi } from './api';
import type { ClientConnection, IOSSimulator, RemoteProject, SimulatorConnection } from './types';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Provider } from 'react-redux';

export const savedClientKey = 'monaddesign.remote-client.v1';

interface SimulatorSession {
  simulator: IOSSimulator;
  connection: SimulatorConnection;
}

interface SessionContextValue {
  api: ClientApi | null;
  hydrated: boolean;
  savedClient: ClientConnection | null;
  project: RemoteProject | null;
  session: SimulatorSession | null;
  connectClient: (api: ClientApi) => void;
  forgetClient: () => Promise<void>;
  openProject: (project: RemoteProject) => void;
  closeProject: () => void;
  openSession: (session: SimulatorSession) => void;
  closeSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [savedClient, setSavedClient] = useState<ClientConnection | null>(null);
  const [api, setApi] = useState<ClientApi | null>(null);
  const [project, setProject] = useState<RemoteProject | null>(null);
  const [session, setSession] = useState<SimulatorSession | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(savedClientKey)
      .then((value) => {
        if (!value) return;
        try {
          setSavedClient(JSON.parse(value) as ClientConnection);
        } catch {
          void AsyncStorage.removeItem(savedClientKey);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      api,
      hydrated,
      savedClient,
      project,
      session,
      connectClient: (nextApi) => {
        setApi(nextApi);
        setSavedClient(nextApi.connection);
      },
      forgetClient: async () => {
        setSession(null);
        setProject(null);
        setApi(null);
        setSavedClient(null);
        await AsyncStorage.removeItem(savedClientKey);
      },
      openProject: setProject,
      closeProject: () => {
        setSession(null);
        setProject(null);
      },
      openSession: setSession,
      closeSession: () => setSession(null)
    }),
    [api, hydrated, project, savedClient, session]
  );

  return (
    <SessionContext.Provider value={value}>
      {api ? <Provider store={api.store}>{children}</Provider> : children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider.');
  return context;
}
