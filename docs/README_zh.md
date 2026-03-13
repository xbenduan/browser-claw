<div align="center">

<img src="../public/logo.png" alt="Browser Claw" width="128" />

# Browser Claw

**用自然语言驱动 API 调用的 AI 浏览器插件。**

[![Chrome Extension](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[English](../README.md)&nbsp;·&nbsp;[简体中文](./README_zh.md)

</div>

---

## ✨ 简介

Browser Claw 是一款 Chrome 浏览器扩展（Manifest V3），让你能通过**自然语言**编排任意网站的 API 接口。只需描述你想做什么，AI 助手会自动规划、确认并执行相应的 API 调用——所有请求均在当前页面的安全上下文中执行。

## 🎯 功能特性

| 功能 | 说明 |
|------|------|
| **API 能力管理** | 在 Popup / Side Panel 中可视化管理当前网站的 API 接口（Skill） |
| **AI 对话助手** | 通过自然语言指令触发 API 调用 |
| **智能任务规划** | 支持复杂任务拆解——例如"批量修改库存" → 查询 → 循环执行 |
| **安全执行** | 请求在 Content Script 中执行，自动携带 Cookie / Session |
| **强制确认** | 每次 API 调用前展示接口和参数，用户确认后才真正执行 |

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/)（推荐）

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本——产物在 dist/ 和 release/crx-*.zip
pnpm build
```

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序** → 选择 `dist` 目录

## 📖 使用说明

### 1 · 配置模型

打开扩展 Popup → 切换到 **模型** 标签页 → 输入 API Key、Base URL 和模型名称，然后保存。

### 2 · 添加 Skill

在 **能力** 标签页点击 **批量导入** 或手动添加。每个 Skill 需要填写名称、描述、HTTP 方法、路径和参数定义。

### 3 · 开始对话

切换到 **会话** 标签页 → 点击 **去对话** 打开完整对话页面。输入指令，例如：

> *"把类目为 123 的商品售卖时间更新为 2025 年 12 月 12 日"*

AI 会展示即将调用的接口和参数——**用户确认后才会真正执行**。

## 🗂 项目结构

```
browser-claw/
├── src/
│   ├── popup/        # Popup UI 入口
│   ├── sidepanel/    # Side Panel UI 入口
│   ├── content/      # Content Script——在页面上下文中发送请求
│   ├── background/   # Service Worker
│   ├── components/   # 共享 React 组件（Skills、Chat、Models …）
│   ├── core/         # 核心逻辑与 AI 编排
│   ├── hooks/        # 自定义 React Hooks
│   ├── types/        # TypeScript 类型定义
│   ├── utils/        # 工具函数
│   └── assets/       # 静态资源
├── public/           # 扩展静态文件（logo 等）
├── docs/             # 设计文档
├── dist/             # 构建产物
└── release/          # 打包的 .zip 发布包
```

## 🛠 技术栈

- **扩展** —— Chrome Manifest V3 + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- **UI** —— React 19 + Tailwind CSS 4 + Lucide Icons
- **AI** —— OpenAI 兼容 SDK
- **构建** —— Vite 7 + TypeScript 5.8

## 📄 许可证

MIT
