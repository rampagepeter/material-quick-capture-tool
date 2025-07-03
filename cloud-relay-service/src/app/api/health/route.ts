import { NextResponse } from 'next/server';
import { validateEnvConfig } from '@/lib/auth';

export async function GET() {
  try {
    // 检查环境变量配置
    const envValidation = validateEnvConfig();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Material Quick-Capture Tool - Cloud Relay',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      config: {
        hasFeishuConfig: envValidation.valid,
        configErrors: envValidation.errors
      }
    };

    const status = envValidation.valid ? 200 : 500;
    
    return NextResponse.json(health, { status });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 