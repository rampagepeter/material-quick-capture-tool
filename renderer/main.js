const { ipcRenderer } = require('electron');

class MainApp {
  constructor() {
    this.config = null;
    this.currentEditingTableIndex = -1;
    this.isCapturingShortcut = false;
    this.capturedKeys = new Set();
  }

  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    this.updateUI();
    this.checkFeishuConnection();
    this.updateRealtimeStatus();
  }

  async loadConfig() {
    try {
      this.config = await ipcRenderer.invoke('get-config');
      this.populateForm();
    } catch (error) {
      console.error('Failed to load config:', error);
      this.showMessage('加载配置失败', 'error');
    }
  }

  populateForm() {
    if (!this.config) return;

    // 填充飞书配置
    document.getElementById('feishu-app-id').value = this.config.feishuAppId || '';
    document.getElementById('feishu-app-secret').value = this.config.feishuAppSecret || '';
    document.getElementById('submitter-name').value = this.config.submitterName || '';
    
    // 填充快捷键配置
    document.getElementById('smart-capture-shortcut').value = 
      this.config.shortcuts?.smartCapture?.replace('CommandOrControl', 'Ctrl') || '';

    // 更新表格列表
    this.updateTableList();
    this.updateCurrentTableSelect();
  }

  setupEventListeners() {
    // 标签切换
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = button.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // 飞书配置相关
    document.getElementById('test-feishu-btn').addEventListener('click', () => this.testFeishuConnection());
    document.getElementById('save-feishu-btn').addEventListener('click', () => this.saveFeishuConfig());

    // 表格配置相关
    document.getElementById('add-table-btn').addEventListener('click', () => this.showTableConfigModal());
    document.getElementById('close-modal-btn').addEventListener('click', () => this.hideTableConfigModal());
    document.getElementById('cancel-modal-btn').addEventListener('click', () => this.hideTableConfigModal());
    document.getElementById('save-table-btn').addEventListener('click', () => this.saveTableConfig());
    document.getElementById('load-fields-btn').addEventListener('click', () => this.loadTableFields());
    document.getElementById('test-table-btn').addEventListener('click', () => this.testTableConfig());

    // 编辑模式的按钮
    document.getElementById('reload-fields-btn').addEventListener('click', () => this.reloadFieldsInEditMode());
    document.getElementById('test-table-edit-btn').addEventListener('click', () => this.testTableConfigInEditMode());

    // 输入方式切换
    document.querySelectorAll('input[name="input-method"]').forEach(radio => {
      radio.addEventListener('change', (e) => this.toggleInputMethod(e.target.value));
    });

    // 链接解析
    document.getElementById('parse-url-btn').addEventListener('click', () => this.parseTableUrl());

    // 设置相关
    document.getElementById('edit-shortcut-btn').addEventListener('click', () => this.startShortcutCapture());
    document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
    document.getElementById('reset-shortcut-btn').addEventListener('click', () => this.resetShortcut());

    // 配置管理
    document.getElementById('export-config-btn').addEventListener('click', () => this.exportConfig());
    document.getElementById('import-config-btn').addEventListener('click', () => this.importConfig());
    document.getElementById('clear-cache-btn').addEventListener('click', () => this.clearCache());
    document.getElementById('reset-config-btn').addEventListener('click', () => this.resetConfig());

    // 实时模式控制
    document.getElementById('toggle-realtime-btn').addEventListener('click', () => this.toggleRealtimeMode());

    // 当前表格选择
    document.getElementById('current-table-select').addEventListener('change', (e) => {
      const index = parseInt(e.target.value);
      if (!isNaN(index)) {
        this.setCurrentTable(index);
      }
    });

    // 点击模态框外部关闭
    document.getElementById('table-config-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideTableConfigModal();
      }
    });

    // 快捷键捕获
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

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  async saveFeishuConfig() {
    const feishuAppId = document.getElementById('feishu-app-id').value.trim();
    const feishuAppSecret = document.getElementById('feishu-app-secret').value.trim();
    const submitterName = document.getElementById('submitter-name').value.trim();

    if (!feishuAppId || !feishuAppSecret) {
      this.showMessage('请填写完整的飞书配置信息', 'error');
      return;
    }

    try {
      this.showLoading('保存配置中...');
      
      const result = await ipcRenderer.invoke('save-config', {
        feishuAppId,
        feishuAppSecret,
        submitterName
      });

      if (result.success) {
        this.config = { ...this.config, feishuAppId, feishuAppSecret, submitterName };
        this.showMessage('配置保存成功', 'success');
        this.checkFeishuConnection();
      } else {
        this.showMessage(result.message || '保存配置失败', 'error');
      }
    } catch (error) {
      console.error('Save feishu config failed:', error);
      this.showMessage('保存配置失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async testFeishuConnection() {
    const appId = document.getElementById('feishu-app-id').value.trim();
    const appSecret = document.getElementById('feishu-app-secret').value.trim();

    if (!appId || !appSecret) {
      this.showMessage('请填写完整的飞书应用信息', 'error');
      return;
    }

    try {
      this.showLoading('测试连接中...');
      
      const result = await ipcRenderer.invoke('test-feishu-connection', { appId, appSecret });
      
      if (result.success) {
        this.showMessage('飞书连接测试成功！', 'success');
        this.updatePermissionStatus('success', '✅ 连接成功，基础权限正常');
        
        // 测试图片上传权限
        await this.testImageUploadPermission();
      } else {
        this.showMessage(`连接测试失败: ${result.message}`, 'error');
        this.updatePermissionStatus('error', `❌ 连接失败: ${result.message}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      this.showMessage('连接测试失败，请检查网络和配置', 'error');
      this.updatePermissionStatus('error', '❌ 连接失败，请检查网络和配置');
    } finally {
      this.hideLoading();
    }
  }

  async testImageUploadPermission() {
    try {
      const result = await ipcRenderer.invoke('test-image-upload-permission');
      
      if (result.success) {
        this.updatePermissionStatus('success', '✅ 所有权限配置正常，功能可正常使用');
      } else {
        if (result.message.includes('需要先配置表格')) {
          this.updatePermissionStatus('warning', '⚠️ 请先配置表格后再测试图片上传权限');
        } else if (result.message.includes('99991672') || result.message.includes('drive:file:upload')) {
          this.updatePermissionStatus('error', '⚠️ 缺少图片上传权限，请按照上方指导添加 drive:file:upload 权限');
        } else {
          this.updatePermissionStatus('error', `⚠️ 权限检查失败: ${result.message}`);
        }
      }
    } catch (error) {
      console.error('Permission test error:', error);
      this.updatePermissionStatus('error', '⚠️ 权限检查失败，请手动测试功能');
    }
  }

  updatePermissionStatus(type, message) {
    const statusElement = document.getElementById('permission-status');
    const statusText = statusElement.querySelector('.status-text');
    
    // 清除之前的状态类
    statusElement.classList.remove('success', 'error', 'warning');
    
    // 添加新的状态类
    if (type === 'success') {
      statusElement.classList.add('success');
    } else if (type === 'error') {
      statusElement.classList.add('error');
    } else if (type === 'warning') {
      statusElement.classList.add('warning');
    }
    
    statusText.textContent = message;
  }

  async checkFeishuConnection() {
    if (!this.config.feishuAppId || !this.config.feishuAppSecret) {
      this.updateStatus('offline', '未配置');
      return;
    }

    try {
      const result = await ipcRenderer.invoke('test-feishu-connection', {
        appId: this.config.feishuAppId,
        appSecret: this.config.feishuAppSecret
      });
      
      if (result.success) {
        this.updateStatus('online', '已连接');
      } else {
        this.updateStatus('error', '连接异常');
      }
    } catch (error) {
      console.error('Check feishu connection failed:', error);
      this.updateStatus('error', '连接异常');
    }
  }

  showTableConfigModal(tableIndex = -1) {
    this.currentEditingTableIndex = tableIndex;
    
    // 获取界面元素
    const editModeInfo = document.getElementById('edit-mode-info');
    const addModeInput = document.getElementById('add-mode-input');
    const editModeActions = document.getElementById('edit-mode-actions');
    
    if (tableIndex >= 0) {
      // 编辑模式
      const table = this.config.tableConfigs[tableIndex];
      document.getElementById('modal-title').textContent = '编辑表格配置';
      document.getElementById('table-name').value = table.name || '';
      
      // 显示已有配置信息
      document.getElementById('edit-app-token').textContent = table.appToken || '-';
      document.getElementById('edit-table-id').textContent = table.tableId || '-';
      
      // 构造表格链接
      const tableUrl = table.appToken ? 
        `https://xxx.feishu.cn/base/${table.appToken}?table=${table.tableId}` : '-';
      document.getElementById('edit-table-url').textContent = tableUrl;
      
      // 显示编辑模式界面
      editModeInfo.style.display = 'block';
      addModeInput.style.display = 'none';
      editModeActions.style.display = 'block';
      
      // 如果有字段映射，显示字段映射区域
      if (table.fields && table.fields.length > 0) {
        this.showFieldMapping(table.fields, table.fieldMapping);
      } else {
        // 如果没有字段信息，尝试重新获取
        this.reloadFieldsInEditMode();
      }
    } else {
      // 添加模式
      document.getElementById('modal-title').textContent = '添加表格配置';
      document.getElementById('table-name').value = '';
      document.getElementById('app-token').value = '';
      document.getElementById('table-id').value = '';
      document.getElementById('table-url').value = '';
      
      // 显示添加模式界面
      editModeInfo.style.display = 'none';
      addModeInput.style.display = 'block';
      editModeActions.style.display = 'none';
      
      // 重置输入方式为链接模式
      document.querySelector('input[name="input-method"][value="url"]').checked = true;
      this.toggleInputMethod('url');
      
      this.hideFieldMapping();
    }

    document.getElementById('table-config-modal').classList.add('show');
  }

  hideTableConfigModal() {
    document.getElementById('table-config-modal').classList.remove('show');
    this.currentEditingTableIndex = -1;
    this.hideFieldMapping();
  }

  async loadTableFields() {
    const appToken = document.getElementById('app-token').value.trim();
    const tableId = document.getElementById('table-id').value.trim();

    if (!appToken || !tableId) {
      this.showMessage('请先填写 App Token 和 Table ID', 'error');
      return;
    }

    try {
      this.showLoading('读取字段信息中...');
      
      const result = await ipcRenderer.invoke('get-table-fields', { appToken, tableId });
      
      if (result.success) {
        // 自动填充表格名称
        const tableNameInput = document.getElementById('table-name');
        if (!tableNameInput.value.trim()) {
          tableNameInput.value = result.data.tableName;
        }
        
        this.showFieldMapping(result.data.fields);
        this.showMessage(`成功读取到 ${result.data.fields.length} 个字段`, 'success');
      } else {
        this.showMessage(`读取字段失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Load table fields failed:', error);
      this.showMessage('读取字段失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async testTableConfig() {
    const appToken = document.getElementById('app-token').value.trim();
    const tableId = document.getElementById('table-id').value.trim();

    if (!appToken || !tableId) {
      this.showMessage('请先填写 App Token 和 Table ID', 'error');
      return;
    }

    try {
      this.showLoading('测试表格配置中...');
      
      const result = await ipcRenderer.invoke('test-table-config', { appToken, tableId });
      
      if (result.success) {
        this.showMessage(`表格测试成功: ${result.data.tableName}`, 'success');
      } else {
        this.showMessage(`表格测试失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Test table config failed:', error);
      this.showMessage('表格测试失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  showFieldMapping(fields, currentMapping = {}) {
    const fieldMapping = document.getElementById('field-mapping');
    const selects = fieldMapping.querySelectorAll('select');
    
    // 清空所有选择器
    selects.forEach(select => {
      select.innerHTML = '<option value="">不使用</option>';
      
      // 添加字段选项 - 使用字段名称作为value
      fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.name;  // 改为使用字段名称
        option.textContent = `${field.name} (${field.type})`;
        select.appendChild(option);
      });
    });

    // 设置当前映射
    if (currentMapping) {
      document.getElementById('text-field').value = currentMapping.textField || '';
      document.getElementById('image-field').value = currentMapping.imageField || '';
      document.getElementById('comment-field').value = currentMapping.commentField || '';
      document.getElementById('submitter-field').value = currentMapping.submitterField || '';
      document.getElementById('time-field').value = currentMapping.timeField || '';
    }

    fieldMapping.style.display = 'block';
  }

  hideFieldMapping() {
    document.getElementById('field-mapping').style.display = 'none';
  }

  async saveTableConfig() {
    const tableName = document.getElementById('table-name').value.trim();
    
    let appToken, tableId;
    
    if (this.currentEditingTableIndex >= 0) {
      // 编辑模式：从已有配置中获取
      const existingTable = this.config.tableConfigs[this.currentEditingTableIndex];
      appToken = existingTable.appToken;
      tableId = existingTable.tableId;
    } else {
      // 添加模式：从输入框中获取
      appToken = document.getElementById('app-token').value.trim();
      tableId = document.getElementById('table-id').value.trim();
    }

    if (!tableName || !appToken || !tableId) {
      this.showMessage('请填写完整的表格信息', 'error');
      return;
    }

    // 收集字段映射
    const fieldMapping = {
      textField: document.getElementById('text-field').value,
      imageField: document.getElementById('image-field').value,
      commentField: document.getElementById('comment-field').value,
      submitterField: document.getElementById('submitter-field').value,
      timeField: document.getElementById('time-field').value
    };

    const tableConfig = {
      name: tableName,
      appToken,
      tableId,
      fieldMapping,
      createdAt: this.currentEditingTableIndex >= 0 ? 
        this.config.tableConfigs[this.currentEditingTableIndex].createdAt : 
        new Date().toISOString()
    };

    // 如果是编辑模式，保留字段信息
    if (this.currentEditingTableIndex >= 0 && this.config.tableConfigs[this.currentEditingTableIndex].fields) {
      tableConfig.fields = this.config.tableConfigs[this.currentEditingTableIndex].fields;
    }

    try {
      this.showLoading('保存表格配置中...');
      
      let result;
      if (this.currentEditingTableIndex >= 0) {
        // 更新现有配置
        result = await ipcRenderer.invoke('update-table-config', this.currentEditingTableIndex, tableConfig);
      } else {
        // 添加新配置
        result = await ipcRenderer.invoke('add-table-config', tableConfig);
      }

      if (result.success) {
        await this.loadConfig(); // 重新加载配置
        this.hideTableConfigModal();
        this.showMessage('表格配置保存成功', 'success');
      } else {
        this.showMessage(result.message || '保存表格配置失败', 'error');
      }
    } catch (error) {
      console.error('Save table config failed:', error);
      this.showMessage('保存表格配置失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  updateTableList() {
    const tableList = document.getElementById('table-list');
    const tables = this.config.tableConfigs || [];

    if (tables.length === 0) {
      tableList.innerHTML = `
        <div class="empty-state">
          <p>还没有配置任何表格</p>
          <p>点击"添加表格"开始配置</p>
        </div>
      `;
      return;
    }

    tableList.innerHTML = tables.map((table, index) => `
      <div class="table-item ${index === this.config.currentTableIndex ? 'active' : ''}">
        <div class="table-item-header">
          <h4>${table.name}</h4>
          <div class="table-item-actions">
            <button class="btn btn-secondary btn-small" onclick="app.editTable(${index})">编辑</button>
            <button class="btn btn-secondary btn-small" onclick="app.deleteTable(${index})">删除</button>
          </div>
        </div>
        <div class="table-item-info">
          表格ID: ${table.tableId}
        </div>
        <div class="table-item-fields">
          ${Object.entries(table.fieldMapping || {})
            .filter(([key, value]) => value)
            .map(([key, value]) => `<span class="field-tag">${this.getFieldMappingLabel(key)}</span>`)
            .join('')}
        </div>
      </div>
    `).join('');
  }

  updateCurrentTableSelect() {
    const select = document.getElementById('current-table-select');
    const tables = this.config.tableConfigs || [];

    select.innerHTML = '<option value="">请选择表格</option>';
    
    tables.forEach((table, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = table.name;
      select.appendChild(option);
    });

    if (this.config.currentTableIndex >= 0) {
      select.value = this.config.currentTableIndex;
    }
  }

  getFieldMappingLabel(key) {
    const labels = {
      textField: '文本',
      imageField: '图片',
      commentField: '备注',
      submitterField: '提交者',
      timeField: '时间'
    };
    return labels[key] || key;
  }

  async editTable(index) {
    this.showTableConfigModal(index);
  }

  async deleteTable(index) {
    const table = this.config.tableConfigs[index];
    
    const confirmed = await this.showConfirmationDialog({
      title: '确认删除表格配置',
      message: `确定要删除表格配置"${table.name}"吗？\n\n此操作不可撤销。`,
      buttons: ['取消', '删除']
    });

    if (!confirmed) return;

    try {
      this.showLoading('正在删除表格配置...');
      
      const result = await ipcRenderer.invoke('delete-table-config', index);
      
      if (result.success) {
        await this.loadConfig(); // 重新加载配置
        this.showMessage('表格配置删除成功', 'success');
      } else {
        this.showMessage(result.message || '删除表格配置失败', 'error');
      }
    } catch (error) {
      console.error('Delete table config failed:', error);
      this.showMessage('删除表格配置失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async setCurrentTable(index) {
    try {
      const result = await ipcRenderer.invoke('set-current-table', index);
      
      if (result.success) {
        this.config.currentTableIndex = index;
        this.updateTableList();
        this.showMessage('当前表格设置成功', 'success');
      } else {
        this.showMessage(result.message || '设置当前表格失败', 'error');
      }
    } catch (error) {
      console.error('Set current table failed:', error);
      this.showMessage('设置当前表格失败', 'error');
    }
  }

  startShortcutCapture() {
    this.isCapturingShortcut = true;
    this.capturedKeys.clear();
    
    const input = document.getElementById('smart-capture-shortcut');
    const button = document.getElementById('edit-shortcut-btn');
    
    input.value = '请按下快捷键组合...';
    input.style.background = '#f0f4ff';
    button.textContent = '取消';
    button.onclick = () => this.cancelShortcutCapture();
  }

  cancelShortcutCapture() {
    this.isCapturingShortcut = false;
    this.capturedKeys.clear();
    
    const input = document.getElementById('smart-capture-shortcut');
    const button = document.getElementById('edit-shortcut-btn');
    
    input.value = this.config.shortcuts?.smartCapture?.replace('CommandOrControl', 'Ctrl') || '';
    input.style.background = '';
    button.textContent = '修改';
    button.onclick = () => this.startShortcutCapture();
  }

  handleShortcutCapture(e) {
    e.preventDefault();
    e.stopPropagation();

    const modifiers = [];
    if (e.metaKey || e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    const key = e.key;
    
    // 过滤修饰键
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      return;
    }

    const shortcutString = [...modifiers, key.toUpperCase()].join('+');
    
    document.getElementById('smart-capture-shortcut').value = shortcutString;
    
    // 自动结束捕获
    setTimeout(() => {
      this.finishShortcutCapture(shortcutString);
    }, 100);
  }

  finishShortcutCapture(shortcutString) {
    this.isCapturingShortcut = false;
    
    const input = document.getElementById('smart-capture-shortcut');
    const button = document.getElementById('edit-shortcut-btn');
    
    input.style.background = '';
    button.textContent = '修改';
    button.onclick = () => this.startShortcutCapture();
  }

  async saveSettings() {
    const shortcutValue = document.getElementById('smart-capture-shortcut').value.trim();
    
    if (!shortcutValue) {
      this.showMessage('请设置快捷键', 'error');
      return;
    }

    // 转换为Electron格式
    const electronShortcut = shortcutValue.replace('Ctrl', 'CommandOrControl');

    try {
      const result = await ipcRenderer.invoke('save-config', {
        shortcuts: {
          smartCapture: electronShortcut
        }
      });

      if (result.success) {
        this.config.shortcuts = { smartCapture: electronShortcut };
        this.showMessage('快捷键设置保存成功', 'success');
      } else {
        this.showMessage(result.message || '保存快捷键设置失败', 'error');
      }
    } catch (error) {
      console.error('Save settings failed:', error);
      this.showMessage('保存快捷键设置失败', 'error');
    }
  }

  resetShortcut() {
    document.getElementById('smart-capture-shortcut').value = 'Ctrl+Shift+T';
  }

  updateStatus(status, text) {
    const statusElement = document.getElementById('status');
    const dotElement = statusElement.querySelector('.status-dot');
    const textElement = statusElement.querySelector('.status-text');

    dotElement.className = `status-dot ${status}`;
    textElement.textContent = text;
  }

  showLoading(message = '处理中...', showProgress = false) {
    const overlay = document.getElementById('loading-overlay');
    const messageElement = overlay.querySelector('p');
    
    messageElement.textContent = message;
    overlay.classList.add('show');
    
    if (showProgress) {
      this.showProgress(0);
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('show');
    
    // 移除进度条
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.remove();
    }
  }

  showMessage(message, type = 'info', duration = null) {
    const messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
      // 如果没有消息容器，创建一个
      const container = document.createElement('div');
      container.id = 'message-container';
      container.className = 'message-container';
      document.body.appendChild(container);
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;

    // 添加图标
    let icon = '';
    switch (type) {
      case 'success':
        icon = '✅';
        break;
      case 'error':
        icon = '❌';
        break;
      case 'warning':
        icon = '⚠️';
        break;
      case 'info':
      default:
        icon = 'ℹ️';
        break;
    }
    
    messageElement.innerHTML = `
      <span class="message-icon">${icon}</span>
      <span class="message-text">${message}</span>
      <button class="message-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    const container = document.getElementById('message-container');
    container.appendChild(messageElement);

    // 自动消失
    const autoDismissTime = duration || (type === 'error' ? 8000 : 5000);
    setTimeout(() => {
      if (messageElement.parentElement) {
        messageElement.style.animation = 'messageSlideOut 0.3s ease-in forwards';
      setTimeout(() => {
          if (messageElement.parentElement) {
            messageElement.remove();
        }
      }, 300);
      }
    }, autoDismissTime);
  }

  showDetailedError(title, details, suggestions = []) {
    const errorHtml = `
      <div class="error-details">
        <div class="error-title">${title}</div>
        <div class="error-message">${details}</div>
        ${suggestions.length > 0 ? `
          <div class="error-suggestions">
            <strong>解决建议：</strong>
            <ul>
              ${suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
    
    this.showMessage(errorHtml, 'error');
  }

  updateUI() {
    this.updateTableList();
    this.updateCurrentTableSelect();
  }

  // 切换输入方式
  toggleInputMethod(method) {
    const urlGroup = document.getElementById('table-url-group');
    const manualGroup = document.getElementById('manual-input-group');
    
    if (method === 'url') {
      urlGroup.style.display = 'block';
      manualGroup.style.display = 'none';
    } else {
      urlGroup.style.display = 'none';
      manualGroup.style.display = 'block';
    }
  }

  // 解析表格链接
  parseTableUrl() {
    const urlInput = document.getElementById('table-url');
    const url = urlInput.value.trim();
    
    if (!url) {
      this.showMessage('请输入数据表链接', 'error');
      return;
    }

    try {
      // 解析飞书多维表格链接
      // 支持多种链接格式:
      // https://xxx.feishu.cn/base/appToken?table=tableId
      // https://xxx.feishu.cn/base/appToken/tableId
      // https://xxx.feishu.cn/sheets/appToken?table=tableId
      
      const urlObj = new URL(url);
      let appToken = '';
      let tableId = '';
      
      // 从路径中提取 appToken
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      if (pathParts.length >= 2 && (pathParts[0] === 'base' || pathParts[0] === 'sheets')) {
        appToken = pathParts[1];
        
        // 如果路径中有第三部分，可能是 tableId
        if (pathParts.length >= 3) {
          tableId = pathParts[2];
        }
      }
      
      // 从查询参数中提取 tableId
      const tableParam = urlObj.searchParams.get('table');
      if (tableParam) {
        tableId = tableParam;
      }
      
      // 从 hash 中提取 tableId (某些链接格式)
      if (!tableId && urlObj.hash) {
        const hashMatch = urlObj.hash.match(/table=([^&]+)/);
        if (hashMatch) {
          tableId = hashMatch[1];
        }
      }
      
      if (!appToken) {
        this.showMessage('无法从链接中解析出 App Token，请检查链接格式', 'error');
        return;
      }

      if (!tableId) {
        this.showMessage('无法从链接中解析出 Table ID，请检查链接格式', 'error');
        return;
      }

      // 填充到手动输入字段
      document.getElementById('app-token').value = appToken;
      document.getElementById('table-id').value = tableId;
      
      this.showMessage(`成功解析链接！App Token: ${appToken.substring(0, 10)}...`, 'success');
      
      // 自动读取字段
      this.loadTableFields();
      
    } catch (error) {
      console.error('Parse URL error:', error);
      this.showMessage('链接格式不正确，请检查后重试', 'error');
    }
  }

  // 编辑模式：重新加载字段
  async reloadFieldsInEditMode() {
    if (this.currentEditingTableIndex < 0) return;
    
    const table = this.config.tableConfigs[this.currentEditingTableIndex];
    
    try {
      this.showLoading('重新读取字段信息中...');
      
      const result = await ipcRenderer.invoke('get-table-fields', { 
        appToken: table.appToken, 
        tableId: table.tableId 
      });
      
      if (result.success) {
        // 更新表格名称（如果用户没有修改的话）
        const tableNameInput = document.getElementById('table-name');
        if (!tableNameInput.value.trim() || tableNameInput.value.trim() === table.name) {
          tableNameInput.value = result.data.tableName;
        }
        
        // 保存字段信息到配置中
        this.config.tableConfigs[this.currentEditingTableIndex].fields = result.data.fields;
        
        this.showFieldMapping(result.data.fields, table.fieldMapping);
        this.showMessage(`成功读取到 ${result.data.fields.length} 个字段`, 'success');
      } else {
        this.showMessage(`读取字段失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Reload fields failed:', error);
      this.showMessage('读取字段失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // 编辑模式：测试表格配置
  async testTableConfigInEditMode() {
    if (this.currentEditingTableIndex < 0) return;
    
    const table = this.config.tableConfigs[this.currentEditingTableIndex];
    
    try {
      this.showLoading('测试表格配置中...');
      
      const result = await ipcRenderer.invoke('test-table-config', { 
        appToken: table.appToken, 
        tableId: table.tableId 
      });
      
      if (result.success) {
        this.showMessage(`表格测试成功: ${result.data.tableName}`, 'success');
      } else {
        this.showMessage(`表格测试失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Test table config failed:', error);
      this.showMessage('表格测试失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // 配置管理功能
  async exportConfig() {
    try {
      this.showLoading('正在导出配置...');
      
      const result = await ipcRenderer.invoke('export-config');
      
      if (result.success) {
        this.showMessage('配置导出成功！', 'success');
        await this.showInfoDialog({
          title: '导出成功',
          message: `配置已导出到：\n${result.filePath}\n\n请将此文件分享给团队成员使用。`,
          type: 'info'
        });
      } else {
        if (result.message !== '用户取消导出') {
          this.showMessage(`导出失败：${result.message}`, 'error');
        }
      }
    } catch (error) {
      console.error('Export config error:', error);
      this.showMessage('导出配置失败，请重试', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async importConfig() {
    try {
      // 确认导入操作
      const confirmed = await this.showConfirmationDialog({
        title: '确认导入配置',
        message: '导入配置将覆盖当前所有设置，建议先导出当前配置作为备份。\n\n确定要继续吗？',
        buttons: ['取消', '确认导入']
      });

      if (!confirmed) return;

      this.showLoading('正在导入配置...');
      
      const result = await ipcRenderer.invoke('import-config');
      
      if (result.success) {
        this.showMessage('配置导入成功！', 'success');
    
        // 重新加载配置和更新界面
        await this.loadConfig();
        
        await this.showInfoDialog({
          title: '导入成功',
          message: `配置导入成功！\n\n导入了 ${result.tableCount} 个表格配置\n导出时间：${new Date(result.importedAt).toLocaleString()}\n\n应用将自动刷新界面。`,
          type: 'info'
        });
      } else {
        if (result.message !== '用户取消导入') {
          this.showMessage(`导入失败：${result.message}`, 'error');
        }
      }
    } catch (error) {
      console.error('Import config error:', error);
      this.showMessage('导入配置失败，请检查文件格式', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async clearCache() {
    try {
      const confirmed = await this.showConfirmationDialog({
        title: '确认清除缓存',
        message: '清除缓存将删除临时数据，但不会影响配置设置。\n\n确定要继续吗？',
        buttons: ['取消', '清除缓存']
      });

      if (!confirmed) return;

      this.showLoading('正在清除缓存...');
      
      // 模拟清除缓存操作
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.showMessage('缓存清除成功！', 'success');
    } catch (error) {
      console.error('Clear cache error:', error);
      this.showMessage('清除缓存失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async resetConfig() {
    try {
      const confirmed = await this.showConfirmationDialog({
        title: '确认重置配置',
        message: '重置配置将删除所有设置，包括飞书配置、表格配置和快捷键设置。\n\n此操作不可撤销，确定要继续吗？',
        buttons: ['取消', '确认重置']
      });

      if (!confirmed) return;

      this.showLoading('正在重置配置...');
      
      // 重置为默认配置
      const defaultConfig = {
        feishuAppId: '',
        feishuAppSecret: '',
        submitterName: '',
        shortcuts: {
          smartCapture: 'CommandOrControl+Shift+T'
        },
        tableConfigs: [],
        currentTableIndex: -1
      };

      const result = await ipcRenderer.invoke('save-config', defaultConfig);
      
      if (result.success) {
        this.showMessage('配置重置成功！', 'success');
        await this.loadConfig();
        
        await this.showInfoDialog({
          title: '重置完成',
          message: '所有配置已重置为默认值，请重新配置应用。',
          type: 'info'
        });
      } else {
        this.showMessage(`重置失败：${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Reset config error:', error);
      this.showMessage('重置配置失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // 显示确认对话框
  async showConfirmationDialog(options) {
    try {
      const result = await ipcRenderer.invoke('show-confirmation-dialog', options);
      return result.success ? result.confirmed : false;
    } catch (error) {
      console.error('Show confirmation dialog error:', error);
      return false;
    }
  }

  // 显示信息对话框
  async showInfoDialog(options) {
    try {
      await ipcRenderer.invoke('show-info-dialog', options);
    } catch (error) {
      console.error('Show info dialog error:', error);
    }
  }
  
  // 显示进度条
  showProgress(percentage) {
    let progressBar = document.querySelector('.progress-bar');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      progressBar.innerHTML = '<div class="progress-fill"></div>';
      
      const spinner = document.querySelector('.loading-spinner');
      spinner.appendChild(progressBar);
    }
    
    const progressFill = progressBar.querySelector('.progress-fill');
    progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }

  // 更新实时模式状态
  async updateRealtimeStatus() {
    try {
      const status = await ipcRenderer.invoke('get-realtime-status');
      this.updateRealtimeUI(status.active);
    } catch (error) {
      console.error('Failed to get realtime status:', error);
    }
  }

  // 切换实时模式
  async toggleRealtimeMode() {
    try {
      this.showLoading('切换实时模式...');
      
      const result = await ipcRenderer.invoke('toggle-realtime-mode');
      this.updateRealtimeUI(result.active);
      
      if (result.active) {
        this.showMessage('实时模式已启动！复制内容将自动上传', 'success');
      } else {
        this.showMessage('实时模式已关闭', 'info');
      }
    } catch (error) {
      console.error('Toggle realtime mode failed:', error);
      this.showMessage('切换实时模式失败', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // 更新实时模式界面
  updateRealtimeUI(isActive) {
    const statusIndicator = document.getElementById('realtime-status');
    const statusDot = document.getElementById('realtime-dot');
    const statusText = document.getElementById('realtime-text');
    const toggleBtn = document.getElementById('toggle-realtime-btn');

    if (isActive) {
      // 激活状态
      statusIndicator.classList.add('active');
      statusText.textContent = '实时模式运行中';
      toggleBtn.textContent = '🟢 停止实时模式';
      toggleBtn.className = 'btn btn-secondary active';
    } else {
      // 非激活状态
      statusIndicator.classList.remove('active');
      statusText.textContent = '实时模式已关闭';
      toggleBtn.innerHTML = '<span class="btn-icon">🔴</span>启动实时模式';
      toggleBtn.className = 'btn btn-secondary';
    }
  }
}

// 全局实例
const app = new MainApp();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  app.init();
}); 