### **素材快捷投递工具 (Material Quick-Capture Tool) - 开发文档**





#### 1. 项目概述



本项目旨在开发一个桌面工具，使外部志愿者能够方便、快捷地从他们的电脑（如腾讯会议、微信等）捕获素材（截图、文字），并一键提交到指定的飞书多维表格（Base）。

为确保安全性和易用性，项目采用“**桌面客户端 + 云端中-继服务**”的两段式架构。

- **桌面客户端 (Desktop Client)**：安装在志愿者电脑上的轻量级应用，负责捕获和提交。
- **云端中-继服务 (Cloud Relay)**：一个安全的API服务，作为客户端和飞书之间的桥梁，负责验证请求并调用飞书API。



#### 2. 系统架构图



```
+----------------+      (HTTPS Request)      +--------------------+      (Feishu API Call)      +--------------+
|                |  ->  [JSON + Image File] -> |                    |  ->  [Formatted Data]   -> |              |
|  Desktop Client|                           |  Cloud Relay Service |                           |  Feishu Base |
| (Electron App) |  <-  [Success/Error]   <- |  (Node.js/Serverless)|  <-  [Success/Error]    <- |              |
|                |      (JSON Response)      |                    |      (Feishu Response)      |              |
+----------------+                           +--------------------+                           +--------------+
```

------



### **第一部分：云端中继服务 (Cloud Relay Service)**



这是项目的核心后端，建议使用 **Node.js + Express** 或无服务器方案（如 **Vercel/Netlify Functions**）进行开发，以便于部署和节约成本。

**1. 核心职责：**

- 提供一个安全的API接口，接收来自桌面客户端的提交。
- 验证请求的合法性（通过共享密钥）。
- 处理文件上传（图片）。
- 调用飞书API，将数据写入指定的多维表格。
- 环境变量配置 (.env)

在部署时，需要在您的服务环境中配置以下变量：

```
# Feishu App Credentials
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_BASE_APP_TOKEN=your_base_app_token
FEISHU_TABLE_ID=your_table_id

# Security
SHARED_SECRET_KEY=a_very_strong_and_random_secret_key
```

**3. API Endpoint 定义**

- **URL:** `POST /api/submit`
- **认证:** `Authorization` Header. 客户端必须携带 `Bearer ${SHARED_SECRET_KEY}`。
- **请求体 (Body):** `multipart/form-data`.
  - `submitter` (String): 提交者（志愿者的名字）。
  - `contentType` (String): "text" 或 "image"。
  - `content` (String): 当 `contentType` 为 "text" 时的文本内容。
  - `comment` (String, Optional): 志愿者添加的备注或上下文。
  - `image` (File): 当 `contentType` 为 "image" 时的图片文件。

**4. 核心处理逻辑 (伪代码):**

JavaScript

```
// main handler for POST /api/submit
function handleSubmit(request, response) {
    // 1. 验证 'Authorization' header 中的密钥
    if (!authenticate(request.headers.authorization)) {
        return response.status(401).send({ error: 'Unauthorized' });
    }

    // 2. 解析 multipart/form-data
    const { submitter, contentType, content, comment } = request.body;
    const imageFile = request.file; // 'image'

    // 3. 获取飞书 tenant_access_token
    const accessToken = await getFeishuAccessToken();

    let recordContent = {};
    
    // 4. 根据内容类型处理数据
    if (contentType === 'image' && imageFile) {
        // 4a. 上传图片到飞书云空间，获取 file_token
        const fileToken = await uploadImageToFeishu(accessToken, imageFile);
        recordContent.imageField = [{ file_token: fileToken }]; // 假设图片字段名为 'imageField'
        recordContent.textField = comment || imageFile.originalname; // 文字字段可存备注或文件名
    } else if (contentType === 'text' && content) {
        // 4b. 准备文本数据
        recordContent.textField = content; // 假设文本字段名为 'textField'
        if (comment) recordContent.commentField = comment; // 假设备注字段名为 'commentField'
    } else {
        return response.status(400).send({ error: 'Invalid content' });
    }

    // 5. 构造要写入 Base 的记录
    const feishuRecord = {
        fields: {
            submitterField: submitter, // 假设提交者字段名为 'submitterField'
            ...recordContent
        }
    };

    // 6. 调用飞书 API，向多维表格写入记录
    const success = await writeToFeishuBase(accessToken, feishuRecord);

    // 7. 返回成功或失败响应
    if (success) {
        return response.status(200).send({ message: 'Submit successful' });
    } else {
        return response.status(500).send({ error: 'Failed to write to Feishu' });
    }
}
```

------



### **第二部分：桌面客户端 (Desktop Client)**



建议使用 **Electron** 或 **Tauri** 进行开发。Electron使用Web技术栈，社区成熟，资源丰富，对AI辅助开发友好。

**1. 核心职责：**

- 提供一个简洁的图形界面。
- 在后台运行，并注册一个全局快捷键。
- 读取用户剪贴板中的内容（图片或文字）。
- 允许用户进行首次配置（输入名字、中继服务地址和密钥）。
- 将捕获的内容安全地发送到云端中继服务。

**2. 关键功能实现要点 (以Electron为例)：**

- **首次配置:**

  - 启动时检查本地是否存有配置（可使用 `electron-store` 库）。
  - 若无配置，则弹窗引导用户输入：
    - `submitterName` (您的名字)
    - `relayApiUrl` (云端中继服务的地址)
    - `sharedSecretKey` (与中继服务约定的密钥)
  - 将配置加密后存储在本地。

- **后台与快捷键 (`main.js`)**:

  JavaScript

  ```
  import { app, globalShortcut, Tray, Menu } from 'electron';
  
  app.on('ready', () => {
      // 创建系统托盘图标
      const tray = new Tray('/path/to/icon.png');
      // ... 设置托盘菜单
  
      // 注册全局快捷键
      globalShortcut.register('CommandOrControl+Shift+S', () => {
          // 打开或显示捕获窗口
          createCaptureWindow();
      });
  });
  ```

- **捕获窗口 (`captureWindow.js`)**:

  - 创建一个小的、无边框的 `BrowserWindow`。
  - 使用 `navigator.clipboard.read()` API 读取剪贴板内容。
  - 判断内容是图片 (`Blob`) 还是文本 (`String`)。
  - 在界面上进行预览。

- **提交逻辑 (`renderer.js`)**:

  JavaScript

  ```
  async function submitData() {
      const clipboardItems = await navigator.clipboard.read();
      // ... 解析 clipboardItems ...
  
      const formData = new FormData();
      formData.append('submitter', storedConfig.submitterName);
      formData.append('comment', document.getElementById('comment-input').value);
  
      if (isImage) {
          formData.append('contentType', 'image');
          formData.append('image', imageBlob, 'screenshot.png');
      } else {
          formData.append('contentType', 'text');
          formData.append('content', textContent);
      }
  
      try {
          const response = await fetch(storedConfig.relayApiUrl, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${storedConfig.sharedSecretKey}`
              },
              body: formData
          });
          // ... 处理成功或失败的UI反馈 ...
      } catch (error) {
          // ... 处理网络错误 ...
      }
  }
  ```



### **3. 开发步骤建议**



1. **准备飞书环境**：创建多维表格，设计好字段（如：`提交者`、`主要内容`、`图片附件`、`备注`），并创建机器人应用，获取 `App ID`, `App Secret`, `Base App Token`, `Table ID`。
2. **开发云端中继服务**：优先开发后端。使用 Postman 或 Insomnia 等工具进行充分测试，确保API能正确接收数据并写入飞书。
3. **部署云端中继服务**：将其部署到Vercel等平台，获得一个公网URL。
4. **开发桌面客户端**：
   - 先搭建基础UI界面。
   - 实现剪贴板读取与预览功能。
   - 实现与已部署的中继服务API的联调。
   - 最后添加全局快捷键、系统托盘等外围功能。
5. **打包与分发**：使用 `electron-builder` 或 `electron-packager` 将应用打包成 `.exe` 和 `.dmg` 文件，分发给志愿者。

------

这份文档为您提供了一个清晰的起点。您可以将每个部分，特别是带有伪代码的逻辑块，直接交给 Cursor，并要求它使用您选择的具体技术栈（如 "使用 Express.js 和 multer 库实现这个 API"）来生成代码。