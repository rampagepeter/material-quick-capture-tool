const { Readable } = require('stream');
const { randomBytes } = require('crypto');

class APIClient {
  constructor(config) {
    this.config = config;
  }

  updateConfig(config) {
    this.config = config;
  }

  async checkHealth() {
    if (!this.config.serverUrl || !this.config.secretKey) {
      throw new Error('Missing server configuration');
    }

    const response = await fetch(`${this.config.serverUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  }

  // 创建multipart/form-data
  createMultipartFormData(fields, files = []) {
    const boundary = `----formdata-electron-${randomBytes(16).toString('hex')}`;
    const chunks = [];

    // 添加普通字段
    for (const [name, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        chunks.push(`--${boundary}\r\n`);
        chunks.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
        chunks.push(`${value}\r\n`);
      }
    }

    // 添加文件字段
    for (const file of files) {
      chunks.push(`--${boundary}\r\n`);
      chunks.push(`Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n`);
      chunks.push(`Content-Type: ${file.contentType}\r\n\r\n`);
      chunks.push(file.data);
      chunks.push('\r\n');
    }

    // 结束边界
    chunks.push(`--${boundary}--\r\n`);

    return {
      body: Buffer.concat(chunks.map(chunk => Buffer.from(chunk))),
      contentType: `multipart/form-data; boundary=${boundary}`
    };
  }

  async submitText(content, submitter, comment = '') {
    if (!this.config.serverUrl || !this.config.secretKey) {
      throw new Error('Missing server configuration');
    }

    const fields = {
      submitter,
      contentType: 'text',
      content,
      comment
    };

    const { body, contentType } = this.createMultipartFormData(fields);

    const response = await fetch(`${this.config.serverUrl}/api/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
        'Content-Type': contentType
      },
      body
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Submit failed: ${response.status}`);
    }

    return await response.json();
  }

  async submitImage(imageBuffer, fileName, submitter, comment = '') {
    if (!this.config.serverUrl || !this.config.secretKey) {
      throw new Error('Missing server configuration');
    }

    const fields = {
      submitter,
      contentType: 'image',
      comment
    };

    const files = [{
      name: 'image',
      filename: fileName,
      contentType: 'image/png',
      data: imageBuffer
    }];

    const { body, contentType } = this.createMultipartFormData(fields, files);

    const response = await fetch(`${this.config.serverUrl}/api/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
        'Content-Type': contentType
      },
      body
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Submit failed: ${response.status}`);
    }

    return await response.json();
  }
}

module.exports = APIClient; 