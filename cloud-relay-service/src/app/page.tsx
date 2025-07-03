export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            素材快捷投递工具 - 云端中继服务
          </h1>
          
          <div className="prose prose-lg text-gray-700">
            <p className="text-xl text-gray-600 mb-8">
              这是素材快捷投递工具的云端中继服务，提供安全的API接口用于接收桌面客户端的素材提交并转发到飞书多维表格。
            </p>

            <h2 className="text-2xl font-semibold mb-4">API 端点</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium mb-2">POST /api/submit</h3>
              <p className="text-gray-600 mb-3">接收来自桌面客户端的素材提交</p>
              
              <h4 className="font-medium mb-2">请求头：</h4>
              <ul className="list-disc list-inside mb-3 text-gray-600">
                <li><code>Authorization: Bearer {'{SHARED_SECRET_KEY}'}</code></li>
                <li><code>Content-Type: multipart/form-data</code></li>
              </ul>
              
              <h4 className="font-medium mb-2">请求体：</h4>
              <ul className="list-disc list-inside mb-3 text-gray-600">
                <li><code>submitter</code> (string): 提交者姓名</li>
                <li><code>contentType</code> (string): "text" 或 "image"</li>
                <li><code>content</code> (string): 文本内容（当 contentType 为 "text" 时）</li>
                <li><code>comment</code> (string, 可选): 备注信息</li>
                <li><code>image</code> (file): 图片文件（当 contentType 为 "image" 时）</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium mb-2">GET /api/health</h3>
              <p className="text-gray-600">健康检查端点，返回服务状态和配置信息</p>
            </div>

            <h2 className="text-2xl font-semibold mb-4">状态</h2>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700 font-medium">服务运行正常</span>
            </div>

            <h2 className="text-2xl font-semibold mb-4">功能状态</h2>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <span className="text-green-500">✅</span>
                <span>文本提交功能</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-500">✅</span>
                <span>图片上传功能</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-500">✅</span>
                <span>飞书API集成</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-500">✅</span>
                <span>身份验证</span>
              </li>
            </ul>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900 mb-2">使用说明</h3>
              <p className="text-blue-800">
                此服务配合桌面客户端使用。桌面客户端将通过 POST /api/submit 端点提交素材到飞书多维表格。
                请确保在环境变量中正确配置飞书API凭据和共享密钥。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
