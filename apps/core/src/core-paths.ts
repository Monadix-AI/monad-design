import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CorePathsEnvironment {
  MONAD_DESIGN_CORE_BOOTSTRAP_PATH?: string;
  MONAD_DESIGN_CORE_EXECUTABLE_PATH?: string;
  MONAD_DESIGN_CORE_STATE_DIR?: string;
}

export const resolveCorePaths = (environment: CorePathsEnvironment = process.env as CorePathsEnvironment) => {
  const stateDirectory =
    environment.MONAD_DESIGN_CORE_STATE_DIR ?? join(homedir(), 'Library', 'Application Support', 'Monad Design Core');
  return {
    stateDirectory,
    bootstrapPath: environment.MONAD_DESIGN_CORE_BOOTSTRAP_PATH ?? join(stateDirectory, 'bootstrap.json'),
    credentialsPath: join(stateDirectory, 'credentials.json'),
    executablePath: environment.MONAD_DESIGN_CORE_EXECUTABLE_PATH ?? join(stateDirectory, 'bin', 'monad-design-core'),
    lockPath: join(stateDirectory, 'core.lock'),
    sessionsPath: join(stateDirectory, 'agent-sessions.json')
  };
};
