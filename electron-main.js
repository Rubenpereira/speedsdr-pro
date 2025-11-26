const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'SpeedSDR Pro - PU1XTB',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#051005'
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const backendPath = path.join(__dirname, 'backend', 'server.js');
  
  if (!fs.existsSync(backendPath)) {
    console.error(`[Backend Error] server.js não encontrado: ${backendPath}`);
    return;
  }

  console.log(`[Backend] Iniciando Node.js backend: ${backendPath}`);
  
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, 'backend'),
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false
  });
  
  backendProcess.on('error', (err) => {
    console.error(`[Backend Error] ${err.message}`);
  });

  backendProcess.on('spawn', () => {
    console.log('[Backend] ✓ Processo Node.js iniciado');
  });

  backendProcess.on('close', (code) => {
    console.log(`[Backend] Encerrado (código ${code})`);
    backendProcess = null;
  });
}

app.on('ready', () => {
  startBackend();
  setTimeout(createWindow, 2000);
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});