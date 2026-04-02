'use strict';

const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'A\'note',
    icon:  '../logos/icon.ico',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Allow loading local files for PDF worker
      webSecurity: false,
    },
  });

  if (isDev) {
    // In dev, load the Vite dev server
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // In production, load the built dist/index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove default menu bar
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  // Register a custom protocol for file:// loading to support pdfjs workers
  protocol.handle('atom', (request) => {
    const filePath = request.url.slice('atom://'.length);
    return net.fetch(url.pathToFileURL(path.resolve(__dirname, filePath)).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
