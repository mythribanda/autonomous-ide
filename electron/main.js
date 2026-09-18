"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
let mainWindow = null;
let backendWs = null;
let reconnectTimer = null;
const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:8000/ws';
function createWindow() {
    const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
    const preloadPath = fs.existsSync(path.join(__dirname, 'preload.js'))
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, 'preload.ts');
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        frame: true,
        backgroundColor: '#0d1117',
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    // Configure Content-Security-Policy
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; " +
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                        "font-src 'self' https://fonts.gstatic.com data:; " +
                        "img-src 'self' data: https: blob:; " +
                        "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*;"
                ]
            }
        });
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        const indexPath = fs.existsSync(path.join(app.getAppPath(), 'dist', 'index.html'))
            ? path.join(app.getAppPath(), 'dist', 'index.html')
            : path.join(__dirname, '..', 'dist', 'index.html');
        mainWindow.loadFile(indexPath);
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    return mainWindow;
}
// Python backend WebSocket relay
function connectBackendWebSocket() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    try {
        const ws = new WebSocket(BACKEND_WS_URL);
        backendWs = ws;
        ws.onopen = () => {
            console.log(`[Electron Main] Connected to Python backend WebSocket at ${BACKEND_WS_URL}`);
        };
        ws.onmessage = (event) => {
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                }
                catch {
                    // Keep as string
                }
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('agent:event', data);
            }
        };
        ws.onerror = () => {
            // Backend may be starting or offline
        };
        ws.onclose = () => {
            backendWs = null;
            reconnectTimer = setTimeout(() => {
                connectBackendWebSocket();
            }, 3000);
        };
    }
    catch {
        backendWs = null;
        reconnectTimer = setTimeout(() => {
            connectBackendWebSocket();
        }, 3000);
    }
}
// IPC Handlers
ipcMain.handle('dialog:openFolder', async () => {
    const focusedWin = BrowserWindow.getFocusedWindow() || mainWindow;
    const result = await dialog.showOpenDialog(focusedWin, {
        properties: ['openDirectory'],
        title: 'Select Project Folder'
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});
ipcMain.handle('fs:readFile', async (_event, filePath) => {
    return await fs.promises.readFile(filePath, 'utf-8');
});
ipcMain.handle('fs:writeFile', async (_event, filePath, content) => {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
});
async function scanDirectory(dir, recursive, baseDir = dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            results.push(relPath + '/');
            if (recursive) {
                const nested = await scanDirectory(fullPath, true, baseDir);
                results.push(...nested);
            }
        }
        else {
            results.push(relPath);
        }
    }
    return results;
}
ipcMain.handle('fs:listFiles', async (_event, dir, recursive = false) => {
    return await scanDirectory(dir, recursive);
});
ipcMain.handle('process:executeCommand', async (_event, cmd, cwd, timeoutMs = 30000) => {
    return new Promise((resolve) => {
        exec(cmd, {
            cwd: cwd || process.cwd(),
            timeout: timeoutMs,
            maxBuffer: 10 * 1024 * 1024,
            env: process.env,
            shell: process.platform === 'win32' ? 'powershell.exe' : undefined
        }, (error, stdout, stderr) => {
            const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
            resolve({
                stdout: stdout || '',
                stderr: stderr || (error && error.message && !stderr ? error.message : ''),
                exitCode
            });
        });
    });
});
// Bidirectional agent:event relay if renderer triggers events
ipcMain.on('agent:event', (_event, data) => {
    if (backendWs && backendWs.readyState === WebSocket.OPEN) {
        const msg = typeof data === 'string' ? data : JSON.stringify(data);
        backendWs.send(msg);
    }
});
app.whenReady().then(() => {
    createWindow();
    connectBackendWebSocket();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    if (backendWs) {
        backendWs.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
