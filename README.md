<div align="center">

<img src="public/logo.png" alt="Browser Claw" width="128" />

# Browser Claw

**AI-powered browser extension that turns natural language into API calls.**

[![Chrome Extension](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[English](./README.md)&nbsp;·&nbsp;[简体中文](./docs/README_zh.md)

</div>

---

## ✨ What is Browser Claw?

Browser Claw is a Chrome extension (Manifest V3) that lets you **orchestrate any website's APIs through natural language**. Simply describe what you want to do, and the AI assistant will plan, confirm, and execute the right API calls — all within the security context of the current page.

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **API Skill Manager** | Visually manage API endpoints (Skills) per site via Popup / Side Panel |
| **AI Chat Assistant** | Trigger API calls through natural language instructions |
| **Smart Task Planning** | Decompose complex tasks — e.g. "bulk update inventory" → query → loop execute |
| **Secure Execution** | Requests run inside the Content Script with native Cookie / Session context |
| **Confirm Before Execute** | Every API call is presented to you for review before it fires |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) (recommended)

### Install & Run

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production — outputs to dist/ and release/crx-*.zip
pnpm build
```

### Load in Chrome

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist` directory

## 📖 Usage

### 1 · Configure the Model

Open the extension popup → **Model** tab → enter your API Key, Base URL and model name, then save.

### 2 · Add Skills

In the **Skills** tab, click **Batch Import** or add manually. Each skill needs a name, description, HTTP method, path, and parameter schema.

### 3 · Chat

Switch to the **Chat** tab → click **Go to Chat** to open the full conversation page. Type an instruction like:

> *"Update the selling period of all products in category 123 to December 12, 2025."*

The AI will show the planned API call and parameters — **nothing executes until you confirm**.

## 🗂 Project Structure

```
browser-claw/
├── src/
│   ├── popup/        # Popup UI entry
│   ├── sidepanel/    # Side Panel UI entry
│   ├── content/      # Content Script — sends requests in page context
│   ├── background/   # Service Worker
│   ├── components/   # Shared React components (Skills, Chat, Models …)
│   ├── core/         # Core logic & AI orchestration
│   ├── hooks/        # Custom React hooks
│   ├── types/        # TypeScript type definitions
│   ├── utils/        # Utility functions
│   └── assets/       # Static assets
├── public/           # Extension static files (logo, etc.)
├── docs/             # Design documents
├── dist/             # Build output
└── release/          # Packaged .zip releases
```

## 🛠 Tech Stack

- **Extension** — Chrome Manifest V3 + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- **UI** — React 19 + Tailwind CSS 4 + Lucide Icons
- **AI** — OpenAI-compatible SDK
- **Build** — Vite 7 + TypeScript 5.8

## 📄 License

MIT
