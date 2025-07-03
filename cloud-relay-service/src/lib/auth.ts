import { NextRequest } from 'next/server';

/**
 * 验证请求的Authorization header
 */
export function authenticateRequest(request: NextRequest): { valid: boolean; error?: string } {
  const { SHARED_SECRET_KEY } = process.env;
  
  if (!SHARED_SECRET_KEY) {
    return {
      valid: false,
      error: 'Server configuration error: missing secret key'
    };
  }

  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return {
      valid: false,
      error: 'Missing Authorization header'
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Invalid Authorization header format. Expected: Bearer <token>'
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (token !== SHARED_SECRET_KEY) {
    return {
      valid: false,
      error: 'Invalid authentication token'
    };
  }

  return { valid: true };
}

/**
 * 生成随机密钥（用于开发/测试）
 */
export function generateSecretKey(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证环境变量配置
 */
export function validateEnvConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = [
    'FEISHU_APP_ID',
    'FEISHU_APP_SECRET', 
    'FEISHU_BASE_APP_TOKEN',
    'FEISHU_TABLE_ID',
    'SHARED_SECRET_KEY'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
} 