# Browser Claw

这是一个基于浏览器的 AI 智能助手插件 (Manifest V3)，允许用户通过自然语言指令，自动调用当前网页已配置的 API 接口，实现网页功能的自动化操作。

## 功能特性

- **API 管理面板**: 在 Popup / Side Panel 中可视化管理当前网站的 API 接口（Skill）。
- **AI 对话助手**: 通过自然语言指令触发 API 调用。
- **智能任务规划**: 支持复杂任务拆解，例如"批量修改库存"（查询 -> 循环执行）。
- **安全执行**: 请求在当前页面上下文（Content Script）中执行，自动携带 Cookie/Session。
- **强制确认机制**: 每次 API 调用前，AI 必须向用户展示即将调用的接口和参数，经用户确认后才真正执行。

## 安装与开发

1. **安装依赖**:
   ```bash
   pnpm install
   ```

2. **开发模式**:
   ```bash
   pnpm dev
   ```
   这将启动 Vite 开发服务器。

3. **加载扩展**:
   - 打开 Chrome 浏览器，进入 `chrome://extensions/`。
   - 开启右上角的 "Developer mode" (开发者模式)。
   - 点击 "Load unpacked" (加载已解压的扩展程序)。
   - 选择项目下的 `dist` 目录 (注意：如果是开发模式，选择 `dist`；如果是构建模式，先运行 `pnpm build`)。

4. **构建生产版本**:
   ```bash
   pnpm build
   ```
   构建产物在 `dist` 目录，同时会生成 `release/crx-*.zip`。

## 使用说明

1. **配置 OpenAI Key**:
   - 打开扩展的 Popup。
   - 切换到 "模型" 标签页。
   - 输入 API Key、Base URL 和模型名称并保存。

2. **添加 Skill**:
   - 在 "能力" 标签页点击 "批量导入" 或手动添加。
   - 输入接口名称、描述、方法、路径和参数定义。

3. **发送指令**:
   - 切换到 "会话" 标签页，点击 "去对话" 打开完整对话页面。
   - 输入指令，例如: "把类目为 123 的商品售卖时间用免审更新更新为 2025 年 12 月 12 日"。
   - AI 会展示即将调用的接口和参数，**用户确认后才真正执行**。

## 项目结构

- `src/popup`: Popup UI (React + Tailwind + daisyUI)。
- `src/content`: Content Script (负责在页面上下文中发送网络请求)。
- `src/components`: UI 组件（Skills、Chat、Models、Channels、FAQ）。
- `src/types`: TypeScript 类型定义。
- `docs/`: 系统设计文档。
