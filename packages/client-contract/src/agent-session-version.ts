export interface AgentSessionRevision {
  id: string;
  revision: number;
}

export const agentSessionVersion = (session: AgentSessionRevision | null) =>
  session ? `${session.id}\0${session.revision}` : null;
