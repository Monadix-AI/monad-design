import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const useSimulatorLifecycle = () => {
  const [lifecycle, setLifecycle] = useState({
    active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    revision: 0
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setLifecycle((current) =>
        current.active === active ? current : { active, revision: current.revision + (active ? 1 : 0) }
      );
    });
    return () => subscription.remove();
  }, []);

  return lifecycle;
};
