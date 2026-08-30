import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

import { Workspace } from '../src/App';
import { useSession } from '../src/session';

export default function WorkspaceRoute() {
  const { api, closeSession, session } = useSession();
  useEffect(
    () => () => {
      if (session) void api?.disconnect().catch(() => undefined);
      closeSession();
    },
    [api, closeSession, session]
  );
  if (!api) return <Redirect href="/" />;
  if (!session) return <Redirect href="/simulators" />;
  return (
    <Workspace
      api={api}
      {...session}
      onExit={() => {
        closeSession();
        router.replace('/simulators');
      }}
    />
  );
}
