import type { IpcRendererEvent } from 'electron';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map<(data: any) => void, (_event: IpcRendererEvent, data: any) => void>();

const electronAPI = {
  openFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:openFolder');
  },

  readFile: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('fs:readFile', filePath);
  },

  writeFile: (filePath: string, content: string): Promise<boolean> => {
    return ipcRenderer.invoke('fs:writeFile', filePath, content);
  },

  listFiles: (dir: string, recursive: boolean = false): Promise<string[]> => {
    return ipcRenderer.invoke('fs:listFiles', dir, recursive);
  },

  executeCommand: (
    cmd: string,
    cwd?: string,
    timeoutMs?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return ipcRenderer.invoke('process:executeCommand', cmd, cwd, timeoutMs);
  },

  onAgentEvent: (callback: (data: any) => void): void => {
    const handler = (_event: IpcRendererEvent, data: any) => callback(data);
    listeners.set(callback, handler);
    ipcRenderer.on('agent:event', handler);
  },

  removeAgentEventListener: (callback?: (data: any) => void): void => {
    if (callback) {
      const handler = listeners.get(callback);
      if (handler) {
        ipcRenderer.removeListener('agent:event', handler);
        listeners.delete(callback);
      }
    } else {
      ipcRenderer.removeAllListeners('agent:event');
      listeners.clear();
    }
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
