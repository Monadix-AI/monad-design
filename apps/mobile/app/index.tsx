import { router } from 'expo-router';

import { ClientSetup } from '../src/screens/ClientSetup';
import { LoadingScreen } from '../src/screens/LoadingScreen';
import { ProjectPicker } from '../src/screens/ProjectPicker';
import { useSession } from '../src/session';

export default function ConnectRoute() {
  const { api, connectClient, forgetClient, hydrated, openProject, savedClient } = useSession();
  if (!hydrated) return <LoadingScreen />;
  if (api) {
    return (
      <ProjectPicker
        onForget={() => void forgetClient()}
        onOpen={(project) => {
          openProject(project);
          router.push('/simulators');
        }}
      />
    );
  }
  return (
    <ClientSetup
      initial={savedClient}
      onConnected={(api) => {
        connectClient(api);
      }}
    />
  );
}
