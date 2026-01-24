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

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function findPort(startPort: number): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, '127.0.0.1', () => {
            const { port } = server.address() as net.AddressInfo;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findPort(startPort + 1));
        });
    });
}

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

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startBackend(): void {
    // In development, assume backend is started separately
    if (isDev) {
        console.log('Development mode: Backend should be started separately');
        return;
    }

    // In production, start the Python backend executable
    const backendPath = path.join(process.resourcesPath, 'backend');
    const exePath = path.join(backendPath, 'backend.exe');

    backendProcess = spawn(exePath, [], {
        cwd: backendPath,
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PORT: backendPort.toString()
        },
    });

    backendProcess.stdout?.on('data', (data) => {
        console.log(`Backend: ${data}`);
    });

    backendProcess.stderr?.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('close', (code) => {
        console.log(`Backend exited with code ${code}`);
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
    if (!isDev) {
        backendPort = await findPort(8081);
    }
    startBackend();
    createWindow();

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
