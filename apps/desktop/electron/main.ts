import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';

import { replacePreviousDevelopmentInstance } from './application-instance';
import { CoreProcess } from './core-process';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const devParentPid = process.env.VITE_DEV_SERVER_URL ? process.ppid : undefined;

if (devParentPid !== undefined) {
  const parentWatch = setInterval(() => {
    if (process.ppid === devParentPid) return;
    clearInterval(parentWatch);
    app.quit();
  }, 500);
  parentWatch.unref();
}

const core = new CoreProcess();
let mainWindow: BrowserWindow | null = null;

ipcMain.handle('projects:choose', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Connect a project to Monad Design',
    buttonLabel: 'Connect Project',
    properties: ['openDirectory', 'createDirectory']
  });
  const path = result.filePaths[0];
  return result.canceled || !path ? null : { name: basename(path), path };
});
ipcMain.handle('core:status', () => core.status);
ipcMain.handle('core:bootstrap', () => core.localClient);

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 19 },
    transparent: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin'
      ? { vibrancy: 'under-window' as const, visualEffectState: 'active' as const }
      : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, 'preload.mjs'),
      sandbox: true
    }
  });
  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  if (process.env.VITE_DEV_SERVER_URL) void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void window.loadFile(join(currentDirectory, '../dist/index.html'));
};

void app
  .whenReady()
  .then(async () => {
    await replacePreviousDevelopmentInstance();
    await core.start();
    core.subscribeToAgentSession((session) => {
      if (session?.status === 'selecting_simulator' || session?.status === 'variants_ready') {
        mainWindow?.show();
        mainWindow?.focus();
      }
      mainWindow?.webContents.send('core:agent-session-changed', session);
    });
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: Startup failures must remain visible in the Electron process log.
    console.error('Failed to start Monad Design.', error);
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  core.openFallbackUi();
  core.stopPolling();
});
