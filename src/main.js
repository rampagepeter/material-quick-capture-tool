const { app, BrowserWindow, globalShortcut, Menu, Tray, clipboard, nativeImage, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const APIClient = require('./api');

// 保持对窗口对象的全局引用
let mainWindow;
let captureWindow;
let tray = null;
let apiClient = null;

// 配置管理
const configPath = path.join(__dirname, '../config/app-config.json');
let appConfig = {
  serverUrl: 'http://localhost:3001',
  secretKey: 'dev-secret-key-change-in-production',
  submitterName: '',
  shortcuts: {
    smartCapture: 'CommandOrControl+Shift+T'  // 智能捕获快捷键
  }
};

// 全局变量用于追踪当前注册的快捷键
let currentShortcutKey = null;

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      appConfig = { ...appConfig, ...JSON.parse(configData) };
    }
    // 初始化API客户端
    apiClient = new APIClient(appConfig);
  } catch (error) {
    console.error('Failed to load config:', error);
    apiClient = new APIClient(appConfig);
  }
}

// 保存配置
function saveConfig() {
  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
    // 更新API客户端配置
    if (apiClient) {
      apiClient.updateConfig(appConfig);
    }
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

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

  // 开发环境下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 最小化到托盘而不是关闭
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// 创建捕获窗口
function createCaptureWindow(contentType = 'text') {
  if (captureWindow) {
    captureWindow.focus();
    return;
  }

  captureWindow = new BrowserWindow({
    width: 550,
    height: contentType === 'text' ? 520 : 450,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: true,
    alwaysOnTop: true,
    frame: true,
    transparent: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#ffffff'
  });

  captureWindow.loadFile(path.join(__dirname, '../renderer/capture.html'));

  // 传递捕获类型到渲染进程
  captureWindow.webContents.once('dom-ready', () => {
    captureWindow.webContents.send('capture-type', contentType);
    captureWindow.show();
    captureWindow.focus();
  });

  captureWindow.on('closed', () => {
    captureWindow = null;
  });

  // 失去焦点时关闭窗口
  captureWindow.on('blur', () => {
    setTimeout(() => {
      if (captureWindow && !captureWindow.isFocused()) {
        captureWindow.close();
      }
    }, 100);
  });
}

// 创建系统托盘
function createTray() {
  try {
    // 创建一个简单的托盘图标（如果没有图标文件的话）
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    
    if (!fs.existsSync(iconPath)) {
      console.warn('Tray icon not found, skipping tray creation');
      return;
    }

    tray = new Tray(nativeImage.createFromPath(iconPath));
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        }
      },
      {
        label: `智能捕获 (${appConfig.shortcuts.smartCapture.replace('CommandOrControl', 'Cmd')})`,
        click: () => handleSmartCapture()
      },
      { type: 'separator' },
      {
        label: '文本捕获',
        click: () => handleTextCapture()
      },
      {
        label: '图片捕获', 
        click: () => handleImageCapture()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('素材快捷投递工具');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

// 智能捕获处理 - 自动检测剪贴板内容类型
function handleSmartCapture() {
  // 首先检查图片
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    console.log('检测到剪贴板图片，启动图片捕获');
    createCaptureWindow('image');
    return;
  }

  // 然后检查文本
  const text = clipboard.readText();
  console.log('剪贴板文本内容:', text);
  console.log('文本长度:', text ? text.length : 0);
  console.log('文本类型:', typeof text);
  
  if (text && text.trim()) {
    console.log('检测到剪贴板文本，启动文本捕获');
    createCaptureWindow('text');
    return;
  }

  // 如果都没有内容
  dialog.showMessageBox({
    type: 'info',
    title: '提示',
    message: '剪贴板中没有发现文本或图片内容',
    buttons: ['确定']
  });
}

// 处理文本捕获（保留原函数供其他地方调用）
function handleTextCapture() {
  const text = clipboard.readText();
  console.log('剪贴板文本内容:', text);
  console.log('文本长度:', text ? text.length : 0);
  console.log('文本类型:', typeof text);
  
  if (text && text.trim()) {
    createCaptureWindow('text');
  } else {
    dialog.showMessageBox({
      type: 'info',
      title: '提示',
      message: `剪贴板中没有发现文本内容。读取到: "${text}"`,
      buttons: ['确定']
    });
  }
}

// 处理图片捕获（保留原函数供其他地方调用）
function handleImageCapture() {
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    createCaptureWindow('image');
  } else {
    dialog.showMessageBox({
      type: 'info',
      title: '提示', 
      message: '剪贴板中没有发现图片内容',
      buttons: ['确定']
    });
  }
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  try {
    // 获取新的快捷键
    const newShortcutKey = appConfig.shortcuts?.smartCapture || 'CommandOrControl+Shift+T';
    
    // 如果新的快捷键与当前注册的相同，则无需重新注册
    if (currentShortcutKey === newShortcutKey) {
      console.log(`快捷键 ${newShortcutKey} 已经注册，跳过重复注册`);
      return;
    }
    
    // 注销旧的快捷键（只注销我们的智能捕获快捷键）
    if (currentShortcutKey) {
      globalShortcut.unregister(currentShortcutKey);
      console.log(`已注销旧快捷键: ${currentShortcutKey}`);
    }
    
    // 注册新的智能捕获快捷键
    const success = globalShortcut.register(newShortcutKey, () => {
      handleSmartCapture();
    });

    if (success) {
      currentShortcutKey = newShortcutKey;
      console.log(`智能捕获快捷键已注册: ${newShortcutKey}`);
    } else {
      console.error(`快捷键注册失败: ${newShortcutKey}`);
      currentShortcutKey = null;
    }
  } catch (error) {
    console.error('Failed to register global shortcuts:', error);
    currentShortcutKey = null;
  }
}

// IPC 通信处理
ipcMain.handle('get-config', () => {
  return appConfig;
});

ipcMain.handle('save-config', (event, newConfig) => {
  appConfig = { ...appConfig, ...newConfig };
  saveConfig();
  
  // 重新注册快捷键
  registerGlobalShortcuts();
  
  // 重新创建托盘菜单（如果托盘存在）
  if (tray) {
    createTray();
  }
  
  return true;
});

ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

ipcMain.handle('get-clipboard-image', () => {
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    return image.toDataURL();
  }
  return null;
});

ipcMain.handle('test-connection', async () => {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }
    
    const result = await apiClient.checkHealth();
    return { success: true, data: result };
  } catch (error) {
    console.error('Connection test failed:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('submit-content', async (event, data) => {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }

    let result;
    if (data.contentType === 'text') {
      result = await apiClient.submitText(
        data.content,
        data.submitter,
        data.comment
      );
    } else if (data.contentType === 'image') {
      // 将 base64 数据转换为 Buffer
      const base64Data = data.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      result = await apiClient.submitImage(
        imageBuffer,
        data.fileName || 'screenshot.png',
        data.submitter,
        data.comment
      );
    }

    console.log('Content submitted successfully:', result);
    return { success: true, message: 'Content submitted successfully', data: result };
  } catch (error) {
    console.error('Submit content failed:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('close-capture-window', () => {
  if (captureWindow) {
    captureWindow.close();
  }
});

ipcMain.handle('trigger-smart-capture', () => {
  handleSmartCapture();
});

ipcMain.handle('trigger-text-capture', () => {
  handleTextCapture();
});

ipcMain.handle('trigger-image-capture', () => {
  handleImageCapture();
});

// 应用事件处理
app.whenReady().then(() => {
  loadConfig();
  createMainWindow();
  createTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 在 macOS 上保持应用运行
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // 注销我们注册的智能捕获快捷键
  if (currentShortcutKey) {
    globalShortcut.unregister(currentShortcutKey);
    console.log(`应用退出时注销快捷键: ${currentShortcutKey}`);
    currentShortcutKey = null;
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
}); 