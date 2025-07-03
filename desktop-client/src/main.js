const { app, BrowserWindow, globalShortcut, clipboard, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 保持对窗口对象的全局引用
let mainWindow;
let captureWindow;

// 配置管理
const configPath = path.join(__dirname, '../config/app-config.json');
let appConfig = {
  serverUrl: 'http://localhost:3000',
  secretKey: 'dev-secret-key-change-in-production',
  submitterName: '',
  shortcuts: {
    captureText: 'CommandOrControl+Shift+T',
    captureImage: 'CommandOrControl+Shift+I'
  }
};

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
    title: '素材快捷投递工具'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 通信处理
ipcMain.handle('get-config', () => {
  return appConfig;
});

ipcMain.handle('save-config', (event, newConfig) => {
  appConfig = { ...appConfig, ...newConfig };
  return true;
});

// 应用事件处理
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
