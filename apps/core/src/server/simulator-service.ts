import type { ProjectStore } from '../project-store';

import { createSharedOperation } from '../shared-operation';
import { simulatorBridge } from '../simulator-bridge';
import {
  ensureSimulatorAppInstalled,
  ensureSimulatorBooted,
  launchSimulatorApp,
  launchSimulatorVariant
} from '../simulators';
import { CoreApiError } from './api-error';

type ProjectResolver = Pick<ProjectStore, 'open'>;

const connectedTarget = () => {
  const connection = simulatorBridge.connection;
  if (!connection) {
    throw new CoreApiError(409, 'CONFLICT', 'Connect to a simulator first.');
  }
  return connection;
};

export const createSimulatorService = (projectStore: ProjectResolver) => {
  const connect = createSharedOperation(
    async (projectId: string, udid: string, bundleIdentifier: string) => {
      const project = await projectStore.open(projectId);
      const target = project.targetApps.find((app) => app.bundleIdentifier === bundleIdentifier);
      if (!target) {
        throw new CoreApiError(404, 'NOT_FOUND', 'The requested project target app is not available.');
      }
      await ensureSimulatorBooted(udid);
      await ensureSimulatorAppInstalled(udid, target.bundleIdentifier);
      await launchSimulatorApp(udid, target.bundleIdentifier);
      return simulatorBridge.connect(udid, {
        projectId: project.id,
        bundleIdentifier: target.bundleIdentifier
      });
    },
    { key: (projectId, udid, bundleIdentifier) => `${projectId}\0${udid}\0${bundleIdentifier}` }
  );

  return {
    connect,

    launchApp() {
      const { udid, bundleIdentifier } = connectedTarget();
      return launchSimulatorApp(udid, bundleIdentifier);
    },

    launchVariant(variant: 'original' | 'v1' | 'v2' | 'v3' | 'v4' | 'v5') {
      const { udid, bundleIdentifier } = connectedTarget();
      return launchSimulatorVariant(udid, bundleIdentifier, variant);
    }
  };
};
