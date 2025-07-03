const { ipcRenderer } = require('electron');

class MainApp {
  constructor() {
    this.config = {};
    this.isCapturingShortcut = false;
    this.capturedShortcut = '';
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    this.updateUI();
    this.checkServerStatus();
  }

  async loadConfig() {
    try {
      this.config = await ipcRenderer.invoke('get-config');
      this.populateForm();
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  populateForm() {
    document.getElementById('server-url').value = this.config.serverUrl || '';
    document.getElementById('secret-key').value = this.config.secretKey || '';
    document.getElementById('submitter-name').value = this.config.submitterName || '';
    
    // 更新快捷键显示
    const shortcutKey = this.config.shortcuts?.smartCapture || 'CommandOrControl+Shift+T';
    const displayKey = this.formatShortcutForDisplay(shortcutKey);
    document.getElementById('shortcut-display').textContent = displayKey;
  }

  formatShortcutForDisplay(shortcut) {
    return shortcut
      .replace('CommandOrControl', 'Cmd')
      .replace('Command', 'Cmd')
      .replace('Control', 'Ctrl');
  }

  setupEventListeners() {
    // Tab 切换
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        this.switchTab(button.dataset.tab);
      });
    });

    // 配置表单提交
    document.getElementById('config-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveConfig();
    });

    // 测试连接
    document.getElementById('test-connection').addEventListener('click', () => {
      this.testConnection();
    });

    // 快捷键捕获相关事件
    document.getElementById('capture-shortcut-btn').addEventListener('click', () => {
      this.startShortcutCapture();
    });

    document.getElementById('save-shortcut-btn').addEventListener('click', () => {
      this.saveShortcut();
    });

    document.getElementById('cancel-shortcut-btn').addEventListener('click', () => {
      this.cancelShortcutCapture();
    });

    // 快捷操作按钮
    document.getElementById('smart-capture').addEventListener('click', () => {
      this.triggerSmartCapture();
    });

    document.getElementById('capture-text').addEventListener('click', () => {
      this.triggerTextCapture();
    });

    document.getElementById('capture-image').addEventListener('click', () => {
      this.triggerImageCapture();
    });

    // 全局键盘事件监听
    document.addEventListener('keydown', (e) => {
      if (this.isCapturingShortcut) {
        this.handleShortcutCapture(e);
      }
    });
  }

  switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 显示对应内容
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  async saveConfig() {
    const newConfig = {
      serverUrl: document.getElementById('server-url').value.trim(),
      secretKey: document.getElementById('secret-key').value.trim(),
      submitterName: document.getElementById('submitter-name').value.trim(),
      shortcuts: {
        smartCapture: this.config.shortcuts?.smartCapture || 'CommandOrControl+Shift+T'
      }
    };

    // 验证必填字段
    if (!newConfig.serverUrl || !newConfig.secretKey || !newConfig.submitterName) {
      this.showMessage('请填写所有必填字段', 'error');
      return;
    }

    // 验证 URL 格式
    try {
      new URL(newConfig.serverUrl);
    } catch (error) {
      this.showMessage('请输入有效的服务器地址', 'error');
      return;
    }

    // 验证快捷键格式
    if (!this.validateShortcut(newConfig.shortcuts.smartCapture)) {
      this.showMessage('快捷键格式不正确，请重新设置快捷键', 'error');
      return;
    }

    try {
      await ipcRenderer.invoke('save-config', newConfig);
      this.config = { ...this.config, ...newConfig };
      this.showMessage('配置已保存，快捷键已立即生效', 'success');
      this.checkServerStatus();
    } catch (error) {
      console.error('Failed to save config:', error);
      this.showMessage('保存配置失败', 'error');
    }
  }

  validateShortcut(shortcut) {
    // 基本的快捷键格式验证
    const validModifiers = ['CommandOrControl', 'Cmd', 'Command', 'Control', 'Ctrl', 'Alt', 'Option', 'Shift'];
    const parts = shortcut.split('+');
    
    if (parts.length < 2) {
      return false;
    }

    // 检查是否包含有效的修饰键
    const hasValidModifier = parts.slice(0, -1).some(part => 
      validModifiers.includes(part)
    );

    return hasValidModifier;
  }

  async testConnection() {
    const button = document.getElementById('test-connection');
    const originalText = button.textContent;
    
    button.textContent = '测试中...';
    button.disabled = true;

    try {
      // 先保存当前配置（不验证完整性，只用于测试）
      const testConfig = {
        serverUrl: document.getElementById('server-url').value.trim(),
        secretKey: document.getElementById('secret-key').value.trim(),
        submitterName: this.config.submitterName || 'test'
      };

      if (!testConfig.serverUrl || !testConfig.secretKey) {
        throw new Error('请先填写服务器地址和访问密钥');
      }

      // 临时保存配置用于测试
      await ipcRenderer.invoke('save-config', testConfig);
      
      // 进行连接测试
      const result = await ipcRenderer.invoke('test-connection');
      
      if (result.success) {
        this.showMessage('连接测试成功', 'success');
        this.updateStatus('online', '已连接');
      } else {
        throw new Error(result.message || '连接失败');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      this.showMessage(`连接测试失败: ${error.message}`, 'error');
      this.updateStatus('error', '连接失败');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  }

  async checkServerStatus() {
    if (!this.config.serverUrl || !this.config.secretKey) {
      this.updateStatus('offline', '未配置');
      return;
    }

    try {
      const result = await ipcRenderer.invoke('test-connection');
      if (result.success) {
        this.updateStatus('online', '已连接');
      } else {
        this.updateStatus('error', '认证失败');
      }
    } catch (error) {
      this.updateStatus('offline', '未连接');
    }
  }

  updateStatus(status, text) {
    const statusElement = document.getElementById('status');
    const dotElement = statusElement.querySelector('.status-dot');
    const textElement = statusElement.querySelector('.status-text');

    dotElement.className = `status-dot ${status}`;
    textElement.textContent = text;
  }

  async triggerSmartCapture() {
    try {
      await ipcRenderer.invoke('trigger-smart-capture');
    } catch (error) {
      console.error('Failed to trigger smart capture:', error);
      this.showMessage('智能捕获失败', 'error');
    }
  }

  async triggerTextCapture() {
    try {
      await ipcRenderer.invoke('trigger-text-capture');
    } catch (error) {
      console.error('Failed to capture text:', error);
      this.showMessage('文本捕获失败', 'error');
    }
  }

  async triggerImageCapture() {
    try {
      await ipcRenderer.invoke('trigger-image-capture');
    } catch (error) {
      console.error('Failed to capture image:', error);
      this.showMessage('图片捕获失败', 'error');
    }
  }

  showMessage(message, type = 'info') {
    // 创建消息提示
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    // 添加样式
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    `;

    // 根据类型设置颜色
    switch (type) {
      case 'success':
        messageDiv.style.background = '#10b981';
        messageDiv.style.color = 'white';
        break;
      case 'error':
        messageDiv.style.background = '#ef4444';
        messageDiv.style.color = 'white';
        break;
      default:
        messageDiv.style.background = '#3b82f6';
        messageDiv.style.color = 'white';
    }

    document.body.appendChild(messageDiv);

    // 3秒后自动移除
    setTimeout(() => {
      messageDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 300);
    }, 3000);
  }

  updateUI() {
    // 定期检查服务器状态
    setInterval(() => {
      this.checkServerStatus();
    }, 30000); // 每30秒检查一次
  }

  startShortcutCapture() {
    this.isCapturingShortcut = true;
    document.getElementById('shortcut-capture-area').style.display = 'block';
    document.getElementById('shortcut-capture-area').classList.add('active');
    document.querySelector('.capture-prompt').textContent = '请按下您想要设置的快捷键组合...';
    document.getElementById('save-shortcut-btn').disabled = true;
    this.capturedShortcut = '';
  }

  handleShortcutCapture(e) {
    e.preventDefault();
    e.stopPropagation();

    const modifiers = [];
    if (e.metaKey || e.ctrlKey) modifiers.push('CommandOrControl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    // 忽略单独的修饰键
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
      return;
    }

    // 忽略一些系统保留的按键
    if (['Escape', 'Tab', 'CapsLock', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(e.key)) {
      document.querySelector('.capture-prompt').textContent = `${e.key} 键不能用作快捷键，请重新选择...`;
      return;
    }

    // Escape键取消捕获
    if (e.key === 'Escape') {
      this.cancelShortcutCapture();
      return;
    }

    // 必须包含至少一个修饰键
    if (modifiers.length === 0) {
      document.querySelector('.capture-prompt').textContent = '请使用包含 Cmd/Ctrl/Alt/Shift 的组合键...';
      return;
    }

    // 构建快捷键字符串 - 保持 Electron 标准格式
    const shortcut = [...modifiers, e.key.toUpperCase()].join('+');
    this.capturedShortcut = shortcut;

    // 显示捕获到的快捷键
    const displayShortcut = this.formatShortcutForDisplay(shortcut);
    document.querySelector('.capture-prompt').textContent = `捕获到快捷键: ${displayShortcut}`;
    document.getElementById('save-shortcut-btn').disabled = false;
  }

  saveShortcut() {
    if (!this.capturedShortcut) return;

    // 更新显示
    const displayKey = this.formatShortcutForDisplay(this.capturedShortcut);
    document.getElementById('shortcut-display').textContent = displayKey;
    
    // 更新配置（但不立即保存到文件）
    if (!this.config.shortcuts) this.config.shortcuts = {};
    this.config.shortcuts.smartCapture = this.capturedShortcut;

    this.cancelShortcutCapture();
    this.showMessage('快捷键已更新，请点击"保存配置"来应用更改', 'success');
  }

  cancelShortcutCapture() {
    this.isCapturingShortcut = false;
    this.capturedShortcut = '';
    document.getElementById('shortcut-capture-area').style.display = 'none';
    document.getElementById('shortcut-capture-area').classList.remove('active');
  }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new MainApp();
}); 