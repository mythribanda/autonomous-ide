import type { IpcMainInvokeEvent, IpcMainEvent } from 'electron';
const { app, BrowserWindow, ipcMain, dialog, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let backendWs: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let backendProcess: any = null;

const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:8000/ws';

function startBackendProcess() {
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  const projectRoot = isDev ? process.cwd() : app.getAppPath();

  console.log(`[Electron Main] Starting FastAPI backend subprocess (isDev=${isDev})...`);

  if (isDev) {
    // In development: run "uvicorn backend.main:app --reload"
    backendProcess = spawn('uvicorn', ['backend.main:app', '--reload', '--port', '8000'], {
      cwd: projectRoot,
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
  } else {
    // In production: bundle Python as pyinstaller binary OR run system Python
    const pyinstallerBin = process.platform === 'win32'
      ? path.join(process.resourcesPath || projectRoot, 'backend_server', 'backend_server.exe')
      : path.join(process.resourcesPath || projectRoot, 'backend_server', 'backend_server');

    if (fs.existsSync(pyinstallerBin)) {
      console.log(`[Electron Main] Launching bundled pyinstaller binary at ${pyinstallerBin}`);
      backendProcess = spawn(pyinstallerBin, [], {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    } else {
      console.log('[Electron Main] Launching system Python uvicorn backend...');
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'backend.main:app', '--port', '8000'], {
        cwd: projectRoot,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });
    }
  }

  if (backendProcess) {
    backendProcess.stdout?.on('data', (data: any) => {
      console.log(`[Backend stdout] ${data.toString().trim()}`);
    });
    backendProcess.stderr?.on('data', (data: any) => {
      console.error(`[Backend stderr] ${data.toString().trim()}`);
    });
    backendProcess.on('error', (err: any) => {
      console.error('[Electron Main] Failed to start backend subprocess:', err);
    });
    backendProcess.on('exit', (code: any, signal: any) => {
      console.log(`[Electron Main] Backend subprocess exited with code ${code}, signal ${signal}`);
      backendProcess = null;
    });
  }
}

function stopBackendProcess() {
  if (backendProcess) {
    console.log('[Electron Main] Stopping backend subprocess...');
    try {
      if (process.platform === 'win32' && backendProcess.pid) {
        exec(`taskkill /pid ${backendProcess.pid} /T /F`, () => {});
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[Electron Main] Error terminating backend process:', e);
    }
    backendProcess = null;
  }
}

function createWindow(): InstanceType<typeof BrowserWindow> {
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
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
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
  } else {
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

    ws.onmessage = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
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
  } catch {
    backendWs = null;
    reconnectTimer = setTimeout(() => {
      connectBackendWebSocket();
    }, 3000);
  }
}

// IPC Handlers
ipcMain.handle('dialog:openFolder', async (): Promise<string | null> => {
  const focusedWin = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showOpenDialog(focusedWin as any, {
    properties: ['openDirectory'],
    title: 'Select Project Folder'
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('fs:readFile', async (_event: IpcMainInvokeEvent, filePath: string): Promise<string> => {
  return await fs.promises.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_event: IpcMainInvokeEvent, filePath: string, content: string): Promise<boolean> => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf-8');
  return true;
});

async function scanDirectory(dir: string, recursive: boolean, baseDir: string = dir): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

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
    } else {
      results.push(relPath);
    }
  }

  return results;
}

ipcMain.handle('fs:listFiles', async (_event: IpcMainInvokeEvent, dir: string, recursive: boolean = false): Promise<string[]> => {
  return await scanDirectory(dir, recursive);
});

ipcMain.handle(
  'process:executeCommand',
  async (
    _event: IpcMainInvokeEvent,
    cmd: string,
    cwd?: string,
    timeoutMs: number = 30000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return new Promise((resolve) => {
      exec(
        cmd,
        {
          cwd: cwd || process.cwd(),
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          env: process.env,
          shell: process.platform === 'win32' ? 'powershell.exe' : undefined
        },
        (error: any, stdout: string, stderr: string) => {
          const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
          resolve({
            stdout: stdout || '',
            stderr: stderr || (error && error.message && !stderr ? error.message : ''),
            exitCode
          });
        }
      );
    });
  }
);

// Bidirectional agent:event relay if renderer triggers events
ipcMain.on('agent:event', (_event: IpcMainEvent, data: any) => {
  if (backendWs && backendWs.readyState === WebSocket.OPEN) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    backendWs.send(msg);
  }
});

// Settings load and save handlers in userData directory
ipcMain.handle('settings:load', async (): Promise<any> => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const content = await fs.promises.readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
});

ipcMain.handle('settings:save', async (_event: IpcMainInvokeEvent, settings: any): Promise<boolean> => {
  try {
    const dir = app.getPath('userData');
    await fs.promises.mkdir(dir, { recursive: true });
    const settingsPath = path.join(dir, 'settings.json');
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save settings to userData:', err);
    return false;
  }
});

// Helper: fire shortcut event to renderer
function fireShortcut(shortcutId: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut:fired', shortcutId);
  }
}

app.whenReady().then(async () => {
  // Start backend subprocess on app launch
  startBackendProcess();

  // 5-second startup wait for backend before loading the window
  console.log('[Electron Main] Waiting 5 seconds for backend to initialize...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  createWindow();
  connectBackendWebSocket();

  // Register global keyboard shortcuts
  globalShortcut.register('CommandOrControl+P', () => fireShortcut('focus_prompt'));
  globalShortcut.register('CommandOrControl+`', () => fireShortcut('toggle_terminal'));
  globalShortcut.register('CommandOrControl+Shift+E', () => fireShortcut('toggle_explorer'));
  globalShortcut.register('CommandOrControl+Shift+G', () => fireShortcut('open_git'));
  globalShortcut.register('CommandOrControl+,', () => fireShortcut('open_settings'));
  globalShortcut.register('CommandOrControl+Shift+P', () => fireShortcut('command_palette'));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBackendProcess();
});

process.on('exit', () => {
  stopBackendProcess();
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
