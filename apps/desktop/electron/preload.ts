import { contextBridge, ipcRenderer } from 'electron';

const client = {
  setup: {
    status: () => ipcRenderer.invoke('setup:status'),
    retry: () => ipcRenderer.invoke('setup:retry'),
    scan: (scope: string) => ipcRenderer.invoke('setup:scan', scope),
    chooseProject: () => ipcRenderer.invoke('setup:project'),
    install: (input: unknown) => ipcRenderer.invoke('setup:install', input),
    complete: () => ipcRenderer.invoke('setup:complete'),
    exportKimiWork: () => ipcRenderer.invoke('setup:kimi-work')
  },
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  core: {
    status: () => ipcRenderer.invoke('core:status'),
    bootstrap: () => ipcRenderer.invoke('core:bootstrap'),
    subscribeToAgentSession: (listener: (session: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, session: unknown) => listener(session);
      ipcRenderer.on('core:agent-session-changed', handler);
      return () => ipcRenderer.removeListener('core:agent-session-changed', handler);
    }
  },
  projects: {
    choose: () => ipcRenderer.invoke('projects:choose')
  }
} as const;

contextBridge.exposeInMainWorld('client', client);
