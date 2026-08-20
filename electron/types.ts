export interface DesktopAppInfo {
  platform: NodeJS.Platform;
  version: string;
  isPackaged: boolean;
}

export interface ZomzamDesktopApi {
  getAppInfo: () => Promise<DesktopAppInfo>;
}

