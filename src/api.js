const { Readable } = require('stream');
const { randomBytes } = require('crypto');

class FeishuAPIClient {
  constructor(config) {
    this.config = config || {};
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    // 配置更新时清除现有token，强制重新获取
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  // 获取飞书访问令牌
  async getAccessToken() {
    if (!this.config.feishuAppId || !this.config.feishuAppSecret) {
      console.error('Missing credentials:', {
        hasAppId: !!this.config.feishuAppId,
        hasAppSecret: !!this.config.feishuAppSecret
      });
      throw new Error('Missing Feishu App ID or App Secret');
    }

    // 检查token是否还有效（提前5分钟刷新）
    if (this.accessToken && Date.now() < this.tokenExpireTime - 300000) {
      console.log('Using cached token, expires in:', Math.round((this.tokenExpireTime - Date.now()) / 1000), 'seconds');
      return this.accessToken;
    }

    console.log('Requesting new access token...');
    try {
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          app_id: this.config.feishuAppId,
          app_secret: this.config.feishuAppSecret
        })
      });

      console.log('Token request status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Token response:', {
        code: data.code,
        msg: data.msg,
        hasToken: !!data.app_access_token,
        expire: data.expire
      });
      
      if (data.code !== 0) {
        console.error('API error response:', data);
        throw new Error(`Feishu API error: ${data.msg} (code: ${data.code})`);
      }

      this.accessToken = data.app_access_token;
      this.tokenExpireTime = Date.now() + (data.expire * 1000);
      
      console.log('New token acquired, expires in:', Math.round(data.expire), 'seconds');
      return this.accessToken;
    } catch (error) {
      console.error('Get access token failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 获取多维表格字段信息
  async getTableFields(tableConfig) {
    console.log('Getting table fields for:', {
      appToken: tableConfig.appToken,
      tableId: tableConfig.tableId
    });

    if (!tableConfig.appToken || !tableConfig.tableId) {
      console.error('Missing required config:', {
        hasAppToken: !!tableConfig.appToken,
        hasTableId: !!tableConfig.tableId
      });
      throw new Error('Missing app token or table ID');
    }

    try {
      const accessToken = await this.getAccessToken();
      console.log('Got access token, length:', accessToken?.length);

      const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields`;
      console.log('Requesting fields from:', url);

      const response = await fetch(url, {
      method: 'GET',
      headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8'
      }
    });

      console.log('Fields request status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fields request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to get table fields: ${response.status} - ${errorText}`);
    }

      const data = await response.json();
      console.log('Fields response:', {
        code: data.code,
        msg: data.msg,
        itemCount: data.data?.items?.length
      });
      
      if (data.code !== 0) {
        console.error('API error in fields:', data);
        throw new Error(`Feishu API error: ${data.msg} (code: ${data.code})`);
      }

      const fields = data.data.items || [];
      console.log('Retrieved fields:', fields.map(f => ({
        field_id: f.field_id,
        field_name: f.field_name,
        type: f.type
      })));
      return fields;
    } catch (error) {
      console.error('Get table fields failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 获取多维表格基本信息
  async getTableInfo(tableConfig) {
    console.log('Getting table info for:', {
      appToken: tableConfig.appToken,
      tableId: tableConfig.tableId
    });

    if (!tableConfig.appToken || !tableConfig.tableId) {
      console.error('Missing required config:', {
        hasAppToken: !!tableConfig.appToken,
        hasTableId: !!tableConfig.tableId
      });
      throw new Error('Missing app token or table ID');
    }

    try {
      const app_access_token = await this.getAccessToken();
      console.log('Got access token, length:', app_access_token?.length);

      const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}`;
      console.log('Requesting table info from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${app_access_token}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });

      console.log('Table info request status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Table info request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to get table info: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Table info response:', {
        code: data.code,
        msg: data.msg,
        hasData: !!data.data
      });
      
      if (data.code !== 0) {
        console.error('API error in table info:', data);
        throw new Error(`Feishu API error: ${data.msg} (code: ${data.code})`);
      }

      console.log('Successfully retrieved table info');
      return data.data;
    } catch (error) {
      console.error('Get table info failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
      }
    }

  // 获取多维表格应用信息（包含表格名称）
  async getAppInfo(appToken) {
    console.log('Getting app info for:', { appToken });

    if (!appToken) {
      throw new Error('Missing app token');
    }

    try {
      const accessToken = await this.getAccessToken();
      console.log('Got access token, length:', accessToken?.length);

      const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}`;
      console.log('Requesting app info from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });

      console.log('App info request status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('App info request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to get app info: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('App info response:', {
        code: data.code,
        msg: data.msg,
        hasData: !!data.data,
        appName: data.data?.app?.name
      });
      
      if (data.code !== 0) {
        console.error('API error in app info:', data);
        throw new Error(`Feishu API error: ${data.msg} (code: ${data.code})`);
      }

      console.log('Successfully retrieved app info');
      return data.data;
    } catch (error) {
      console.error('Get app info failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 获取表格字段和应用信息
  async getTableFieldsAndInfo(tableConfig) {
    console.log('Getting table fields and info for:', {
      appToken: tableConfig.appToken,
      tableId: tableConfig.tableId
    });

    if (!tableConfig.appToken || !tableConfig.tableId) {
      throw new Error('Missing app token or table ID');
    }

    try {
      // 并行获取字段信息和应用信息
      const [fields, appInfo] = await Promise.all([
        this.getTableFields(tableConfig),
        this.getAppInfo(tableConfig.appToken)
      ]);

    return {
        fields,
        appName: appInfo.app?.name || '未知表格',
        appInfo
      };
    } catch (error) {
      console.error('Get table fields and info failed:', error);
      throw error;
    }
  }

  // 上传图片到飞书
  async uploadImage(imageBuffer, fileName, appToken, tableId) {
    try {
      const token = await this.getAccessToken();
      
      // 使用正确的飞书文件上传API
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, fileName);
      formData.append('file_name', fileName);
      formData.append('parent_type', 'bitable_file');
      formData.append('parent_node', appToken); // 使用表格的app_token作为parent_node
      formData.append('size', imageBuffer.length.toString());

      console.log('Uploading image with params:', {
        fileName,
        size: imageBuffer.length,
        parent_type: 'bitable_file',
        parent_node: appToken
      });

      const response = await fetch('https://open.feishu.cn/open-apis/drive/v1/files/upload_all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // 不要设置 Content-Type，让浏览器自动设置 multipart/form-data 的边界
        },
        body: formData
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error response:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Upload response:', result);

      if (result.code === 0 && result.data) {
        // 返回符合飞书附件字段格式的对象
        return {
          file_token: result.data.file_token,
          name: result.data.name || fileName,
          type: result.data.type || result.data.mime_type || 'image/png',
          size: result.data.size || imageBuffer.length
        };
      } else {
        throw new Error(`Upload failed: ${result.msg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  }

  // 向多维表格添加记录
  async addTableRecord(tableConfig, recordData) {
    if (!tableConfig.appToken || !tableConfig.tableId) {
      throw new Error('Missing app token or table ID');
    }

    console.log('Adding record with data:', recordData);

    try {
      const token = await this.getAccessToken();
      
      const requestBody = {
        fields: recordData
      };
      
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      },
        body: JSON.stringify(requestBody)
    });

      console.log('Add record response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Add record request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to add record: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Add record response:', {
        code: data.code,
        msg: data.msg,
        hasData: !!data.data
      });
      
      if (data.code !== 0) {
        console.error('API error in add record:', data);
        throw new Error(`Feishu API error: ${data.msg}`);
      }

      console.log('Record added successfully');
      return data.data;
    } catch (error) {
      console.error('Add table record failed:', error);
      throw error;
    }
  }

  // 提交文本内容
  async submitText(tableConfig, content, submitter, comment) {
    try {
      // 准备记录字段
      const fields = {};
      
      // 添加文本内容字段
      if (tableConfig.fieldMapping.textField) {
        fields[tableConfig.fieldMapping.textField] = content;
      }
      
      // 添加注释字段
      if (tableConfig.fieldMapping.commentField && comment) {
        fields[tableConfig.fieldMapping.commentField] = comment;
      }
      
      // 添加提交人字段
      if (tableConfig.fieldMapping.submitterField && submitter) {
        fields[tableConfig.fieldMapping.submitterField] = submitter;
      }
      
      // 添加时间字段
      if (tableConfig.fieldMapping.timeField) {
        fields[tableConfig.fieldMapping.timeField] = Date.now();
    }

      // 使用新的 addRecord 方法
      const result = await this.addRecord(tableConfig.appToken, tableConfig.tableId, fields);
      
      if (result.code === 0) {
        return { success: true, data: result.data };
      } else {
        throw new Error(`Failed to submit text: ${result.msg}`);
      }
    } catch (error) {
      console.error('Submit text failed:', error);
      throw error;
    }
  }

  // 提交图片内容
  async submitImage(tableConfig, imageBuffer, fileName, submitter, comment) {
    try {
      // 上传图片
      const uploadResult = await this.uploadImage(imageBuffer, fileName, tableConfig.appToken, tableConfig.tableId);
      console.log('Image uploaded:', uploadResult);
      
      // 准备记录字段
      const fields = {};
      
      // 添加图片字段
      if (tableConfig.fieldMapping.imageField) {
        fields[tableConfig.fieldMapping.imageField] = uploadResult;
      }
      
      // 添加文本注释字段
      if (tableConfig.fieldMapping.commentField && comment) {
        fields[tableConfig.fieldMapping.commentField] = comment;
      }
      
      // 添加提交人字段
      if (tableConfig.fieldMapping.submitterField && submitter) {
        fields[tableConfig.fieldMapping.submitterField] = submitter;
      }
      
      // 添加时间字段
      if (tableConfig.fieldMapping.timeField) {
        fields[tableConfig.fieldMapping.timeField] = Date.now();
      }
      
      // 使用新的 addRecord 方法
      const result = await this.addRecord(tableConfig.appToken, tableConfig.tableId, fields);
      
      if (result.code === 0) {
        return { success: true, data: result.data };
      } else {
        throw new Error(`Failed to submit image: ${result.msg}`);
      }
    } catch (error) {
      console.error('Submit image failed:', error);
      throw error;
    }
  }

  // 测试连接
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      return {
        success: true,
        message: 'Connection successful',
        data: {
          hasToken: !!token,
          tokenExpire: new Date(this.tokenExpireTime).toISOString()
        }
      };
    } catch (error) {
      console.error('Test connection failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // 测试表格配置
  async testTableConfig(tableConfig) {
    try {
      const fields = await this.getTableFields(tableConfig);
      
      return {
        success: true,
        message: 'Table config is valid',
        data: {
          tableName: tableConfig.name || 'Untitled Table',
          fieldCount: fields.length,
          fields: fields.map(field => ({
            id: field.field_id,
            name: field.field_name,
            type: field.type
          }))
        }
      };
    } catch (error) {
      console.error('Test table config failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async addRecord(appToken, tableId, fields) {
    try {
      const token = await this.getAccessToken();
      
      // 处理附件字段 - 确保附件字段格式正确
      const processedFields = { ...fields };
      
      // 如果有附件字段，需要转换格式
      Object.keys(processedFields).forEach(key => {
        const value = processedFields[key];
        if (value && typeof value === 'object' && value.file_token) {
          // 转换为飞书多维表格附件字段格式
          processedFields[key] = [{
            file_token: value.file_token,
            name: value.name,
            type: value.type,
            size: value.size
          }];
        }
      });

      // 使用正确的API格式 - 直接使用fields，不需要records数组
      const requestBody = {
        fields: processedFields
      };

      console.log('Adding record with body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      },
        body: JSON.stringify(requestBody)
    });

      console.log('Add record response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Add record error response:', errorText);
        throw new Error(`Failed to add record: ${response.status} ${errorText}`);
    }

      const result = await response.json();
      console.log('Add record response:', result);
      return result;
    } catch (error) {
      console.error('Error adding record:', error);
      throw error;
    }
  }
}

module.exports = FeishuAPIClient; 