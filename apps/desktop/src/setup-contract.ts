import type { InstallScope, IntegrationStatus, SupportedAgent } from '@monaddesign/agent-integration';

export interface SetupState {
  phase: 'preparing' | 'ready' | 'error';
  error?: string;
  notice?: string | null;
  completed: boolean;
}
export interface SetupApi {
  status(): Promise<SetupState>;
  retry(): Promise<SetupState>;
  scan(scope: InstallScope): Promise<IntegrationStatus[]>;
  chooseProject(): Promise<string | null>;
  install(input: { agents: SupportedAgent[]; scope: InstallScope; replaceModified: boolean }): Promise<
    {
      agent: string;
      success: boolean;
      error?: string;
      skillPath?: string | null;
      mcpPath?: string | null;
      instructions?: string;
    }[]
  >;
  complete(): Promise<void>;
  exportKimiWork(): Promise<string>;
}
