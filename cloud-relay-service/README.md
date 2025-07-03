# 素材快捷投递工具 - 云端中继服务

这是素材快捷投递工具的云端中继服务，基于 Next.js 构建，提供安全的API接口用于接收桌面客户端的素材提交并转发到飞书多维表格。

## 🚀 快速开始

### 环境配置

1. 复制环境变量模板文件：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 文件，填入实际的配置值：
   - 飞书应用的 App ID 和 App Secret
   - 飞书多维表格的 Base App Token 和 Table ID
   - 强密钥用于API认证

### 开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看结果。

## 📝 API 文档

### POST /api/submit

接收来自桌面客户端的素材提交。

#### 请求头
- `Authorization: Bearer {SHARED_SECRET_KEY}`
- `Content-Type: multipart/form-data`

#### 请求体
- `submitter` (string): 提交者姓名
- `contentType` (string): "text" 或 "image"
- `content` (string): 文本内容（当 contentType 为 "text" 时）
- `comment` (string, 可选): 备注信息
- `image` (file): 图片文件（当 contentType 为 "image" 时）

#### 响应
```json
{
  "message": "Submit successful"
}
```

## 🔧 环境变量说明

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `FEISHU_APP_ID` | 飞书应用ID | ✅ |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | ✅ |
| `FEISHU_BASE_APP_TOKEN` | 飞书多维表格App Token | ✅ |
| `FEISHU_TABLE_ID` | 飞书多维表格ID | ✅ |
| `SHARED_SECRET_KEY` | API认证密钥 | ✅ |
| `MAX_FILE_SIZE` | 最大文件大小（字节） | ❌ |
| `ALLOWED_IMAGE_TYPES` | 允许的图片类型 | ❌ |

## 🚢 部署

推荐部署到 [Vercel](https://vercel.com)：

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成

## 📦 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── submit/
│   │       └── route.ts          # 主要API端点
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── lib/
    ├── feishu.ts                  # 飞书API工具函数
    ├── auth.ts                    # 认证中间件
    └── types.ts                   # TypeScript类型定义
```

## 🔒 安全考虑

- 使用强密钥进行API认证
- 文件类型和大小验证
- 环境变量隔离
- HTTPS强制（生产环境）

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
