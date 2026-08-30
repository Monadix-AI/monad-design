import { createStore } from 'zustand/vanilla';

export type CopyStatus = 'idle' | 'copied' | 'error';

export interface WorkspaceState {
  selectionMode: boolean;
  selectedElementPath: string | null;
  agentRequest: string;
  copyStatus: CopyStatus;
  setSelectionMode: (enabled: boolean) => void;
  setSelectedElementPath: (next: string | null | ((current: string | null) => string | null)) => void;
  setAgentRequest: (request: string) => void;
  setCopyStatus: (status: CopyStatus) => void;
  resetWorkspaceState: () => void;
}

export const initialWorkspaceState = {
  selectionMode: false,
  selectedElementPath: null,
  agentRequest: '',
  copyStatus: 'idle' as CopyStatus
};

export const workspaceStore = createStore<WorkspaceState>((set) => ({
  ...initialWorkspaceState,
  setSelectionMode: (selectionMode) =>
    set(
      selectionMode
        ? { selectionMode }
        : {
            selectionMode,
            selectedElementPath: null,
            agentRequest: '',
            copyStatus: 'idle'
          }
    ),
  setSelectedElementPath: (next) =>
    set((state) => {
      const selectedElementPath = typeof next === 'function' ? next(state.selectedElementPath) : next;
      if (selectedElementPath === state.selectedElementPath) return state;
      return {
        selectedElementPath,
        agentRequest: '',
        copyStatus: 'idle'
      };
    }),
  setAgentRequest: (agentRequest) => set({ agentRequest, copyStatus: 'idle' }),
  setCopyStatus: (copyStatus) => set({ copyStatus }),
  resetWorkspaceState: () => set(initialWorkspaceState)
}));
