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
  
  if (captureType === 'text') {
    const text = await ipcRenderer.invoke('get-clipboard-text');
    if (text) {
      // 隐藏预览区域，直接在编辑区域显示内容
      previewArea.style.display = 'none';
      contentData.content = text;
      contentInput.value = text;
      contentInput.style.display = 'block';
      // 自动调整文本区域高度以适应内容
      contentInput.style.height = 'auto';
      contentInput.style.height = Math.min(contentInput.scrollHeight, 300) + 'px';
    }
  } else if (captureType === 'image') {
    const imageData = await ipcRenderer.invoke('get-clipboard-image');
    if (imageData) {
      previewArea.innerHTML = `
        <div class="image-preview">
          <h3>图片内容：</h3>
          <img src="${imageData}" alt="截图预览" style="max-width: 100%; max-height: 200px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      `;
      previewArea.style.display = 'block';
      contentData.imageData = imageData;
      contentData.fileName = `screenshot_${Date.now()}.png`;
      contentInput.style.display = 'none';
    }
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
      throw new Error('请先设置提交者姓名');
    }
    
    const submitData = {
      contentType: captureType,
      submitter: config.submitterName,
      comment: commentInput.value || ''
    };
    
    if (captureType === 'text') {
      const contentInput = document.getElementById('content-input');
      submitData.content = contentInput.value;
    } else {
      submitData.imageData = contentData.imageData;
      submitData.fileName = contentData.fileName;
    }
    
    const result = await ipcRenderer.invoke('submit-content', submitData);
    
    if (result.success) {
      showMessage('提交成功！', 'success');
      setTimeout(() => {
        ipcRenderer.invoke('close-capture-window');
      }, 1500);
    } else {
      throw new Error(result.message);
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
      ipcRenderer.invoke('close-capture-window');
    });
  }
  
  // ESC键关闭窗口
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ipcRenderer.invoke('close-capture-window');
    }
  });
}); 