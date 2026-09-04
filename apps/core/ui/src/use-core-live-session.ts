import type { ClientApi } from '@monaddesign/client-rtk/client-api';

import { useLiveSession } from '@monaddesign/client-rtk/use-live-session';
import { useSimulators } from '@monaddesign/client-rtk/use-simulators';

export const useCoreLiveSession = (client: ClientApi, onError: (message: string) => void) => {
  const liveSession = useLiveSession({ client, onError, pollIntervalMs: 800 });
  const simulatorState = useSimulators({
    autoScan: true,
    client,
    enabled: Boolean(liveSession.session),
    onError,
    pollIntervalMs: 800
  });

  return { ...liveSession, ...simulatorState };
};
