import { Redirect, router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { Workspace } from '../src/screens/Workspace';
import { useSession } from '../src/session';

export default function WorkspaceRoute() {
  const { api, closeSession, session } = useSession();
  const currentSession = useRef({ api, session });
  const ownedSession = useRef(session);
  const exited = useRef(false);
  currentSession.current = { api, session };
  if (!ownedSession.current && session) ownedSession.current = session;
  useEffect(
    () => () => {
      if (!exited.current && ownedSession.current === currentSession.current.session) {
        void currentSession.current.api?.disconnect().catch(() => undefined);
      }
      closeSession(ownedSession.current);
    },
    [closeSession]
  );
  if (!api) return <Redirect href="/" />;
  if (!session) return <Redirect href="/simulators" />;
  return (
    <Workspace
      api={api}
      key={session.revision}
      {...session}
      onExit={() => {
        exited.current = true;
        router.dismissTo('/simulators');
      }}
    />
  );
}
