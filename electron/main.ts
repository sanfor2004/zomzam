import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import type { DesktopAppInfo } from './types';

const isDev = process.env.NODE_ENV !== 'production';
const devServerUrl = process.env.ZOMZAM_RENDERER_URL || 'http://localhost:3000';

function packagedRendererEntry(): string {
  return path.join(app.getAppPath(), 'out', 'index.html');
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#111318',
    title: 'Zomzam',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
        void shell.openExternal(url);
      }
    } catch {
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  if (isDev) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(packagedRendererEntry());
  }
}

ipcMain.handle('app:get-info', (): DesktopAppInfo => ({
  platform: process.platform,
  version: app.getVersion(),
  isPackaged: app.isPackaged,
}));

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
