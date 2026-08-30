import type { AgentSessionSnapshot } from './server/agent-session-store';

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { ProjectStore } from './project-store';
import { AgentSessionStore, createCoreServer } from './server';
import { simulatorBridge } from './simulator-bridge';
import { launchSimulatorApp } from './simulators';

export interface CoreRuntimeOptions {
  stateDirectory: string;
  host?: string;
  port?: number;
  localAccessToken?: string;
  onSessionChanged?: (session: AgentSessionSnapshot) => void;
  ui?: (pathname: string) => Response | Promise<Response>;
}

export const createCoreRuntime = async ({
  stateDirectory,
  host,
  port,
  localAccessToken,
  onSessionChanged,
  ui
}: CoreRuntimeOptions) => {
  await mkdir(stateDirectory, { recursive: true });
  const projectStore = new ProjectStore(join(stateDirectory, 'projects.json'));
  const agentSessions = new AgentSessionStore(projectStore, {
    persistencePath: join(stateDirectory, 'agent-sessions.json'),
    onChanged: onSessionChanged,
    restartApp: async (session) => {
      const connection = simulatorBridge.connection;
      if (
        !connection ||
        connection.projectId !== session.project.id ||
        connection.udid !== session.connection?.udid ||
        connection.bundleIdentifier !== session.connection.bundleIdentifier
      ) {
        throw new Error('The Simulator connection for this agent session is no longer active.');
      }
      await launchSimulatorApp(connection.udid, connection.bundleIdentifier);
    }
  });
  const server = createCoreServer(projectStore, {
    host,
    port,
    localAccessToken,
    pairingStatePath: join(stateDirectory, 'pairing.json'),
    agentSessions,
    ui
  });

  return {
    agentSessions,
    projectStore,
    server,
    async start() {
      await server.start();
      return { localClient: server.localClient, status: server.status };
    },
    async stop() {
      await simulatorBridge.disconnect();
      await server.stop();
    }
  };
};

export type CoreRuntime = Awaited<ReturnType<typeof createCoreRuntime>>;
