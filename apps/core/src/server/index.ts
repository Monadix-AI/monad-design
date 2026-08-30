import type { ProjectStore } from '../project-store';

import { CoreServer, type CoreServerOptions } from './core-server';

export type { AgentSessionSnapshot, AgentSessionStatus } from './agent-session-store';
export type { CoreServerStatus } from './core-server';

export { AgentSessionStore } from './agent-session-store';
export { CoreServer } from './core-server';

export const createCoreServer = (
  projectStore: Pick<ProjectStore, 'list' | 'open' | 'add' | 'configureLiveTargets'> &
    Partial<Pick<ProjectStore, 'icons' | 'configure' | 'remove'>>,
  options?: CoreServerOptions
) => {
  return new CoreServer(projectStore, options);
};
