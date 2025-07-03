import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, validateEnvConfig } from '@/lib/auth';
import { getFeishuAccessToken } from '@/lib/feishu';

export async function GET(request: NextRequest) {
  try {
    // 验证环境变量配置
    const envValidation = validateEnvConfig();
    if (!envValidation.valid) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 验证请求认证
    const authResult = authenticateRequest(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // 获取飞书访问令牌
    const accessToken = await getFeishuAccessToken();
    const { FEISHU_BASE_APP_TOKEN, FEISHU_TABLE_ID } = process.env;

    // 获取表格字段信息
    const fieldsResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/fields`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const fieldsData = await fieldsResponse.json();

    // 获取表格记录示例
    const recordsResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records?page_size=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const recordsData = await recordsResponse.json();

    return NextResponse.json({
      message: 'Debug info retrieved successfully',
      fields: fieldsData,
      sampleRecord: recordsData,
      tableInfo: {
        baseAppToken: FEISHU_BASE_APP_TOKEN,
        tableId: FEISHU_TABLE_ID
      }
    });

  } catch (error) {
    console.error('Debug API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 