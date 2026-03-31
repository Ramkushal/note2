'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'A\'note',
    icon: path.join(__dirname, 'public/logo.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a', /* --shell-bg */
      symbolColor: '#e2e8f0', /* --shell-text */
      height: 48
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Allow local file loading for pdfjs workers
      webSecurity: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'app-dist/index.html'));
  }

  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
