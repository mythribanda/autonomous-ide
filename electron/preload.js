"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { contextBridge, ipcRenderer } = require('electron');
const listeners = new Map();
const electronAPI = {
    openFolder: () => {
        return ipcRenderer.invoke('dialog:openFolder');
    },
    readFile: (filePath) => {
        return ipcRenderer.invoke('fs:readFile', filePath);
    },
    writeFile: (filePath, content) => {
        return ipcRenderer.invoke('fs:writeFile', filePath, content);
    },
    listFiles: (dir, recursive = false) => {
        return ipcRenderer.invoke('fs:listFiles', dir, recursive);
    },
    executeCommand: (cmd, cwd, timeoutMs) => {
        return ipcRenderer.invoke('process:executeCommand', cmd, cwd, timeoutMs);
    },
    onAgentEvent: (callback) => {
        const handler = (_event, data) => callback(data);
        listeners.set(callback, handler);
        ipcRenderer.on('agent:event', handler);
    },
    removeAgentEventListener: (callback) => {
        if (callback) {
            const handler = listeners.get(callback);
            if (handler) {
                ipcRenderer.removeListener('agent:event', handler);
                listeners.delete(callback);
            }
        }
        else {
            ipcRenderer.removeAllListeners('agent:event');
            listeners.clear();
        }
    }
};
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
