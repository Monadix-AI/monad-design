import { Redirect, router } from 'expo-router';

import { SimulatorPicker } from '../src/screens/SimulatorPicker';
import { useSession } from '../src/session';

export default function SimulatorsRoute() {
  const { api, closeProject, openSession, project } = useSession();
  if (!api) return <Redirect href="/" />;
  if (!project) return <Redirect href="/" />;
  return (
    <SimulatorPicker
      onBack={() => {
        closeProject();
        router.replace('/');
      }}
      onConnected={(simulator, connection) => {
        openSession({ simulator, connection });
        router.push('/workspace');
      }}
      project={project}
    />
  );
}
