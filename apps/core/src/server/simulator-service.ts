import type { SimulatorConnectStatus } from '@monaddesign/client-contract';
import type { ProjectStore } from '../project-store';

import { createSharedOperation } from '../shared-operation';
import { simulatorBridge } from '../simulator-bridge';
import { buildAndInstallSimulatorApp } from '../simulator-build';
import {
  ensureSimulatorAppInstalled,
  ensureSimulatorBooted,
  launchSimulatorApp,
  launchSimulatorVariant,
  SimulatorAppNotInstalledError
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

export const createSimulatorService = (
  projectStore: ProjectResolver,
  dependencies = {
    ensureSimulatorBooted,
    ensureSimulatorAppInstalled,
    buildAndInstallSimulatorApp,
    launchSimulatorApp,
    connectBridge: simulatorBridge.connect.bind(simulatorBridge)
  }
) => {
  let active: { key: string; phase: SimulatorConnectStatus['phase'] } | null = null;
  const keyFor = (projectId: string, udid: string, bundleIdentifier: string) =>
    `${projectId}\0${udid}\0${bundleIdentifier}`;
  const connect = createSharedOperation(
    async (projectId: string, udid: string, bundleIdentifier: string, rebuild = false) => {
      if (active) throw new CoreApiError(409, 'CONFLICT', 'Another Simulator connection is in progress.');
      const operation = {
        key: keyFor(projectId, udid, bundleIdentifier),
        phase: 'preparing' as SimulatorConnectStatus['phase']
      };
      active = operation;
      try {
        const project = await projectStore.open(projectId);
        const target = project.targetApps.find((app) => app.bundleIdentifier === bundleIdentifier);
        if (!target) {
          throw new CoreApiError(404, 'NOT_FOUND', 'The requested project target app is not available.');
        }
        await dependencies.ensureSimulatorBooted(udid);
        operation.phase = 'checking';
        let needsBuild = rebuild;
        if (!needsBuild) {
          try {
            await dependencies.ensureSimulatorAppInstalled(udid, target.bundleIdentifier);
          } catch (error) {
            if (!(error instanceof SimulatorAppNotInstalledError)) throw error;
            needsBuild = true;
          }
        }
        if (needsBuild) {
          await dependencies.buildAndInstallSimulatorApp(project, target, udid, (phase) => {
            operation.phase = phase;
          });
          await dependencies.ensureSimulatorAppInstalled(udid, target.bundleIdentifier);
        }
        operation.phase = 'connecting';
        await dependencies.launchSimulatorApp(udid, target.bundleIdentifier);
        return await dependencies.connectBridge(udid, {
          projectId: project.id,
          bundleIdentifier: target.bundleIdentifier
        });
      } finally {
        active = null;
      }
    },
    {
      key: (projectId, udid, bundleIdentifier, rebuild) =>
        `${keyFor(projectId, udid, bundleIdentifier)}\0${Boolean(rebuild)}`
    }
  );

  return {
    connect,
    status(projectId: string, udid: string, bundleIdentifier: string): SimulatorConnectStatus {
      return { phase: active?.key === keyFor(projectId, udid, bundleIdentifier) ? active.phase : 'preparing' };
    },

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
