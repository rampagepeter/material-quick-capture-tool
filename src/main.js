const { app, BrowserWindow, globalShortcut, Menu, Tray, clipboard, nativeImage, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const FeishuAPIClient = require('./api');

// 保持对窗口对象的全局引用
let mainWindow;
let captureWindow;
let realtimeWindow;
let tray = null;
let apiClient = null;

// 实时模式相关变量
let realtimeMode = false;
let clipboardWatcher = null;
let lastClipboardContent = { text: '', image: null };
let lastShortcutTime = 0;
let shortcutTimerId = null;

// 配置管理
const configPath = path.join(__dirname, '../config/app-config.json');
let appConfig = {
  feishuAppId: '',
  feishuAppSecret: '',
  submitterName: '',
  shortcuts: {
    smartCapture: 'CommandOrControl+Shift+T'
  },
  tableConfigs: [],
  currentTableIndex: -1,
  lastUsedTable: null
};

// 全局变量用于追踪当前注册的快捷键
let currentShortcutKey = null;

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      appConfig = { ...appConfig, ...JSON.parse(configData) };
      console.log('Config loaded successfully:', {
        hasAppId: !!appConfig.feishuAppId,
        hasAppSecret: !!appConfig.feishuAppSecret,
        appIdLength: appConfig.feishuAppId ? appConfig.feishuAppId.length : 0,
        tableCount: appConfig.tableConfigs ? appConfig.tableConfigs.length : 0
      });
    } else {
      console.log('Config file does not exist, using default config');
    }
    // 初始化API客户端
    apiClient = new FeishuAPIClient(appConfig);
    console.log('API client initialized with config');
  } catch (error) {
    console.error('Failed to load config:', error);
    apiClient = new FeishuAPIClient(appConfig);
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
    width: 580,
    height: 700,
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

// 创建实时模式提示窗口
function createRealtimeWindow() {
  // 如果窗口已存在，直接返回
  if (realtimeWindow && !realtimeWindow.isDestroyed()) {
    realtimeWindow.focus();
    return;
  }

  realtimeWindow = new BrowserWindow({
    width: 180,
    height: 35,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    focusable: false,
    level: 'screen-saver'  // 设置为屏保级别，确保始终在最前面
  });

  realtimeWindow.loadFile(path.join(__dirname, '../renderer/realtime.html'));

  realtimeWindow.webContents.once('dom-ready', () => {
    realtimeWindow.show();
    // 设置窗口位置到屏幕右上角
    const { screen } = require('electron');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    realtimeWindow.setPosition(width - 200, 20);
    
    // 确保窗口始终在最前面
    realtimeWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  realtimeWindow.on('closed', () => {
    realtimeWindow = null;
  });
}

// 启动实时模式
function startRealtimeMode() {
  if (realtimeMode) return;
  
  realtimeMode = true;
  console.log('实时模式已启动');
  
  // 创建实时模式提示窗口
  createRealtimeWindow();
  
  // 保存当前剪贴板内容
  lastClipboardContent = {
    text: clipboard.readText() || '',
    image: clipboard.readImage().isEmpty() ? null : clipboard.readImage().toPNG().toString('base64')
  };
  
  // 启动剪贴板监听
  startClipboardWatcher();
  
  // 更新托盘菜单
  updateTrayMenu();
}

// 停止实时模式
function stopRealtimeMode() {
  if (!realtimeMode) return;
  
  realtimeMode = false;
  console.log('实时模式已停止');
  
  // 关闭实时模式提示窗口
  if (realtimeWindow && !realtimeWindow.isDestroyed()) {
    realtimeWindow.close();
  }
  realtimeWindow = null;
  
  // 停止剪贴板监听
  stopClipboardWatcher();
  
  // 更新托盘菜单
  updateTrayMenu();
}

// 启动剪贴板监听
function startClipboardWatcher() {
  if (clipboardWatcher) return;
  
  clipboardWatcher = setInterval(() => {
    try {
      const currentText = clipboard.readText() || '';
      const currentImage = clipboard.readImage();
      const currentImageData = currentImage.isEmpty() ? null : currentImage.toPNG().toString('base64');
      
      // 检查是否有新的剪贴板内容
      let hasNewContent = false;
      let contentType = null;
      let content = null;
      
      if (currentImageData && currentImageData !== lastClipboardContent.image) {
        hasNewContent = true;
        contentType = 'image';
        content = currentImageData;
        lastClipboardContent.image = currentImageData;
      } else if (currentText && currentText.trim() && currentText !== lastClipboardContent.text) {
        hasNewContent = true;
        contentType = 'text';
        content = currentText.trim();
        lastClipboardContent.text = currentText;
      }
      
      if (hasNewContent) {
        console.log(`检测到新的${contentType === 'image' ? '图片' : '文本'}内容，自动上传中...`);
        handleRealtimeUpload(contentType, content);
      }
    } catch (error) {
      console.error('剪贴板监听出错:', error);
    }
  }, 500); // 每500ms检查一次
}

// 停止剪贴板监听
function stopClipboardWatcher() {
  if (clipboardWatcher) {
    clearInterval(clipboardWatcher);
    clipboardWatcher = null;
  }
}

// 处理实时模式上传
async function handleRealtimeUpload(contentType, content) {
  try {
    if (!apiClient) {
      throw new Error('API客户端未初始化');
    }
    
    const currentTable = getCurrentTableConfig();
    if (!currentTable) {
      throw new Error('未选择表格配置');
    }
    
    const submitter = appConfig.submitterName || '未知用户';
    const comment = `实时模式自动上传 - ${new Date().toLocaleString()}`;
    
    let result;
    if (contentType === 'text') {
      result = await apiClient.submitText(currentTable, content, submitter, comment);
    } else if (contentType === 'image') {
      const imageBuffer = Buffer.from(content, 'base64');
      const fileName = `realtime-${Date.now()}.png`;
      result = await apiClient.submitImage(currentTable, imageBuffer, fileName, submitter, comment);
    }
    
    // 通知实时模式窗口上传结果
    if (realtimeWindow) {
      realtimeWindow.webContents.send('upload-result', {
        success: result.success,
        contentType,
        message: result.success ? '上传成功' : result.message
      });
    }
    
    console.log('实时模式上传结果:', result);
  } catch (error) {
    console.error('实时模式上传失败:', error);
    if (realtimeWindow) {
      realtimeWindow.webContents.send('upload-result', {
        success: false,
        contentType,
        message: error.message
      });
    }
  }
}

// 检测连续按键
function handleShortcutPress() {
  const currentTime = Date.now();
  
  // 如果是实时模式，直接退出
  if (realtimeMode) {
    stopRealtimeMode();
    return;
  }
  
  // 检查是否为连续按键（500ms内）
  if (currentTime - lastShortcutTime < 500) {
    // 连续按键，进入实时模式
    if (shortcutTimerId) {
      clearTimeout(shortcutTimerId);
      shortcutTimerId = null;
    }
    startRealtimeMode();
  } else {
    // 单次按键，设置定时器执行原有功能
    if (shortcutTimerId) {
      clearTimeout(shortcutTimerId);
    }
    shortcutTimerId = setTimeout(() => {
      handleSmartCapture();
    }, 500);
  }
  
  lastShortcutTime = currentTime;
}

// 修改智能捕获功能
function handleSmartCapture() {
  try {
    // 检查剪贴板中是否有图片
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      createCaptureWindow('image');
      return;
    }

    // 检查剪贴板中是否有文本
    const text = clipboard.readText();
    if (text && text.trim()) {
      createCaptureWindow('text');
      return;
    }

    // 如果都没有，默认打开文本捕获
    createCaptureWindow('text');
  } catch (error) {
    console.error('Smart capture failed:', error);
    createCaptureWindow('text');
  }
}

// 更新托盘菜单
function updateTrayMenu() {
  if (!tray) return;
  
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
      label: realtimeMode ? '退出实时模式' : `智能捕获 (${appConfig.shortcuts.smartCapture.replace('CommandOrControl', 'Cmd')})`,
      click: () => realtimeMode ? stopRealtimeMode() : handleSmartCapture()
    },
    {
      label: realtimeMode ? '🔴 实时模式运行中' : '启动实时模式',
      enabled: !realtimeMode,
      click: () => !realtimeMode && startRealtimeMode()
    },
    { type: 'separator' },
    {
      label: '文本捕获',
      enabled: !realtimeMode,
      click: () => handleTextCapture()
    },
    {
      label: '图片捕获',
      enabled: !realtimeMode,
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
  
  tray.setContextMenu(contextMenu);
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
    
    updateTrayMenu();

    tray.setToolTip('素材快捷投递工具');

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

// 文本捕获功能
function handleTextCapture() {
  createCaptureWindow('text');
}

// 图片捕获功能
function handleImageCapture() {
    createCaptureWindow('image');
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  // 注销旧的快捷键
  if (currentShortcutKey) {
    globalShortcut.unregister(currentShortcutKey);
    currentShortcutKey = null;
  }
  
  // 注册新的快捷键
  const shortcutKey = appConfig.shortcuts.smartCapture;
  if (shortcutKey) {
    try {
      const success = globalShortcut.register(shortcutKey, handleShortcutPress);
      if (success) {
        currentShortcutKey = shortcutKey;
        console.log(`Global shortcut registered: ${shortcutKey}`);
      } else {
        console.error(`Failed to register global shortcut: ${shortcutKey}`);
      }
    } catch (error) {
      console.error('Failed to register global shortcut:', error);
    }
  }
  
  // 注册ESC键用于退出实时模式
  try {
    globalShortcut.register('Escape', () => {
      if (realtimeMode) {
        stopRealtimeMode();
      }
    });
  } catch (error) {
    console.error('Failed to register ESC shortcut:', error);
  }
}

// 获取当前选中的表格配置
function getCurrentTableConfig() {
  if (appConfig.currentTableIndex >= 0 && appConfig.currentTableIndex < appConfig.tableConfigs.length) {
    return appConfig.tableConfigs[appConfig.currentTableIndex];
  }
  return null;
}

// 应用准备就绪
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

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理程序

// 获取配置
ipcMain.handle('get-config', () => {
  return appConfig;
});

// 保存配置
ipcMain.handle('save-config', (event, config) => {
  try {
    appConfig = { ...appConfig, ...config };
  saveConfig();
  
  // 重新注册快捷键
    if (config.shortcuts) {
  registerGlobalShortcuts();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save config:', error);
    return { success: false, message: error.message };
  }
});

// 测试飞书连接
ipcMain.handle('test-feishu-connection', async (event, config) => {
  try {
    if (!config || !config.appId || !config.appSecret) {
      throw new Error('Missing app ID or secret');
    }
    
    // 临时创建API客户端进行测试，确保参数名称正确
    const testClient = new FeishuAPIClient({
      feishuAppId: config.appId,
      feishuAppSecret: config.appSecret
    });
    const token = await testClient.getAccessToken();
    
    return {
      success: true,
      message: 'Connection successful',
      hasToken: !!token
    };
  } catch (error) {
    console.error('Test feishu connection failed:', error);
    return { success: false, message: error.message };
  }
});

// 测试图片上传权限
ipcMain.handle('test-image-upload-permission', async (event) => {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }
    
    // 获取当前表格配置用于测试
    const currentTable = getCurrentTableConfig();
    if (!currentTable) {
      return {
        success: false,
        message: '需要先配置表格才能测试图片上传权限',
        isPermissionError: false
      };
    }
    
    // 创建一个很小的测试图片数据
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    
    // 尝试上传测试图片
    const result = await apiClient.uploadImage(testImageBuffer, 'test-permission.png', currentTable.appToken, currentTable.tableId);
    
    return {
      success: true,
      message: 'Upload permission test successful',
      fileToken: result.file_token
    };
  } catch (error) {
    console.error('Test image upload permission failed:', error);
    return { 
      success: false, 
      message: error.message,
      isPermissionError: error.message.includes('99991672') || error.message.includes('drive:file:upload')
    };
  }
});

// 获取表格字段
ipcMain.handle('get-table-fields', async (event, tableConfig) => {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }
    
    const result = await apiClient.getTableFieldsAndInfo(tableConfig);
    
    return {
      success: true,
      data: {
        tableName: result.appName,
        fields: result.fields.map(field => ({
          id: field.field_id,
          name: field.field_name,
          type: field.type
        }))
      }
    };
  } catch (error) {
    console.error('Get table fields failed:', error);
    return { success: false, message: error.message };
  }
});

// 测试表格配置
ipcMain.handle('test-table-config', async (event, tableConfig) => {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }
    
    const result = await apiClient.testTableConfig(tableConfig);
    return result;
  } catch (error) {
    console.error('Test table config failed:', error);
    return { success: false, message: error.message };
  }
});

// 添加表格配置
ipcMain.handle('add-table-config', (event, tableConfig) => {
  try {
    appConfig.tableConfigs.push(tableConfig);
    appConfig.currentTableIndex = appConfig.tableConfigs.length - 1;
    saveConfig();
    return { success: true };
  } catch (error) {
    console.error('Add table config failed:', error);
    return { success: false, message: error.message };
  }
});

// 更新表格配置
ipcMain.handle('update-table-config', (event, index, tableConfig) => {
  try {
    if (index >= 0 && index < appConfig.tableConfigs.length) {
      appConfig.tableConfigs[index] = tableConfig;
      saveConfig();
      return { success: true };
    } else {
      throw new Error('Invalid table config index');
    }
  } catch (error) {
    console.error('Update table config failed:', error);
    return { success: false, message: error.message };
  }
});

// 删除表格配置
ipcMain.handle('delete-table-config', (event, index) => {
  try {
    if (index >= 0 && index < appConfig.tableConfigs.length) {
      appConfig.tableConfigs.splice(index, 1);
      
      // 调整当前选中的索引
      if (appConfig.currentTableIndex >= appConfig.tableConfigs.length) {
        appConfig.currentTableIndex = appConfig.tableConfigs.length - 1;
      }
      
      saveConfig();
      return { success: true };
    } else {
      throw new Error('Invalid table config index');
    }
  } catch (error) {
    console.error('Delete table config failed:', error);
    return { success: false, message: error.message };
  }
});

// 设置当前表格
ipcMain.handle('set-current-table', (event, index) => {
  try {
    if (index >= -1 && index < appConfig.tableConfigs.length) {
      appConfig.currentTableIndex = index;
      saveConfig();
      return { success: true };
    } else {
      throw new Error('Invalid table index');
    }
  } catch (error) {
    console.error('Set current table failed:', error);
    return { success: false, message: error.message };
  }
});

// 获取剪贴板内容
ipcMain.handle('get-clipboard-content', () => {
  const image = clipboard.readImage();
  const text = clipboard.readText();
  
  console.log('Clipboard check:', {
    hasImage: !image.isEmpty(),
    hasText: text && text.trim().length > 0,
    textLength: text ? text.length : 0
  });
  
  let imageData = null;
  if (!image.isEmpty()) {
    const pngBuffer = image.toPNG();
    imageData = pngBuffer.toString('base64');
    console.log('Image buffer length:', pngBuffer.length, 'Base64 length:', imageData.length);
  }
  
  return {
    hasImage: !image.isEmpty(),
    hasText: text && text.trim().length > 0,
    text: text || '',
    image: imageData
  };
});

// 提交内容
ipcMain.handle('submit-content', async (event, data) => {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }
    
    const currentTable = getCurrentTableConfig();
    if (!currentTable) {
      throw new Error('No table configuration selected');
    }
    
    const { contentType, content, comment, submitter } = data;

    let result;
    if (contentType === 'text') {
      result = await apiClient.submitText(currentTable, content, submitter, comment);
    } else if (contentType === 'image') {
      const imageBuffer = Buffer.from(content, 'base64');
      const fileName = `screenshot-${Date.now()}.png`;
      result = await apiClient.submitImage(currentTable, imageBuffer, fileName, submitter, comment);
    } else {
      throw new Error('Invalid content type');
    }
    
    return result;
  } catch (error) {
    console.error('Submit content failed:', error);
    return { success: false, message: error.message };
  }
});

// 应用退出前处理
app.on('before-quit', () => {
  app.isQuiting = true;
  stopRealtimeMode();
});

// 导出配置
ipcMain.handle('export-config', async (event, options = {}) => {
  try {
    const { filters = [
      { name: '配置文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ], defaultPath = '素材快捷投递工具配置.json' } = options;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出配置',
      defaultPath,
      filters
    });

    if (result.canceled) {
      return { success: false, message: '用户取消导出' };
    }

    // 准备导出的配置数据
    const exportConfig = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      config: {
        feishuAppId: appConfig.feishuAppId,
        feishuAppSecret: appConfig.feishuAppSecret,
        submitterName: appConfig.submitterName,
        shortcuts: appConfig.shortcuts,
        tableConfigs: appConfig.tableConfigs.map(table => ({
          ...table,
          // 移除敏感信息（如果需要的话）
          // 这里保留所有信息，因为是团队内部使用
        }))
  }
    };

    fs.writeFileSync(result.filePath, JSON.stringify(exportConfig, null, 2));
    
    return { 
      success: true, 
      message: '配置导出成功',
      filePath: result.filePath 
    };
  } catch (error) {
    console.error('Export config failed:', error);
    return { success: false, message: error.message };
  }
});

// 导入配置
ipcMain.handle('import-config', async (event, options = {}) => {
  try {
    const { filters = [
      { name: '配置文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ] } = options;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入配置',
      filters,
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, message: '用户取消导入' };
    }

    const filePath = result.filePaths[0];
    const configData = fs.readFileSync(filePath, 'utf8');
    const importedData = JSON.parse(configData);

    // 验证配置文件格式
    if (!importedData.config) {
      throw new Error('配置文件格式不正确');
    }

    // 备份当前配置
    const backupConfig = { ...appConfig };
    
    // 合并配置
    const newConfig = {
      ...appConfig,
      ...importedData.config,
      // 保留当前的索引设置
      currentTableIndex: appConfig.currentTableIndex
    };

    // 保存新配置
    appConfig = newConfig;
    saveConfig();

    // 重新注册快捷键
    if (importedData.config.shortcuts) {
  registerGlobalShortcuts();
    }

    // 重新初始化API客户端
    if (apiClient) {
      apiClient.updateConfig(appConfig);
    }

    return { 
      success: true, 
      message: '配置导入成功',
      importedAt: importedData.exportTime,
      tableCount: importedData.config.tableConfigs?.length || 0
    };
  } catch (error) {
    console.error('Import config failed:', error);
    return { success: false, message: error.message };
  }
});

// 显示确认对话框
ipcMain.handle('show-confirmation-dialog', async (event, options) => {
  try {
    const { title = '确认', message = '确定要执行此操作吗？', buttons = ['取消', '确认'] } = options;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title,
      message,
      buttons,
      defaultId: 1,
      cancelId: 0
    });

    return {
      success: true,
      confirmed: result.response === 1,
      buttonIndex: result.response
    };
  } catch (error) {
    console.error('Show confirmation dialog failed:', error);
    return { success: false, message: error.message };
  }
});

// 显示信息对话框
ipcMain.handle('show-info-dialog', async (event, options) => {
  try {
    const { title = '信息', message = '', type = 'info' } = options;

    await dialog.showMessageBox(mainWindow, {
      type,
      title,
      message,
      buttons: ['确定']
    });

    return { success: true };
  } catch (error) {
    console.error('Show info dialog failed:', error);
    return { success: false, message: error.message };
  }
});

// 获取实时模式状态
ipcMain.handle('get-realtime-status', () => {
  return {
    active: realtimeMode,
    shortcut: appConfig.shortcuts.smartCapture
  };
});

// 手动切换实时模式
ipcMain.handle('toggle-realtime-mode', () => {
  if (realtimeMode) {
    stopRealtimeMode();
  } else {
    startRealtimeMode();
  }
  return { active: realtimeMode };
});

app.on('will-quit', () => {
  // 停止实时模式
  stopRealtimeMode();
  // 注销所有快捷键
  globalShortcut.unregisterAll();
}); 