const { ipcRenderer } = require('electron');

let captureType = 'text';
let contentData = {};

// 监听捕获类型
ipcRenderer.on('capture-type', (event, type) => {
  captureType = type;
  loadContent();
});

// 加载内容
async function loadContent() {
  const previewArea = document.getElementById('preview-area');
  const contentInput = document.getElementById('content-input');
  
  try {
    const clipboardData = await ipcRenderer.invoke('get-clipboard-content');
    
  if (captureType === 'text') {
      if (clipboardData.hasText) {
      // 隐藏预览区域，直接在编辑区域显示内容
      previewArea.style.display = 'none';
        contentData.content = clipboardData.text;
        contentInput.value = clipboardData.text;
      contentInput.style.display = 'block';
      // 自动调整文本区域高度以适应内容
      contentInput.style.height = 'auto';
      contentInput.style.height = Math.min(contentInput.scrollHeight, 300) + 'px';
      } else {
        previewArea.innerHTML = `
          <div class="empty-content">
            <p>剪贴板中没有文本内容</p>
            <p>您可以直接在下方输入内容</p>
          </div>
        `;
        previewArea.style.display = 'block';
        contentInput.style.display = 'block';
        contentInput.value = '';
    }
  } else if (captureType === 'image') {
      if (clipboardData.hasImage && clipboardData.image) {
        // clipboardData.image 已经是 base64 字符串
        const base64Image = `data:image/png;base64,${clipboardData.image}`;
      previewArea.innerHTML = `
        <div class="image-preview">
          <h3>图片内容：</h3>
            <img src="${base64Image}" alt="截图预览" style="max-width: 100%; max-height: 200px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      `;
      previewArea.style.display = 'block';
        contentData.imageData = base64Image;
      contentData.fileName = `screenshot_${Date.now()}.png`;
      contentInput.style.display = 'none';
        
        console.log('Image preview loaded, data length:', clipboardData.image.length);
      } else {
        previewArea.innerHTML = `
          <div class="empty-content">
            <p>剪贴板中没有图片内容</p>
            <p>请先截图或复制图片后再使用此功能</p>
          </div>
        `;
        previewArea.style.display = 'block';
        contentInput.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Load content failed:', error);
    previewArea.innerHTML = `
      <div class="error-content">
        <p>加载内容失败：${error.message}</p>
      </div>
    `;
    previewArea.style.display = 'block';
  }
}

// HTML转义函数，防止XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 提交内容
async function submitContent() {
  const submitBtn = document.getElementById('submit-btn');
  const commentInput = document.getElementById('comment-input');
  
  submitBtn.disabled = true;
  submitBtn.textContent = '提交中...';
  
  try {
    const config = await ipcRenderer.invoke('get-config');
    
    if (!config.submitterName) {
      throw new Error('请先在主窗口设置提交者姓名');
    }
    
    // 检查是否选择了表格配置
    if (!config.tableConfigs || config.tableConfigs.length === 0) {
      throw new Error('请先在主窗口配置飞书表格');
    }
    
    if (config.currentTableIndex < 0) {
      throw new Error('请先在主窗口选择要使用的表格');
    }
    
    const submitData = {
      contentType: captureType,
      submitter: config.submitterName,
      comment: commentInput.value || ''
    };
    
    if (captureType === 'text') {
      const contentInput = document.getElementById('content-input');
      const textContent = contentInput.value.trim();
      
      if (!textContent) {
        throw new Error('请输入文本内容');
      }
      
      submitData.content = textContent;
    } else {
      if (!contentData.imageData) {
        throw new Error('没有检测到图片内容');
      }
      
      // 提取base64数据部分
      const base64Data = contentData.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      submitData.content = base64Data;
    }
    
    const result = await ipcRenderer.invoke('submit-content', submitData);
    
    if (result.success) {
      showMessage('提交成功！', 'success');
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      throw new Error(result.message || '提交失败');
    }
  } catch (error) {
    console.error('Submit error:', error);
    showMessage(`提交失败：${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '提交';
  }
}

// 显示消息
function showMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  `;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 3000);
}

// 事件监听
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  
  if (submitBtn) {
    submitBtn.addEventListener('click', submitContent);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.close();
    });
  }
  
  // ESC键关闭窗口
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    }
  });
  
  // 回车键提交（仅在文本模式下）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && captureType === 'text') {
      submitContent();
    }
  });
}); 