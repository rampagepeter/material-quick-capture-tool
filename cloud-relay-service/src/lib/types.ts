// 飞书API响应类型
export interface FeishuAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

export interface FeishuUploadResponse {
  code: number;
  msg: string;
  data?: {
    file_token: string;
  };
}

export interface FeishuTableResponse {
  code: number;
  msg: string;
  data?: {
    record: {
      record_id: string;
      fields: Record<string, any>;
    };
  };
}

// 应用数据类型
export interface SubmitRequest {
  submitter: string;
  contentType: 'text' | 'image';
  content?: string;
  comment?: string;
  image?: File;
}

export interface FeishuTableRecord {
  fields: {
    [fieldName: string]: any;
  };
}

// 环境变量类型
export interface EnvConfig {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  FEISHU_BASE_APP_TOKEN: string;
  FEISHU_TABLE_ID: string;
  SHARED_SECRET_KEY: string;
  MAX_FILE_SIZE?: number;
  ALLOWED_IMAGE_TYPES?: string[];
}

// API响应类型
export interface ApiResponse {
  message?: string;
  error?: string;
  code?: number;
}

// 飞书多维表格字段类型
export interface TableFieldTypes {
  // 文本字段
  text: string;
  // 多行文本字段
  multilineText: string;
  // 人员字段
  person: Array<{
    id: string;
    name?: string;
    email?: string;
  }>;
  // 附件字段
  attachment: Array<{
    file_token: string;
    name?: string;
    type?: string;
    size?: number;
  }>;
  // 日期时间字段
  datetime: number; // Unix timestamp in milliseconds
  // 选择字段
  select: string;
  // 多选字段
  multiSelect: string[];
} 