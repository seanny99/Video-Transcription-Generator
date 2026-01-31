/**
 * Electron main process entry point.
 * Handles window creation and backend process management.
 */

import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendPort = 8081;

const isDev = process.env.NODE_ENV === 'development' || (process.env.NODE_ENV !== 'production' && !app.isPackaged);

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'default',
        show: false,
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
            query: { port: backendPort.toString() }
        });
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Pipe renderer logs to terminal
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow?.webContents.executeJavaScript('console.log("Renderer loaded:", window.location.href)');
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        console.log(`[Renderer ${levels[level] || 'LOG'}] ${message} (${path.basename(sourceId)}:${line})`);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startBackend(): Promise<number> {
    return new Promise((resolve, reject) => {
        // In development, assume backend is started separately on 8081
        if (isDev) {
            console.log('Development mode: Backend should be started separately');
            resolve(8081);
            return;
        }

        // In production, start the Python backend executable
        const backendPath = app.isPackaged
            ? path.join(process.resourcesPath, 'backend')
            : path.join(__dirname, '../../../backend/dist');
        const exePath = path.join(backendPath, 'backend.exe');

        console.log('Starting backend with dynamic port allocation...');

        // Pass PORT=0 to let OS assign a random free port
        backendProcess = spawn(exePath, [], {
            cwd: backendPath,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PORT: '0'
            },
        });

        let portFound = false;

        const handleOutput = (data: string | Buffer) => {
            const output = data.toString();
            console.log(`Backend: ${output}`);

            // Look for Uvicorn binding message
            // "Uvicorn running on http://127.0.0.1:54321"
            if (!portFound) {
                const match = output.match(/running on http:\/\/127\.0\.0\.1:(\d+)/);
                if (match) {
                    const port = parseInt(match[1]);
                    console.log(`Backend bound to port: ${port}`);
                    portFound = true;
                    resolve(port);
                }
            }
        };

        backendProcess.stdout?.on('data', handleOutput);

        // IMPORTANT: Uvicorn often logs info to stderr, so we must parse it too
        backendProcess.stderr?.on('data', (data) => {
            handleOutput(data);
        });

        backendProcess.on('close', (code) => {
            console.log(`Backend exited with code ${code}`);
            if (!portFound) {
                reject(new Error(`Backend exited before binding port (code ${code})`));
            }
        });

        backendProcess.on('error', (err) => {
            console.error('Failed to start backend process:', err);
            reject(err);
        });
    });
}

function stopBackend(): void {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
}

// App lifecycle
app.whenReady().then(async () => {
    try {
        if (!isDev) {
            backendPort = await startBackend();
        } else {
            await startBackend(); // Just for logging in dev
        }
        createWindow();
    } catch (err) {
        console.error('Fatal: Failed to start backend:', err);
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopBackend();
});
