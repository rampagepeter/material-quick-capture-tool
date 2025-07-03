import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, validateEnvConfig } from '@/lib/auth';
import { 
  getFeishuAccessToken, 
  uploadImageToFeishu, 
  writeToFeishuBase, 
  validateImageFile,
  buildActualFeishuRecord as buildFeishuRecord  // 使用实际字段名版本
} from '@/lib/feishu';
import type { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // 1. 验证环境变量配置
    const envValidation = validateEnvConfig();
    if (!envValidation.valid) {
      return NextResponse.json(
        { 
          error: 'Server configuration error', 
          code: 500 
        },
        { status: 500 }
      );
    }

    // 2. 验证请求认证
    const authResult = authenticateRequest(request);
    if (!authResult.valid) {
      return NextResponse.json(
        { 
          error: authResult.error, 
          code: 401 
        },
        { status: 401 }
      );
    }

    // 3. 解析请求数据
    const formData = await request.formData();
    const submitter = formData.get('submitter') as string;
    const contentType = formData.get('contentType') as string;
    const content = formData.get('content') as string;
    const comment = formData.get('comment') as string;
    const imageFile = formData.get('image') as File;

    // 4. 验证必需参数
    if (!submitter) {
      return NextResponse.json(
        { 
          error: 'Missing required parameter: submitter', 
          code: 400 
        },
        { status: 400 }
      );
    }

    if (!contentType || !['text', 'image'].includes(contentType)) {
      return NextResponse.json(
        { 
          error: 'Invalid or missing contentType. Must be "text" or "image"', 
          code: 400 
        },
        { status: 400 }
      );
    }

    // 5. 根据内容类型验证参数
    if (contentType === 'text' && !content) {
      return NextResponse.json(
        { 
          error: 'Missing required parameter: content (for text submissions)', 
          code: 400 
        },
        { status: 400 }
      );
    }

    if (contentType === 'image' && !imageFile) {
      return NextResponse.json(
        { 
          error: 'Missing required parameter: image (for image submissions)', 
          code: 400 
        },
        { status: 400 }
      );
    }

    // 6. 验证图片文件（如果是图片提交）
    if (contentType === 'image' && imageFile) {
      const fileValidation = validateImageFile(imageFile);
      if (!fileValidation.valid) {
        return NextResponse.json(
          { 
            error: fileValidation.error, 
            code: 400 
          },
          { status: 400 }
        );
      }
    }

    // 7. 获取飞书访问令牌
    const accessToken = await getFeishuAccessToken();

    // 8. 处理数据并构造记录
    let feishuRecord;
    
    if (contentType === 'text') {
      // 处理文本提交
      feishuRecord = buildFeishuRecord(
        submitter,
        'text',
        content,
        comment
      );
    } else {
      // 处理图片提交
      const fileToken = await uploadImageToFeishu(accessToken, imageFile);
      feishuRecord = buildFeishuRecord(
        submitter,
        'image',
        undefined,
        comment,
        fileToken,
        imageFile.name
      );
    }

    // 9. 写入飞书多维表格
    await writeToFeishuBase(accessToken, feishuRecord);

    // 10. 返回成功响应
    return NextResponse.json(
      { 
        message: 'Submit successful',
        code: 200
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('API Error:', error);
    
    // 返回服务器错误响应
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 500
      },
      { status: 500 }
    );
  }
}

// 仅允许 POST 方法
export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to submit data.',
      code: 405
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to submit data.',
      code: 405
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to submit data.',
      code: 405
    },
    { status: 405 }
  );
}

// 处理CORS预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.com' 
        : '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
} 