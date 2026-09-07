import type { ClientApi } from '@monaddesign/client-rtk/client-api';

import { useLiveSession } from '@monaddesign/client-rtk/use-live-session';
import { useSimulators } from '@monaddesign/client-rtk/use-simulators';

export const useCoreLiveSession = (
  client: ClientApi,
  onError: (message: string) => void,
  isChoosingSimulator = false
) => {
  const liveSession = useLiveSession({ client, onError, pollIntervalMs: 1_000, pauseWhenHidden: true });
  const simulatorState = useSimulators({
    autoScan: true,
    client,
    enabled: Boolean(liveSession.session),
    onError,
    pollIntervalMs: liveSession.session?.connection && !isChoosingSimulator ? 5_000 : 1_000,
    pauseWhenHidden: true
  });

  return { ...liveSession, ...simulatorState };
};
