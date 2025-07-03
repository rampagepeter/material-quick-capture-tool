import { 
  FeishuAccessTokenResponse, 
  FeishuUploadResponse, 
  FeishuTableResponse,
  FeishuTableRecord 
} from './types';

/**
 * 获取飞书tenant_access_token
 */
export async function getFeishuAccessToken(): Promise<string> {
  const { FEISHU_APP_ID, FEISHU_APP_SECRET } = process.env;
  
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error('Missing Feishu app credentials');
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data: FeishuAccessTokenResponse = await response.json();
  
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get access token: ${data.msg}`);
  }

  return data.tenant_access_token;
}

/**
 * 上传图片到飞书云空间
 */
export async function uploadImageToFeishu(
  accessToken: string, 
  imageFile: File
): Promise<string> {
  const formData = new FormData();
  
  // 基础参数
  formData.append('file_name', imageFile.name);
  formData.append('file_type', 'image');
  formData.append('file', imageFile);
  
  // 关键参数：size 必须是实际文件字节大小
  formData.append('size', imageFile.size.toString());
  
  // 多维表格相关参数
  formData.append('parent_type', 'bitable_image');
  formData.append('parent_node', process.env.FEISHU_BASE_APP_TOKEN || '');
  
  // extra 参数：JSON字符串格式
  const extraData = {
    "drive_route_token": process.env.FEISHU_BASE_APP_TOKEN || ''
  };
  formData.append('extra', JSON.stringify(extraData));

  const response = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      // 注意：不要手动设置 Content-Type，让浏览器自动设置以包含 boundary
    },
    body: formData,
  });

  const data: FeishuUploadResponse = await response.json();
  
  // 添加调试日志
  console.log('Feishu upload response:', data);
  
  if (data.code !== 0 || !data.data?.file_token) {
    throw new Error(`Failed to upload image: ${data.msg} (code: ${data.code})`);
  }

  return data.data.file_token;
}

/**
 * 向飞书多维表格写入记录
 */
export async function writeToFeishuBase(
  accessToken: string,
  record: FeishuTableRecord
): Promise<boolean> {
  const { FEISHU_BASE_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  
  if (!FEISHU_BASE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('Missing Feishu base configuration');
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    }
  );

  const data: FeishuTableResponse = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`Failed to write to Feishu base: ${data.msg}`);
  }

  return true;
}

/**
 * 验证文件类型和大小
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
  const allowedTypes = process.env.ALLOWED_IMAGE_TYPES?.split(',') || [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp'
  ];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * 使用实际飞书表格字段名构造记录
 */
export function buildActualFeishuRecord(
  submitter: string,
  contentType: 'text' | 'image',
  content?: string,
  comment?: string,
  fileToken?: string,
  fileName?: string
): FeishuTableRecord {
  const fields: Record<string, any> = {};

  if (contentType === 'text' && content) {
    // 文本提交
    fields['素材'] = `【${submitter}】${content}`;  // 在素材字段中包含提交者信息
    fields['日期'] = Date.now();  // 使用时间戳
    if (comment) {
      fields['备注'] = comment;
    }
  } else if (contentType === 'image' && fileToken) {
    // 图片提交
    fields['素材'] = `【${submitter}】${comment || fileName || '图片上传'}`;
    fields['日期'] = Date.now();
    fields['附件'] = [
      {
        file_token: fileToken,
        name: fileName || 'screenshot.png'
      }
    ];
    if (comment) {
      fields['备注'] = comment;
    }
  }

  return { fields };
}

/**
 * 使用简化的字段名进行测试
 */
export function buildTestFeishuRecord(
  submitter: string,
  contentType: 'text' | 'image',
  content?: string,
  comment?: string,
  fileToken?: string,
  fileName?: string
): FeishuTableRecord {
  const fields: Record<string, any> = {};

  // 尝试常见的英文字段名
  if (contentType === 'text' && content) {
    fields['submitter'] = submitter;
    fields['content'] = content;
    fields['type'] = 'text';
    if (comment) {
      fields['comment'] = comment;
    }
    fields['timestamp'] = new Date().toISOString();
  } else if (contentType === 'image' && fileToken) {
    fields['submitter'] = submitter;
    fields['type'] = 'image';
    fields['file'] = [{ file_token: fileToken, name: fileName || 'image.png' }];
    if (comment) {
      fields['comment'] = comment;
    }
    fields['timestamp'] = new Date().toISOString();
  }

  return { fields };
} 