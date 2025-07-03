# 素材快捷投递工具 (Material Quick-Capture Tool)

一个高效的素材收集工具，包含桌面客户端和云端服务，支持快速捕获和投递文本、图片到飞书多维表格。

## 🚀 项目特色

- **🎯 智能捕获**：一键智能识别剪贴板内容类型（文本/图片）
- **⌨️ 快捷键自定义**：现代化的快捷键设置界面，支持一键捕获设置
- **🔄 实时同步**：桌面捕获内容实时同步到飞书多维表格
- **🎨 现代化界面**：简洁美观的用户界面设计
- **🔧 灵活配置**：支持服务器地址、访问密钥等全面配置

## 📁 项目结构

```
Material Quick-Capture Tool/
├── desktop-client/          # 桌面客户端 (已废弃，使用根目录版本)
├── cloud-relay-service/     # 云端中继服务 (Next.js)
├── src/                    # 桌面客户端源码 (Electron)
│   ├── main.js            # 主进程 - 完整版本
│   └── api.js             # API 通信模块
├── renderer/              # 渲染进程界面
│   ├── index.html         # 主窗口
│   ├── capture.html       # 捕获窗口
│   ├── styles.css         # 主窗口样式
│   ├── capture.css        # 捕获窗口样式
│   ├── main.js           # 主窗口逻辑
│   └── capture.js        # 捕获窗口逻辑
├── config/               # 配置文件目录
└── assets/              # 静态资源
```

## ✨ 核心功能

### 🎯 智能捕获
- **统一快捷键**：`Cmd+Shift+T` (macOS) / `Ctrl+Shift+T` (Windows/Linux)
- **自动识别**：智能检测剪贴板中的内容类型
- **一键操作**：无需记忆多个快捷键，一个快捷键搞定所有捕获

### ⌨️ 快捷键自定义
- **直观设置**：点击"修改"按钮直接按键设置
- **实时预览**：即时显示捕获到的快捷键组合
- **智能验证**：自动过滤系统保留键，确保快捷键有效
- **冲突避免**：智能管理快捷键注册，避免重复和冲突

### 📋 内容捕获
- **文本捕获**：支持各种文本内容，自动去除空白
- **图片捕获**：支持截图、复制的图片内容
- **内容预览**：提交前可预览和编辑内容
- **备注添加**：支持为每个素材添加个性化备注

## 🛠 技术栈

### 桌面客户端
- **Electron 27+**：跨平台桌面应用框架
- **Node.js 18+**：JavaScript 运行环境  
- **HTML5/CSS3/ES6**：现代Web技术栈

### 云端服务
- **Next.js 14+**：React 全栈框架
- **飞书开放API**：多维表格集成
- **Node.js**：服务端运行环境

## 📦 安装与使用

### 环境要求
- Node.js 18+ 
- npm 或 yarn
- macOS 10.14+ / Windows 10+ / Linux (Ubuntu 18.04+)

### 桌面客户端

```bash
# 克隆项目
git clone https://github.com/rampagepeter/material-quick-capture-tool.git
cd material-quick-capture-tool

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 标准模式运行  
npm start

# 构建打包
npm run build
```

### 云端服务

```bash
# 进入云端服务目录
cd cloud-relay-service

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产模式运行
npm start
```

## ⚙️ 配置说明

### 首次设置

1. **启动应用**：运行桌面客户端
2. **服务器配置**：
   - 服务器地址：`http://localhost:3001` (本地开发)
   - 访问密钥：设置安全密钥
   - 提交者姓名：您的标识名称

3. **快捷键设置**：
   - 点击"修改"按钮
   - 按下想要的快捷键组合
   - 保存设置

4. **测试连接**：点击"测试连接"验证配置

### 云端服务配置

在 `cloud-relay-service/.env.local` 中配置：

```bash
# 飞书应用配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_APP_TOKEN=your_app_token
FEISHU_TABLE_ID=your_table_id

# 安全配置
SECRET_KEY=your_secret_key
```

## 🎮 使用指南

### 日常操作

1. **复制内容**：复制文本或截图到剪贴板
2. **快捷捕获**：按 `Cmd+Shift+T` 启动智能捕获
3. **自动识别**：系统自动识别内容类型并打开对应窗口
4. **添加备注**：可选添加备注信息
5. **一键提交**：点击提交完成投递

### 托盘功能

- **最小化运行**：应用关闭后在托盘中继续运行
- **快速访问**：右键托盘图标快速访问功能
- **智能捕获**：托盘菜单中直接使用智能捕获

## 🔧 开发说明

### 项目特点

- **双文件结构**：项目包含简化版和完整版main.js，当前使用完整版
- **智能快捷键管理**：避免重复注册，精确注销旧快捷键
- **现代化配置**：JSON配置文件，支持热重载
- **API客户端**：模块化的云端通信接口

### 已完成功能

- [x] 项目基础架构
- [x] 桌面客户端完整功能
- [x] 智能捕获系统
- [x] 快捷键自定义界面
- [x] 云端中继服务
- [x] 飞书API集成
- [x] 全流程功能验证
- [x] 连接配置优化
- [x] 快捷键冲突解决

### 技术亮点

1. **智能内容识别**：优先检测图片，其次检测文本
2. **快捷键格式统一**：使用Electron标准格式避免冲突
3. **现代化交互**：按键捕获式快捷键设置
4. **稳定性保障**：完善的错误处理和状态管理

## 🐛 问题排查

### 常见问题

**Q: 快捷键不生效？**
A: 检查是否与系统快捷键冲突，尝试重新设置快捷键

**Q: 连接云端服务失败？**  
A: 确认云端服务已启动在3001端口，检查网络连接

**Q: 剪贴板内容无法识别？**
A: 确保复制了有效的文本或图片内容

## 📄 开发文档

详细的开发文档请参考：
- [开发文档](./素材快捷投递工具%20(Material%20Quick-Capture%20Tool)%20-%20开发文档.md)
- [开发进度](./开发进度-TodoList.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 版本历史

### v1.0.0 (当前版本)
- ✅ 智能捕获功能
- ✅ 快捷键自定义
- ✅ 云端服务集成
- ✅ 飞书多维表格同步
- ✅ 现代化用户界面

## 📜 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 👥 作者

项目开发：AI Assistant & 用户协作开发

---

> 💡 **提示**：这是一个持续改进的项目，如有建议或问题，欢迎提出Issue或Pull Request！ 