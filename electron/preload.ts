import { contextBridge, ipcRenderer } from 'electron';
import type { ZomzamDesktopApi } from './types';

const api: ZomzamDesktopApi = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
};

contextBridge.exposeInMainWorld('zomzamDesktop', api);

