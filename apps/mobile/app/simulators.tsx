import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

import { SimulatorPicker } from '../src/screens/SimulatorPicker';
import { useSession } from '../src/session';

export default function SimulatorsRoute() {
  const { api, closeProject, openSession, project } = useSession();
  // Keep the outgoing screen intact until the native pop finishes unmounting it.
  useEffect(() => closeProject, [closeProject]);
  if (!api) return <Redirect href="/" />;
  if (!project) return <Redirect href="/" />;
  return (
    <SimulatorPicker
      onBack={() => {
        router.dismissTo('/');
      }}
      onConnected={(simulator, connection) => {
        openSession({ simulator, connection });
        router.push('/workspace');
      }}
      project={project}
    />
  );
}
