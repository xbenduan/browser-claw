# Browser Claw — 前端系统开发分析文档

> **项目名称**: Browser Claw  
> **版本**: v1.0.0  
> **文档版本**: v1.0  
> **创建日期**: 2026-03-10  
> **技术栈**: React 19 + TypeScript + Tailwind CSS 4 + Vite 7 + Chrome Extension Manifest V3 + OpenAI SDK

---

## 目录

1. [项目概述与愿景](#1-项目概述与愿景)
2. [核心设计理念](#2-核心设计理念)
3. [系统架构设计](#3-系统架构设计)
4. [Chrome Extension 架构详解](#4-chrome-extension-架构详解)
5. [Skill 系统设计（核心）](#5-skill-系统设计核心)
6. [AI Agent 引擎设计](#6-ai-agent-引擎设计)
7. [请求代理层设计](#7-请求代理层设计)
8. [前端 UI 设计](#8-前端-ui-设计)
9. [数据流与状态管理](#9-数据流与状态管理)
10. [频道系统设计](#10-频道系统设计)
11. [安全性设计](#11-安全性设计)
12. [错误处理与容错机制](#12-错误处理与容错机制)
13. [性能优化策略](#13-性能优化策略)
14. [测试策略](#14-测试策略)
15. [开发阶段规划与里程碑](#15-开发阶段规划与里程碑)
16. [当前代码分析与改进建议](#16-当前代码分析与改进建议)
17. [附录：关键数据结构定义](#17-附录关键数据结构定义)

---

## 1. 项目概述与愿景

### 1.1 项目定位

Browser Claw 是一款基于 Chrome 浏览器的 AI 智能 Agent 插件，核心思路是：**用户通过自然语言下达指令，AI 自动分析意图、规划执行步骤、调用预配置的 API 接口完成任务**。

这与 OpenClaw 等浏览器 Agent 项目的理念异曲同工——操作浏览器的本质就是调用各个网站的 API。但由于权限限制（CORS、Cookie、鉴权等），外部工具无法直接调用这些 API。而 Chrome Extension 的 **Content Script 运行在目标网页的上下文中**，天然拥有该网站的 Cookie/Session/Token 等认证凭据，可以合法地发起带身份信息的 HTTP 请求。

### 1.2 核心价值主张

| 维度       | 传统方式                               | 本项目方案                            |
| ---------- | -------------------------------------- | ------------------------------------- |
| **认证**   | 需要手动获取 Token/Cookie 配置到脚本中 | Content Script 自动复用浏览器 Session |
| **操作**   | 逐个在管理后台页面上手动点击           | 自然语言描述任务，AI 自动规划执行     |
| **批量**   | 借助外部脚本，调试成本高               | 声明式 Skill 配置 + AI 自动循环调用   |
| **安全**   | 可能涉及 Token 泄露风险                | 请求在浏览器沙盒内执行，凭据不外传    |
| **可扩展** | 每个业务场景需要单独写脚本             | 只需新增 Skill 文档，AI 自动适配      |
| **可控性** | 脚本执行过程不透明                     | 每次 API 调用前强制用户确认，完全可控 |

### 1.3 典型使用场景

**场景一：批量更新商品售卖时间**

> 用户指令：「帮我把类目为 123 的商品的售卖时间用免审更新的方式更新为 2025 年 12 月 12 日」

AI 执行步骤：

1. **意图识别**：更新商品售卖时间，条件为类目=123，方式=免审更新
2. **规划**：调用「商品详情查询」Skill → 过滤类目 123 → 提取所有商品 ID → 循环调用「免审更新」Skill
3. **确认**：向用户展示即将调用的接口和参数（如 `GET /api/v1/products?category_id=123`），**用户确认后才执行**
4. **执行**：Content Script 在当前站点上下文中发起请求
5. **二次确认**：展示批量更新计划（接口、参数模板、总条数 256），**用户确认后批量执行**
6. **反馈**：汇总结果告知用户成功/失败数量

**场景二：订单状态批量查询**

> 用户指令：「查询最近 7 天内状态为待发货的所有订单」

**场景三：库存预警检查**

> 用户指令：「检查所有库存低于 10 的商品，并列出商品名称和当前库存」

---

## 2. 核心设计理念

### 2.1 Skill-as-Document 理念

本项目的核心设计哲学是 **Skill-as-Document**（能力即文档）。不同于传统的硬编码方式，每个 API 能力被抽象为一份结构化的 **Skill 文档**，其中包含：

- **语义描述**：这个接口能做什么，AI 据此判断是否需要调用
- **技术定义**：HTTP Method、URL、请求参数、响应结构
- **使用约束**：参数校验规则、依赖关系、执行注意事项

这种设计的核心优势在于：

1. **AI 可理解**：LLM 通过 Function Calling 能力，直接将 Skill 文档作为可用的 Tools 列表
2. **零代码扩展**：新增业务能力只需编写一份 Skill JSON/YAML 文档，无需修改代码
3. **跨站复用**：同一类站点（如电商后台、CMS 系统）可共享 Skill 模板

### 2.2 浏览器即运行时

传统的 API 自动化工具（如 Postman Runner、cURL 脚本）面临的最大挑战是**认证**。本项目充分利用 Chrome Extension 的架构优势：

```
┌─────────────────────────────────────────────────┐
│                 Chrome Browser                    │
│                                                   │
│  ┌─────────┐    ┌──────────────┐    ┌─────────┐ │
│  │ Popup   │◄──►│ Background   │◄──►│ Content │ │
│  │ (React) │    │ (Service     │    │ Script  │ │
│  │         │    │  Worker)     │    │ (注入到  │ │
│  └─────────┘    └──────────────┘    │ 目标页面)│ │
│                                      └─────────┘ │
│                                          │        │
│                                    ┌─────┴─────┐  │
│                                    │ fetch()   │  │
│                                    │ 携带该站点 │  │
│                                    │ Cookie    │  │
│                                    └───────────┘  │
└─────────────────────────────────────────────────┘
```

Content Script 在页面上下文中执行 `fetch()`，**自动携带当前站点的 Cookie/Session**，无需手动管理认证信息。

### 2.3 LLM Function Calling 驱动

AI 引擎基于 OpenAI 兼容的 **Function Calling（Tool Use）** 机制，将每个 Skill 转换为 LLM 的 Tool 定义。当用户输入自然语言指令时：

1. LLM 分析用户意图
2. LLM 选择需要调用的 Tool（对应 Skill）
3. LLM 生成调用参数
4. 引擎执行实际 API 调用
5. 结果返回给 LLM 做进一步分析或决策
6. 循环直到任务完成

### 2.4 强制确认原则（Mandatory Confirmation）

这是 Browser Claw 的一项核心安全设计：**每一次 API 调用前，AI 必须向用户完整展示即将调用的接口信息和参数，只有用户明确确认（回复"是"或点击确认按钮）后，才真正执行请求。**

这意味着 Agent 的工作流程并非"全自动"，而是 **Human-in-the-Loop（人类在环）** 模式：

```
用户指令 → AI 分析 → AI 展示执行计划 → 用户确认 → 执行请求 → 返回结果
                                           ↓
                                     用户拒绝 → 终止/修改
```

#### 为什么强制确认？

| 原因           | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| **防误操作**   | AI 可能误解用户意图，错误调用写入/删除类接口造成不可逆后果   |
| **参数透明**   | 用户可以在执行前审查 AI 组装的每一个参数是否正确             |
| **审计可追溯** | 所有操作都经过用户确认，形成明确的操作审批链                 |
| **信任建立**   | 在用户尚未完全信任 AI 判断能力时，强制确认是最安全的交互模式 |

#### 确认信息展示内容

每次确认卡片必须包含以下信息：

1. **接口名称**：将要调用的 Skill 名称（如 "免审更新"）
2. **接口描述**：该 Skill 的功能说明
3. **请求方法 + URL**：如 `POST /api/v1/products/{item_id}/quick-update`
4. **完整参数列表**：AI 填入的所有参数及其值
5. **风险等级**：来自 Skill 定义的 `riskLevel` 标记
6. **预估影响**：如批量操作时显示 "将影响 256 条数据"

#### 批量操作的确认策略

对于需要循环调用的批量场景（如更新 256 个商品），不需要逐条确认，而是：

1. **首次确认**：展示批量执行计划（接口、参数模板、总数量），用户确认后批量执行
2. **参数变化确认**：如果循环中某次调用的参数与模板不同，需要单独确认
3. **中途暂停**：用户可随时暂停批量执行，查看当前进度后决定继续或终止

---

---

## 3. 系统架构设计

### 3.1 整体分层架构

```
┌───────────────────────────────────────────────────────────────────┐
│                         表现层 (Presentation)                      │
│  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────┐ │
│  │ Chat Panel │ │ Skills    │ │ Models    │ │ Channels Manager │ │
│  │            │ │ Manager   │ │ Config    │ │                  │ │
│  └────────────┘ └───────────┘ └───────────┘ └──────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                         业务逻辑层 (Business Logic)                │
│  ┌────────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ Agent Engine   │ │ Task Planner │ │ Skill Registry          │ │
│  │ (LLM 交互 &    │ │ (任务分解 &  │ │ (Skill 加载/解析/匹配)   │ │
│  │  Tool Calling) │ │  执行编排)   │ │                         │ │
│  └────────────────┘ └──────────────┘ └─────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                         通信层 (Communication)                     │
│  ┌────────────────────────┐  ┌──────────────────────────────────┐ │
│  │ Chrome Message Bridge  │  │ Storage Manager                 │ │
│  │ (Popup ↔ Background    │  │ (chrome.storage.local /         │ │
│  │  ↔ Content Script)     │  │  chrome.storage.sync)           │ │
│  └────────────────────────┘  └──────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                         执行层 (Execution)                         │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Content Script Request Proxy                                 │ │
│  │ - 在目标页面上下文中执行 fetch()                                │ │
│  │ - 自动携带 Cookie/Session/CSRF Token                          │ │
│  │ - 响应序列化 & 错误处理                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责划分

| 模块                | 职责                                                            | 运行环境           |
| ------------------- | --------------------------------------------------------------- | ------------------ |
| **Popup UI**        | 用户交互界面，包括 Chat、Skills、Models、Channels、FAQ 五个 Tab | Popup Page         |
| **Agent Engine**    | 与 LLM 交互，管理对话上下文，处理 Function Calling 响应         | Popup / Background |
| **Task Planner**    | 将复杂任务拆分为可执行步骤，管理执行顺序和依赖                  | Popup / Background |
| **Skill Registry**  | 管理所有已注册的 Skill，提供查询、匹配、导入导出功能            | Popup / Background |
| **Message Bridge**  | Chrome Extension 各组件间的消息传递                             | 全局               |
| **Storage Manager** | 持久化存储 Skill 配置、模型设置、对话历史等                     | 全局               |
| **Request Proxy**   | 在 Content Script 中执行实际的 HTTP 请求                        | Content Script     |

### 3.3 技术选型详解

| 技术                   | 版本 | 选型理由                                          |
| ---------------------- | ---- | ------------------------------------------------- |
| **React**              | 19.x | 声明式 UI 开发，组件化架构，Hooks 生态成熟        |
| **TypeScript**         | 5.8  | 类型安全，IDE 支持完善，Skill Schema 的类型定义   |
| **Tailwind CSS 4**     | 4.2  | 原子化 CSS，减小打包体积，用的 UI 组件            |
| **Vite 7**             | 7.0  | 极速开发体验，HMR 支持，模块联邦                  |
| **@crxjs/vite-plugin** | 2.0  | Vite 环境下开发 Chrome Extension 的最佳实践       |
| **OpenAI SDK**         | 6.x  | 官方 TypeScript SDK，完整的 Function Calling 支持 |
| **Chrome Manifest V3** | 3    | Chrome 强制要求的最新扩展规范，更好的安全模型     |

---

## 4. Chrome Extension 架构详解

### 4.1 Manifest V3 配置分析

当前项目的 `manifest.config.ts` 定义了以下关键配置：

```typescript
{
  manifest_version: 3,
  permissions: ['storage', 'scripting', 'activeTab'],
  host_permissions: ['https://*/*', 'http://*/*'],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://*/*'],
  }],
  action: {
    default_popup: 'src/popup/index.html',
  }
}
```

#### 权限说明

| 权限                  | 用途                                  | 必要性 |
| --------------------- | ------------------------------------- | ------ |
| `storage`             | 持久化存储 Skills、模型配置、对话历史 | 必需   |
| `scripting`           | 动态注入脚本到页面（按需场景）        | 必需   |
| `activeTab`           | 获取当前活动 Tab 的信息               | 必需   |
| `host_permissions: *` | 允许 Content Script 在所有站点运行    | 必需   |

#### 建议新增的权限

| 权限            | 用途                                           |
| --------------- | ---------------------------------------------- |
| `tabs`          | 查询和操作标签页，用于多 Tab 场景              |
| `sidePanel`     | 使用 Side Panel 替代 Popup，获得更大的操作空间 |
| `notifications` | 异步任务完成后通知用户                         |
| `contextMenus`  | 右键菜单快速触发指令                           |

### 4.2 三大运行环境

#### 4.2.1 Popup (弹出窗口)

当前的主 UI 入口，基于 React 渲染。用户点击扩展图标时弹出。

**局限性**：Popup 在用户点击其他区域时会关闭，**不适合长时间运行的任务**。

**建议**：迁移到 **Side Panel** 模式，或提供两种模式的切换：

- **Quick Mode (Popup)**：快速查看状态、发送简单指令
- **Full Mode (Side Panel)**：完整的对话界面、任务监控、详细配置

#### 4.2.2 Background Service Worker

Manifest V3 中 Background Page 被替换为 Service Worker，具有以下特点：

- **无 DOM 访问**：不能操作页面元素
- **生命周期受限**：空闲 30 秒后可能被终止
- **事件驱动**：通过 `chrome.runtime.onMessage` 等监听器工作

**关键职责**：

1. 充当 Popup ↔ Content Script 的消息中继
2. 管理长连接（使用 `chrome.runtime.connect` 的 Port）
3. 处理 Content Script 无法完成的操作（如跨 Tab 协调）

#### 4.2.3 Content Script

运行在目标网页上下文中的脚本。当前的 `src/content/main.tsx` 已实现核心代理功能：

```typescript
// 监听来自 Popup/Background 的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "EXECUTE_API") {
    const { method, url, body, headers } = request.payload;
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: method !== "GET" && body ? JSON.stringify(body) : undefined,
    })
      .then(async (res) => {
        /* 响应处理 */
      })
      .catch((err) => {
        /* 错误处理 */
      });
    return true; // 保持消息通道开放
  }
});
```

### 4.3 消息通信架构

```
                    chrome.runtime.sendMessage()
┌─────────┐  ──────────────────────────────────►  ┌─────────────┐
│         │                                        │  Background  │
│  Popup  │  ◄──────────────────────────────────  │  Service     │
│         │         sendResponse()                 │  Worker      │
└─────────┘                                        └──────┬──────┘
                                                          │
                    chrome.tabs.sendMessage()              │
                  ──────────────────────────────────►      │
                                                    ┌─────┴──────┐
                  ◄──────────────────────────────── │  Content    │
                         sendResponse()             │  Script     │
                                                    └────────────┘
```

**消息协议设计**：

```typescript
// 统一消息格式
interface ExtensionMessage {
  type: MessageType;
  payload: unknown;
  requestId?: string; // 用于请求-响应匹配
  timestamp?: number; // 时间戳
}

// 消息类型枚举
enum MessageType {
  // API 执行
  EXECUTE_API = "EXECUTE_API",
  EXECUTE_API_RESULT = "EXECUTE_API_RESULT",

  // 批量操作
  EXECUTE_BATCH = "EXECUTE_BATCH",
  BATCH_PROGRESS = "BATCH_PROGRESS",

  // 状态查询
  GET_PAGE_INFO = "GET_PAGE_INFO",
  GET_COOKIES = "GET_COOKIES",

  // Skill 相关
  SKILL_TEST = "SKILL_TEST",

  // 生命周期
  PING = "PING",
  PONG = "PONG",
}
```

---

## 5. Skill 系统设计（核心）

### 5.1 Skill 定义规范

Skill 是本系统的核心概念，每个 Skill 对应一个可调用的 API 接口。Skill 定义遵循以下 Schema：

```typescript
interface SkillDefinition {
  // === 基础信息 ===
  id: string; // 唯一标识，如 "product_query"
  name: string; // 人类可读名称，如 "商品详情查询"
  description: string; // 语义描述，供 AI 理解用途
  version: string; // Skill 版本号

  // === API 定义 ===
  api: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string; // URL 路径，支持路径参数，如 "/api/v1/products/{id}"
    baseUrl?: string; // 基础 URL（可选，默认使用当前站点）
    headers?: Record<string, string>; // 额外请求头
    timeout?: number; // 超时时间 (ms)
  };

  // === 参数定义 ===
  parameters: SkillParameter[];

  // === 响应定义 ===
  response: {
    type: "json" | "text" | "blob";
    schema?: JsonSchema; // JSON Schema 描述响应结构
    extractors?: ResponseExtractor[]; // 从响应中提取关键字段
  };

  // === 元信息 ===
  meta: {
    category?: string; // 分类，如 "商品管理"、"订单管理"
    tags?: string[]; // 标签
    riskLevel?: "safe" | "moderate" | "dangerous"; // 风险等级
    requireConfirm?: boolean; // 是否需要用户确认后执行
    rateLimit?: {
      // 频率限制
      maxCalls: number;
      windowMs: number;
    };
  };

  // === 站点绑定 ===
  binding: {
    hostPatterns: string[]; // 匹配的站点 Pattern，如 ["*.example.com"]
    channelId?: string; // 绑定到特定频道
  };
}
```

### 5.2 参数定义详解

```typescript
interface SkillParameter {
  name: string; // 参数名
  type: "string" | "number" | "boolean" | "array" | "object";
  location: "path" | "query" | "body" | "header"; // 参数位置
  required: boolean;
  description: string; // 参数描述，供 AI 理解
  default?: unknown; // 默认值
  enum?: unknown[]; // 可选值列表
  example?: unknown; // 示例值

  // 校验规则
  validation?: {
    min?: number;
    max?: number;
    pattern?: string; // 正则表达式
    minLength?: number;
    maxLength?: number;
  };

  // 嵌套参数（当 type 为 object 时）
  properties?: SkillParameter[];

  // 数组元素类型（当 type 为 array 时）
  items?: Omit<SkillParameter, "name" | "location" | "required">;
}
```

### 5.3 响应提取器

用于从 API 响应中提取 AI 需要的关键信息，避免将完整响应传递给 LLM（节省 Token）：

```typescript
interface ResponseExtractor {
  name: string; // 提取后的字段名
  path: string; // JSONPath 表达式，如 "$.data.items[*].id"
  description: string; // 字段描述
  transform?: "count" | "first" | "last" | "flatten" | "unique";
}
```

### 5.4 Skill 示例

#### 商品详情查询 Skill

```json
{
  "id": "product_query",
  "name": "商品详情查询",
  "description": "查询商品详细信息。如果未传商品ID则查询全部商品列表（支持分页和过滤），否则查询指定商品的详细信息。可通过类目ID、商品状态等条件进行过滤。",
  "version": "1.0.0",
  "api": {
    "method": "GET",
    "path": "/api/v1/products",
    "timeout": 10000
  },
  "parameters": [
    {
      "name": "category_id",
      "type": "number",
      "location": "query",
      "required": false,
      "description": "类目ID，用于过滤指定类目下的商品"
    },
    {
      "name": "status",
      "type": "string",
      "location": "query",
      "required": false,
      "description": "商品状态过滤",
      "enum": ["online", "offline", "draft"]
    },
    {
      "name": "page",
      "type": "number",
      "location": "query",
      "required": false,
      "description": "页码，从1开始",
      "default": 1
    },
    {
      "name": "page_size",
      "type": "number",
      "location": "query",
      "required": false,
      "description": "每页数量",
      "default": 20,
      "validation": { "min": 1, "max": 100 }
    }
  ],
  "response": {
    "type": "json",
    "extractors": [
      {
        "name": "product_ids",
        "path": "$.data.items[*].id",
        "description": "所有商品的ID列表"
      },
      {
        "name": "total",
        "path": "$.data.total",
        "description": "总商品数"
      }
    ]
  },
  "meta": {
    "category": "商品管理",
    "tags": ["查询", "商品"],
    "riskLevel": "safe",
    "requireConfirm": false
  },
  "binding": {
    "hostPatterns": ["*.merchant.example.com"]
  }
}
```

#### 免审更新 Skill

```json
{
  "id": "product_update_no_review",
  "name": "免审更新",
  "description": "通过商品ID修改商品的库存、价格、售卖时间等信息，修改后不需要经过审核流程即可生效。适用于紧急调整或批量更新场景。",
  "version": "1.0.0",
  "api": {
    "method": "POST",
    "path": "/api/v1/products/{item_id}/quick-update",
    "timeout": 15000
  },
  "parameters": [
    {
      "name": "item_id",
      "type": "string",
      "location": "path",
      "required": true,
      "description": "商品ID"
    },
    {
      "name": "stock",
      "type": "number",
      "location": "body",
      "required": false,
      "description": "库存数量"
    },
    {
      "name": "price",
      "type": "number",
      "location": "body",
      "required": false,
      "description": "商品价格（单位：分）"
    },
    {
      "name": "sale_start_time",
      "type": "string",
      "location": "body",
      "required": false,
      "description": "售卖开始时间，格式：YYYY-MM-DD HH:mm:ss"
    },
    {
      "name": "sale_end_time",
      "type": "string",
      "location": "body",
      "required": false,
      "description": "售卖结束时间，格式：YYYY-MM-DD HH:mm:ss"
    }
  ],
  "response": {
    "type": "json",
    "extractors": [
      {
        "name": "success",
        "path": "$.code",
        "description": "响应码，0表示成功"
      }
    ]
  },
  "meta": {
    "category": "商品管理",
    "tags": ["更新", "商品", "免审"],
    "riskLevel": "moderate",
    "requireConfirm": true,
    "rateLimit": {
      "maxCalls": 50,
      "windowMs": 60000
    }
  },
  "binding": {
    "hostPatterns": ["*.merchant.example.com"]
  }
}
```

### 5.5 Skill → OpenAI Tool 转换

Skill 定义需要在运行时转换为 OpenAI Function Calling 的 Tool 格式：

```typescript
function skillToOpenAITool(skill: SkillDefinition): OpenAI.ChatCompletionTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of skill.parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
    };
    if (param.enum) properties[param.name].enum = param.enum;
    if (param.validation?.min !== undefined)
      properties[param.name].minimum = param.validation.min;
    if (param.validation?.max !== undefined)
      properties[param.name].maximum = param.validation.max;
    if (param.required) required.push(param.name);
  }

  return {
    type: "function",
    function: {
      name: skill.id,
      description: skill.description,
      parameters: {
        type: "object",
        properties,
        required,
      },
    },
  };
}
```

### 5.6 Skill 管理功能

#### 5.6.1 Skill 注册与存储

```typescript
class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  // 注册单个 Skill
  async register(skill: SkillDefinition): Promise<void>;

  // 批量导入（JSON 文件 / 从 URL 加载）
  async importBatch(source: File | string): Promise<ImportResult>;

  // 根据当前站点获取匹配的 Skills
  getSkillsForHost(hostname: string): SkillDefinition[];

  // 根据 ID 获取 Skill
  getSkill(id: string): SkillDefinition | undefined;

  // 转换为 OpenAI Tools
  toOpenAITools(hostname: string): OpenAI.ChatCompletionTool[];

  // 导出所有 Skills
  async exportAll(): Promise<string>;

  // 删除 Skill
  async remove(id: string): Promise<void>;

  // Skill 持久化（chrome.storage）
  private async persist(): Promise<void>;
  private async restore(): Promise<void>;
}
```

#### 5.6.2 批量导入

支持以下导入方式：

1. **JSON 文件导入**：上传包含 Skill 数组的 JSON 文件
2. **URL 导入**：从远程地址加载 Skill 定义（支持团队共享）
3. **模板导入**：从预设模板库选择（针对常见平台如电商后台）
4. **HAR 文件解析**：从浏览器导出的 HAR 网络日志中自动提取 API 定义

---

## 6. AI Agent 引擎设计

### 6.1 Agent 执行流程

> **核心原则：每次 API 调用前必须经过用户确认。** AI 不会自动执行任何请求，而是先向用户展示完整的调用计划（接口名、URL、参数），等待用户确认后才真正发起请求。

```
用户输入自然语言指令
        │
        ▼
┌──────────────────┐
│  构建 System     │ ◄─── Skill 列表转换为 Tools
│  Prompt          │ ◄─── 当前站点信息
│                  │ ◄─── 对话历史
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  调用 LLM        │ ──► 模型返回 Tool Calls
│  (OpenAI API)    │     或文本响应
└────────┬─────────┘
         │
    ┌────┴────┐
    │ 有 Tool  │
    │ Calls?  │
    └────┬────┘
    Yes  │  No
    │    │   └──► 直接输出文本给用户
    ▼
┌──────────────────┐
│ 解析 Tool Calls  │
│ 匹配 Skill 定义  │
│ 组装 HTTP 请求   │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  ★ 强制用户确认 (Mandatory Confirmation)     │
│                                              │
│  向用户展示：                                 │
│  - 接口名称 + 描述                            │
│  - 请求方法 + 完整 URL                        │
│  - 所有参数及其值                              │
│  - 风险等级                                   │
│                                              │
│  等待用户回复 "是" / 点击确认按钮               │
└────────┬────────────────────────────────────┘
         │
    ┌────┴────┐
    │ 用户    │
    │ 确认?   │
    └────┬────┘
    Yes  │  No
    │    │   └──► 告知 AI 用户拒绝，AI 可询问原因或调整方案
    ▼
┌──────────────────┐
│  发送消息到      │
│  Content Script  │ ──► EXECUTE_API
│  执行 fetch()    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  收集响应        │
│  应用 Extractors │ ──► 提取关键数据
│  压缩信息       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  将结果作为 Tool │
│  Result 回传 LLM │ ──► LLM 判断是否需要更多调用
└────────┬─────────┘
         │
         ▼
    ┌────┴────┐
    │ 任务    │
    │ 完成?   │──No──► 返回 "调用 LLM" 步骤（下次调用仍需确认）
    └────┬────┘
    Yes  │
         ▼
   输出最终结果给用户
```

### 6.2 Agent Engine 核心类

```typescript
class AgentEngine {
  private openai: OpenAI;
  private skillRegistry: SkillRegistry;
  private conversationHistory: ChatMessage[];
  private currentExecution: TaskExecution | null;

  constructor(config: AgentConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL, // 支持自定义 endpoint
      dangerouslyAllowBrowser: true, // 浏览器环境必需
    });
  }

  // 处理用户输入
  async processUserMessage(
    message: string,
    hostname: string,
    options?: ProcessOptions,
  ): AsyncGenerator<AgentEvent> {
    // 1. 获取当前站点的 Skills 并转换为 Tools
    const tools = this.skillRegistry.toOpenAITools(hostname);

    // 2. 构建消息列表
    const messages = this.buildMessages(message);

    // 3. 进入 Agent Loop
    yield * this.agentLoop(messages, tools);
  }

  // Agent 循环
  private async *agentLoop(
    messages: ChatMessage[],
    tools: OpenAI.ChatCompletionTool[],
  ): AsyncGenerator<AgentEvent> {
    const MAX_ITERATIONS = 10; // 防止无限循环

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // 调用 LLM
      yield { type: "llm_call_start" };

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        stream: true,
      });

      // 处理流式响应
      const result = await this.handleStreamResponse(response);

      if (!result.toolCalls || result.toolCalls.length === 0) {
        // 没有 Tool Calls，输出文本
        yield { type: "assistant_message", content: result.content };
        break;
      }

      // 执行 Tool Calls
      for (const toolCall of result.toolCalls) {
        yield { type: "tool_call_start", toolCall };

        const toolResult = await this.executeToolCall(toolCall);

        yield { type: "tool_call_result", toolCall, result: toolResult };

        // 将结果加入消息历史
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }
  }

  // 执行单个 Tool Call（强制用户确认）
  private async executeToolCall(toolCall: ToolCall): Promise<ToolCallResult> {
    const skill = this.skillRegistry.getSkill(toolCall.function.name);
    if (!skill) {
      return {
        success: false,
        error: `Skill "${toolCall.function.name}" not found`,
      };
    }

    // 解析参数
    const args = JSON.parse(toolCall.function.arguments);

    // 构建 HTTP 请求
    const request = this.buildHttpRequest(skill, args);

    // ★ 强制用户确认 —— 所有 API 调用都必须经过确认
    const confirmPayload: ConfirmationRequest = {
      skillId: skill.id,
      skillName: skill.name,
      skillDescription: skill.description,
      method: request.method,
      url: request.url,
      parameters: args,
      riskLevel: skill.meta.riskLevel || "safe",
      headers: request.headers,
      body: request.body,
    };

    const confirmed = await this.requestUserConfirmation(confirmPayload);
    if (!confirmed) {
      return {
        success: false,
        error:
          "User declined this API call. Ask user for guidance on how to proceed.",
      };
    }

    // 用户确认后，通过 Content Script 执行请求
    const response = await this.sendToContentScript(request);

    // 应用响应提取器
    const extracted = this.applyExtractors(response, skill.response.extractors);

    return { success: true, data: extracted };
  }
}
```

### 6.3 System Prompt 设计

```typescript
function buildSystemPrompt(
  hostname: string,
  skills: SkillDefinition[],
): string {
  return `你是一个智能 API 助手，运行在 ${hostname} 的浏览器环境中。

## 你的能力
你可以通过 Tool Calling 调用以下 API 接口来完成用户的指令：
${skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n")}

## 执行规则
1. 分析用户的意图，选择合适的接口调用
2. 如果需要分步骤执行（如先查询再更新），请按照逻辑顺序逐步调用
3. 如果需要批量操作，先查询获取完整列表，再逐个/批量执行更新
4. 对于分页接口，注意检查是否有更多数据需要翻页获取
5. 每次操作完成后，汇总结果向用户报告

## 确认规则（最高优先级）
1. **每次调用接口前，系统会自动向用户展示接口名称、URL、所有参数，等待用户确认后才执行**
2. 你不需要自己向用户请求确认，系统会自动处理确认流程
3. 如果用户拒绝了某次调用，你应该询问用户原因，并根据反馈调整参数或更换方案

## 安全规则
1. 对于修改类操作，在展示确认信息时需额外说明操作的影响范围
2. 批量操作超过 20 条时，建议先执行小批量测试
3. 不要猜测参数值，如果信息不足请向用户确认

## 响应格式
- 使用中文回复
- 执行过程中实时汇报进度
- 最终结果以结构化方式呈现（使用表格或列表）
`;
}
```

### 6.4 多步骤任务编排

对于复杂任务，AI Agent 需要支持多步骤编排。以「批量更新类目 123 的商品售卖时间」为例，实际执行过程为：

```
Step 1: 调用 product_query(category_id=123, page=1, page_size=100)
        ├─ 获取 total=256, product_ids=[101,102,...,200]

Step 2: 调用 product_query(category_id=123, page=2, page_size=100)
        ├─ 获取 product_ids=[201,202,...,300]

Step 3: 调用 product_query(category_id=123, page=3, page_size=100)
        ├─ 获取 product_ids=[301,302,...,356]

Step 4~259: 循环调用 product_update_no_review(item_id=xxx, sale_start_time="2025-12-12 00:00:00")
            ├─ 逐个汇报进度: "已更新 50/256..."

Final: 汇总结果
       ├─ 成功: 250
       ├─ 失败: 6 (附失败商品ID和原因)
```

LLM 的 Function Calling 天然支持这种多步骤调用——每次 Tool Call 的结果会反馈给 LLM，LLM 根据返回数据决定下一步操作。

#### 批量操作的确认优化

逐条确认 256 次会严重影响效率，因此批量场景采用**批量确认**策略：

1. **首次批量确认**：AI 展示批量执行计划（接口名、参数模板、总条数），用户一次性确认
2. **执行中免确认**：确认后的循环调用不再逐条弹出确认（参数结构相同，仅 ID 不同）
3. **异常中断确认**：如果某次调用失败或返回异常，暂停执行并请求用户确认是否继续
4. **随时可暂停**：用户可在任意时刻暂停批量执行，查看进度后决定继续或终止

```typescript
interface BatchConfirmationRequest {
  skillId: string;
  skillName: string;
  method: string;
  urlTemplate: string; // 如 "/api/v1/products/{item_id}/quick-update"
  parameterTemplate: Record<string, unknown>; // 参数模板
  varyingField: string; // 每次变化的字段名，如 "item_id"
  varyingValues: unknown[]; // 所有变化值的列表
  totalCount: number; // 总执行次数
  riskLevel: string;
}
```

---

## 7. 请求代理层设计

### 7.1 Content Script 增强设计

当前的 Content Script 是一个基础实现，需要增强以下能力：

```typescript
// src/content/main.tsx — 增强版

// ============ 请求执行器 ============
class RequestExecutor {
  private pendingRequests: Map<string, AbortController> = new Map();

  async execute(payload: ExecuteAPIPayload): Promise<APIResponse> {
    const { method, url, body, headers, timeout = 30000, requestId } = payload;

    // 创建 AbortController 用于超时和取消
    const controller = new AbortController();
    if (requestId) {
      this.pendingRequests.set(requestId, controller);
    }

    // 超时处理
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 自动检测并附加 CSRF Token
      const csrfToken = this.getCSRFToken();
      const finalHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers,
      };
      if (csrfToken) {
        finalHeaders["X-CSRF-Token"] = csrfToken;
      }

      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: method !== "GET" && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: "include", // 确保携带 Cookie
      });

      const contentType = response.headers.get("content-type");
      let data: unknown;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else if (contentType?.includes("text/")) {
        data = { text: await response.text() };
      } else {
        data = { blob: true, size: response.headers.get("content-length") };
      }

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request timed out or was cancelled" };
      }
      return { success: false, error: error.message };
    } finally {
      clearTimeout(timeoutId);
      if (requestId) {
        this.pendingRequests.delete(requestId);
      }
    }
  }

  // 取消请求
  cancel(requestId: string): void {
    const controller = this.pendingRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(requestId);
    }
  }

  // 自动获取 CSRF Token
  private getCSRFToken(): string | null {
    // 尝试从 meta 标签获取
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute("content");

    // 尝试从 Cookie 获取
    const match = document.cookie.match(/(?:^|;\s*)csrf[_-]?token=([^;]+)/i);
    if (match) return decodeURIComponent(match[1]);

    return null;
  }
}

// ============ 页面信息收集器 ============
class PageInfoCollector {
  getPageInfo() {
    return {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      cookies: document.cookie, // 受 HttpOnly 限制
    };
  }
}

// ============ 消息监听器 ============
const executor = new RequestExecutor();
const collector = new PageInfoCollector();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.type) {
    case "EXECUTE_API":
      executor
        .execute(request.payload)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "CANCEL_REQUEST":
      executor.cancel(request.payload.requestId);
      sendResponse({ success: true });
      return false;

    case "GET_PAGE_INFO":
      sendResponse(collector.getPageInfo());
      return false;

    case "PING":
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return false;
  }
});
```

### 7.2 请求参数组装

Skill 定义中的参数需要根据 `location` 字段组装到 HTTP 请求的不同位置：

```typescript
function buildHttpRequest(
  skill: SkillDefinition,
  args: Record<string, unknown>,
): ExecuteAPIPayload {
  let url = skill.api.path;
  const queryParams: URLSearchParams = new URLSearchParams();
  const bodyParams: Record<string, unknown> = {};
  const headerParams: Record<string, string> = { ...skill.api.headers };

  for (const param of skill.parameters) {
    const value = args[param.name] ?? param.default;
    if (value === undefined) continue;

    switch (param.location) {
      case "path":
        url = url.replace(`{${param.name}}`, encodeURIComponent(String(value)));
        break;
      case "query":
        queryParams.set(param.name, String(value));
        break;
      case "body":
        bodyParams[param.name] = value;
        break;
      case "header":
        headerParams[param.name] = String(value);
        break;
    }
  }

  // 拼接 baseUrl
  const baseUrl = skill.api.baseUrl || "";
  const queryString = queryParams.toString();
  const fullUrl = `${baseUrl}${url}${queryString ? "?" + queryString : ""}`;

  return {
    method: skill.api.method,
    url: fullUrl,
    body: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
    headers: headerParams,
    timeout: skill.api.timeout,
  };
}
```

### 7.3 批量执行引擎

对于需要循环调用的场景（如批量更新），需要一个专门的执行引擎：

```typescript
class BatchExecutor {
  private concurrency: number = 3; // 并发数
  private delayMs: number = 200; // 请求间隔

  async executeBatch(
    items: unknown[],
    executeFn: (item: unknown) => Promise<ToolCallResult>,
    onProgress: (progress: BatchProgress) => void,
  ): Promise<BatchResult> {
    const results: BatchResult = {
      total: items.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // 分批并发执行
    for (let i = 0; i < items.length; i += this.concurrency) {
      const batch = items.slice(i, i + this.concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((item) => executeFn(item)),
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled" && result.value.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            item: batch[j],
            error:
              result.status === "rejected"
                ? result.reason.message
                : result.value.error,
          });
        }
      }

      // 进度回调
      onProgress({
        completed: Math.min(i + this.concurrency, items.length),
        total: items.length,
        successCount: results.success,
        failedCount: results.failed,
      });

      // 请求间隔
      if (i + this.concurrency < items.length) {
        await new Promise((r) => setTimeout(r, this.delayMs));
      }
    }

    return results;
  }
}
```

---

## 8. 前端 UI 设计

### 8.1 当前 UI 结构分析

当前项目的 Popup UI 采用左侧导航 + 右侧内容的布局：

```
┌──────────────────────────────────────────────┐
│  ┌────────┐  ┌──────────────────────────────┐│
│  │ 能力 ◄─┤  │                              ││
│  │ 会话   │  │   内容区域                    ││
│  │ 模型   │  │   (120 x 100 单位)           ││
│  │ 频道   │  │                              ││
│  │ 关于   │  │                              ││
│  │        │  │                              ││
│  └────────┘  └──────────────────────────────┘│
└──────────────────────────────────────────────┘
```

现有 5 个 Tab 页面：

| Tab  | 组件           | 当前状态              | 预期功能               |
| ---- | -------------- | --------------------- | ---------------------- |
| 能力 | `<Skills />`   | ✅ 已实现列表 + Modal | Skill CRUD + 批量导入  |
| 会话 | `<Chat />`     | ⬜ 仅占位             | AI 对话 + 任务执行面板 |
| 模型 | `<Models />`   | ⬜ 仅占位             | LLM 模型配置           |
| 频道 | `<Channels />` | ⬜ 仅占位             | 站点频道管理           |
| 关于 | `<FAQ />`      | ⬜ 仅占位             | 使用说明 + FAQ         |

### 8.2 UI 组件设计规划

#### 8.2.1 Skills Panel（能力管理）

```
┌──────────────────────────────────────────┐
│  当前网站可以使用的能力    [批量导入]       │
├──────────────────────────────────────────┤
│  🔍 搜索 Skills...                       │
├──────────────────────────────────────────┤
│  📦 商品详情查询               [详情][▶]  │
│  查询商品详细信息...                      │
├──────────────────────────────────────────┤
│  ✏️ 免审更新                   [详情][▶]  │
│  通过 itemid 修改商品...                  │
├──────────────────────────────────────────┤
│  📋 订单查询                   [详情][▶]  │
│  根据订单号或用户ID查询...                │
├──────────────────────────────────────────┤
│                                          │
│      [+ 新增 Skill]                      │
│                                          │
└──────────────────────────────────────────┘
```

**功能清单**：

- Skill 列表展示（带搜索过滤）
- Skill 详情弹窗（完整参数定义预览）
- Skill 新增/编辑表单
- Skill 删除（二次确认）
- 批量导入（JSON 文件 / URL）
- 批量导出
- Skill 快速测试（在详情弹窗中直接填参数试调）
- 站点匹配状态指示（当前站点是否匹配）

#### 8.2.2 Chat Panel（对话面板 — 核心交互）

```
┌──────────────────────────────────────────┐
│  💬 AI 助手              [清除] [导出]    │
├──────────────────────────────────────────┤
│                                          │
│  👤 帮我把类目为123的商品售卖时间用免     │
│     审更新更新为2025年12月12日            │
│                                          │
│  🤖 好的，我来帮你完成这个任务。          │
│     首先，我需要查询类目123下的所有商品。 │
│                                          │
│     ┌──────────────────────────────────┐ │
│     │ ⚠️ 确认调用以下接口？             │ │
│     │                                  │ │
│     │ 📡 接口: 商品详情查询             │ │
│     │ 📝 说明: 查询商品详细信息         │ │
│     │ 🔗 GET /api/v1/products          │ │
│     │ 📋 参数:                          │ │
│     │    category_id = 123             │ │
│     │    page = 1                      │ │
│     │    page_size = 100               │ │
│     │ 🟢 风险等级: safe                 │ │
│     │                                  │ │
│     │   [✅ 确认执行]  [❌ 拒绝]        │ │
│     └──────────────────────────────────┘ │
│                                          │
│  👤 是                                   │
│                                          │
│     ┌──────────────────────────────────┐ │
│     │ 📡 调用: 商品详情查询             │ │
│     │ 状态: ✅ 完成 (共 256 个商品)     │ │
│     └──────────────────────────────────┘ │
│                                          │
│  🤖 查询到 256 个商品，开始批量更新。    │
│                                          │
│     ┌──────────────────────────────────┐ │
│     │ ⚠️ 确认批量调用以下接口？         │ │
│     │                                  │ │
│     │ 📡 接口: 免审更新                 │ │
│     │ 📝 说明: 修改商品库存、价格、售卖 │ │
│     │         时间，无需审核            │ │
│     │ 🔗 POST /api/v1/products/{item_  │ │
│     │    id}/quick-update              │ │
│     │ 📋 参数模板:                      │ │
│     │    sale_start_time =             │ │
│     │    "2025-12-12 00:00:00"         │ │
│     │ 🔄 变化字段: item_id             │ │
│     │ 📊 总计: 256 条                   │ │
│     │ 🟡 风险等级: moderate             │ │
│     │                                  │ │
│     │   [✅ 确认执行]  [❌ 拒绝]        │ │
│     └──────────────────────────────────┘ │
│                                          │
│  👤 是                                   │
│                                          │
│     ┌──────────────────────────────────┐ │
│     │ 📡 批量执行: 免审更新             │ │
│     │ ████████████████░░░░ 200/256     │ │
│     │ ✅ 成功: 195  ❌ 失败: 5          │ │
│     └──────────────────────────────────┘ │
│                                          │
│  🤖 批量更新完成！                       │
│     - 总计: 256 个商品                   │
│     - 成功: 251                          │
│     - 失败: 5 (商品ID: xxx, 原因: ...)   │
│                                          │
├──────────────────────────────────────────┤
│  [📎] 输入指令...                [发送]  │
└──────────────────────────────────────────┘
```

**Chat 组件结构**：

```typescript
// 消息类型
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: ToolCallDisplay[]; // 关联的 Tool 调用信息
  status?: "pending" | "streaming" | "done" | "error";
}

// Tool 调用展示信息
interface ToolCallDisplay {
  skillName: string;
  skillId: string;
  arguments: Record<string, unknown>;
  status:
    | "pending_confirmation"
    | "confirmed"
    | "rejected"
    | "executing"
    | "success"
    | "error";
  result?: unknown;
  error?: string;
  duration?: number;

  // 确认相关
  confirmation?: {
    method: string;
    url: string;
    parameters: Record<string, unknown>;
    riskLevel: "safe" | "moderate" | "dangerous";
    description: string;
    confirmedAt?: number; // 用户确认时间
    rejectedAt?: number; // 用户拒绝时间
  };

  // 批量执行进度
  batchProgress?: {
    total: number;
    completed: number;
    success: number;
    failed: number;
  };
}
```

#### 8.2.3 Models Panel（模型配置）

```
┌──────────────────────────────────────────┐
│  🧠 模型配置                              │
├──────────────────────────────────────────┤
│                                          │
│  API Provider                            │
│  ┌──────────────────────────────────┐    │
│  │ OpenAI Compatible         ▼     │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Base URL                                │
│  ┌──────────────────────────────────┐    │
│  │ https://api.openai.com/v1       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  API Key                                 │
│  ┌──────────────────────────────────┐    │
│  │ sk-••••••••••••••••••••         │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Model                                   │
│  ┌──────────────────────────────────┐    │
│  │ gpt-4o                    ▼     │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Temperature                    [0.2]    │
│  ━━━━━━━━●━━━━━━━━━━━━━━━━━━━━         │
│                                          │
│  Max Tokens                     [4096]   │
│  ━━━━━━━━━━━━━━━━●━━━━━━━━━━━          │
│                                          │
│  [保存配置]        [测试连接]             │
│                                          │
└──────────────────────────────────────────┘
```

**支持的模型提供商**：

| Provider     | Base URL                              | 说明                                    |
| ------------ | ------------------------------------- | --------------------------------------- |
| OpenAI       | `https://api.openai.com/v1`           | 官方 API                                |
| Azure OpenAI | `https://{name}.openai.azure.com/...` | Azure 部署                              |
| 自定义兼容   | 用户自定义                            | 任何 OpenAI 兼容 API（如 Ollama、vLLM） |

#### 8.2.4 Channels Panel（频道管理）

「频道」的概念是将 Skills 按站点分组管理：

```
┌──────────────────────────────────────────┐
│  📡 频道管理                 [+ 新增频道]  │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐│
│  │ 🟢 商家后台                          ││
│  │ *.merchant.example.com              ││
│  │ 8 个 Skills | 上次使用: 2小时前       ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ 🔵 运营平台                          ││
│  │ ops.example.com                     ││
│  │ 5 个 Skills | 上次使用: 昨天          ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ ⚪ CMS 内容管理                      ││
│  │ cms.example.com                     ││
│  │ 3 个 Skills | 从未使用               ││
│  └──────────────────────────────────────┘│
│                                          │
│  💡 当前站点: *.merchant.example.com     │
│     自动匹配到「商家后台」频道            │
│                                          │
└──────────────────────────────────────────┘
```

**频道定义**：

```typescript
interface Channel {
  id: string;
  name: string; // 频道名称
  description?: string;
  hostPatterns: string[]; // 匹配的站点 Pattern
  skillIds: string[]; // 关联的 Skill ID 列表
  color?: string; // 标识颜色
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}
```

#### 8.2.5 FAQ Panel（关于 & FAQ）

```
┌──────────────────────────────────────────┐
│  ℹ️ 关于 Browser Claw       │
├──────────────────────────────────────────┤
│                                          │
│  版本: v1.0.0                            │
│                                          │
│  📖 快速开始                              │
│  ┌──────────────────────────────────────┐│
│  │ 1. 配置模型 API Key                   ││
│  │ 2. 创建或导入 Skills                  ││
│  │ 3. 在目标网站打开插件                  ││
│  │ 4. 用自然语言下达指令                  ││
│  └──────────────────────────────────────┘│
│                                          │
│  ❓ 常见问题                              │
│  ▶ 为什么请求返回 401？                   │
│  ▶ 如何添加自定义请求头？                 │
│  ▶ 批量操作的并发数如何控制？              │
│  ▶ 如何导出 Skill 模板给团队？            │
│                                          │
│  📫 反馈与建议                            │
│  [GitHub Issues] [文档]                  │
│                                          │
└──────────────────────────────────────────┘
```

### 8.3 推荐 UI 升级：Side Panel 模式

Popup 的宽高限制（约 800×600px）对复杂交互不友好。建议引入 **Chrome Side Panel API**，在浏览器侧边栏打开完整面板：

**manifest 配置**：

```json
{
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "permissions": ["sidePanel"]
}
```

Side Panel 的优势：

- 不会因为用户点击页面其他区域而关闭
- 占据整个浏览器侧边高度，空间更充裕
- 可以持续显示任务执行进度
- 与页面并排显示，便于用户对比验证结果

---

## 9. 数据流与状态管理

### 9.1 数据流架构

```
                          ┌────────────────────┐
                          │  chrome.storage    │
                          │  (持久化)           │
                          │                    │
                          │  - Skills 定义     │
                          │  - 模型配置        │
                          │  - 频道配置        │
                          │  - 对话历史        │
                          └─────────┬──────────┘
                                    │
                          ┌─────────┴──────────┐
                          │    Store Layer     │
                          │                    │
                          │  ┌──────────────┐  │
                          │  │ SkillStore   │  │
                          │  │ ModelStore   │  │
                          │  │ ChatStore    │  │
                          │  │ ChannelStore │  │
                          │  └──────────────┘  │
                          └─────────┬──────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
         ┌──────┴─────┐    ┌───────┴──────┐    ┌───────┴──────┐
         │ Skills UI  │    │  Chat UI     │    │ Models UI    │
         └────────────┘    └──────────────┘    └──────────────┘
```

### 9.2 状态管理方案

推荐使用 **React Context + useReducer** 的轻量方案（无需引入 Redux 等重量级库），配合 `chrome.storage` 实现持久化：

```typescript
// === Store Hook 模式 ===

// Skills Store
interface SkillsState {
  skills: SkillDefinition[];
  loading: boolean;
  currentHost: string | null;
  filteredSkills: SkillDefinition[];
}

function useSkillsStore() {
  const [state, dispatch] = useReducer(skillsReducer, initialSkillsState);

  useEffect(() => {
    // 从 chrome.storage 恢复
    chrome.storage.local.get("skills", (result) => {
      if (result.skills) {
        dispatch({ type: "LOAD_SKILLS", payload: result.skills });
      }
    });
  }, []);

  const addSkill = useCallback(
    async (skill: SkillDefinition) => {
      dispatch({ type: "ADD_SKILL", payload: skill });
      // 同步到 chrome.storage
      const skills = [...state.skills, skill];
      await chrome.storage.local.set({ skills });
    },
    [state.skills],
  );

  // ... 更多方法

  return { state, addSkill, removeSkill, importSkills, exportSkills };
}
```

### 9.3 chrome.storage 数据结构

```typescript
// chrome.storage.local 存储的完整数据结构
interface StorageSchema {
  // Skill 定义列表
  skills: SkillDefinition[];

  // 模型配置
  modelConfig: {
    provider: "openai" | "azure" | "custom";
    baseURL: string;
    apiKey: string; // 加密存储
    model: string;
    temperature: number;
    maxTokens: number;
  };

  // 频道配置
  channels: Channel[];

  // 对话历史（按频道分组）
  chatHistory: Record<string, ChatMessage[]>;

  // 用户偏好
  preferences: {
    theme: "light" | "dark" | "auto";
    language: "zh-CN" | "en-US";
    batchConcurrency: number;
    batchDelay: number;
    autoConfirmSafeOps: boolean;
  };
}
```

---

## 10. 频道系统设计

### 10.1 频道概念

频道（Channel）是对 Skills 按站点进行逻辑分组的机制。核心解决以下问题：

1. **隔离**：不同站点的 Skills 互不干扰
2. **自动匹配**：打开某站点时自动加载对应频道的 Skills
3. **共享**：同一频道可以被团队成员共享

### 10.2 频道匹配策略

```typescript
class ChannelMatcher {
  // 根据当前 URL 匹配频道
  match(url: string, channels: Channel[]): Channel | null {
    const hostname = new URL(url).hostname;

    for (const channel of channels) {
      for (const pattern of channel.hostPatterns) {
        if (this.matchPattern(hostname, pattern)) {
          return channel;
        }
      }
    }
    return null;
  }

  // 支持通配符的 Pattern 匹配
  private matchPattern(hostname: string, pattern: string): boolean {
    const regex = pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+");
    return new RegExp(`^${regex}$`).test(hostname);
  }
}
```

### 10.3 频道导入导出

```typescript
// 频道导出格式（可用于团队共享）
interface ChannelExport {
  version: string;
  channel: Channel;
  skills: SkillDefinition[]; // 频道关联的所有 Skills
  exportedAt: string;
  exportedBy?: string;
}
```

---

## 11. 安全性设计

### 11.1 威胁模型

| 威胁                          | 风险等级 | 缓解措施                                          |
| ----------------------------- | -------- | ------------------------------------------------- |
| API Key 泄露                  | 高       | 使用 chrome.storage 加密存储，不在页面 DOM 中暴露 |
| 恶意 Skill 注入               | 高       | Skill 导入时进行 Schema 校验，限制 URL Pattern    |
| XSS 攻击（通过 AI 输出）      | 中       | AI 输出在渲染前进行 HTML 转义                     |
| CSRF Token 外泄               | 中       | Token 仅在 Content Script 内使用，不传递到外部    |
| 批量操作误伤                  | 中       | 高风险操作需用户确认，批量操作增加预览步骤        |
| Content Script 被恶意页面利用 | 低       | 仅响应来自扩展内部的消息（验证 sender）           |

### 11.2 API Key 安全存储

```typescript
// 简单的加密存储方案
class SecureStorage {
  private static ENCRYPTION_KEY = "crx-agent-v1"; // 实际应使用更安全的密钥

  static async setApiKey(key: string): Promise<void> {
    const encoded = btoa(key); // 基础编码，生产环境建议使用 Web Crypto API
    await chrome.storage.local.set({ _apiKey: encoded });
  }

  static async getApiKey(): Promise<string | null> {
    const result = await chrome.storage.local.get("_apiKey");
    if (!result._apiKey) return null;
    return atob(result._apiKey);
  }
}
```

### 11.3 Skill 安全校验

```typescript
function validateSkill(skill: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Schema 校验
  if (!isValidSkillSchema(skill)) {
    errors.push("Invalid Skill schema");
  }

  // 2. URL 安全检查
  const s = skill as SkillDefinition;
  if (s.api.baseUrl && !s.api.baseUrl.startsWith("https://")) {
    errors.push("baseUrl must use HTTPS");
  }

  // 3. 路径注入检查
  if (s.api.path.includes("..") || s.api.path.includes("//")) {
    errors.push("Suspicious path pattern detected");
  }

  // 4. Host Pattern 校验
  for (const pattern of s.binding.hostPatterns) {
    if (pattern === "*" || pattern === "*.*") {
      errors.push("Host pattern too broad");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### 11.4 强制确认机制（Mandatory Confirmation）

> **这是 Browser Claw 的核心安全策略：所有 API 调用均需用户确认后才会执行，无一例外。**

```typescript
// ★ 确认请求数据结构
interface ConfirmationRequest {
  skillId: string;
  skillName: string;
  skillDescription: string;
  method: string;
  url: string;
  parameters: Record<string, unknown>;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  headers?: Record<string, string>;
  body?: unknown;

  // 批量操作专属
  isBatch?: boolean;
  batchCount?: number;
  parameterTemplate?: Record<string, unknown>;
  varyingField?: string;
}

// ★ 所有 API 调用前的强制确认
async function requestUserConfirmation(
  request: ConfirmationRequest
): Promise<boolean> {
  return new Promise((resolve) => {
    // 构建确认卡片内容
    const confirmCard: ConfirmationCardData = {
      title: `即将调用「${request.skillName}」`,
      description: request.skillDescription,
      method: request.method,
      url: request.url,
      parameters: request.parameters,
      riskLevel: request.riskLevel,
      isBatch: request.isBatch,
      batchCount: request.batchCount,
    };

    // 在 Chat UI 中渲染确认卡片，等待用户操作
    // 用户可以：
    //   1. 点击「确认执行」按钮 → resolve(true)
    //   2. 点击「拒绝」按钮 → resolve(false)
    //   3. 在输入框中输入 "是" / "确认" / "yes" → resolve(true)
    //   4. 在输入框中输入 "否" / "拒绝" / "no" → resolve(false)
    showConfirmationCard(confirmCard, resolve);
  });
}

// ★ 确认卡片 React 组件
interface ConfirmationCardProps {
  data: ConfirmationCardData;
  onConfirm: () => void;
  onReject: () => void;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ data, onConfirm, onReject }) => {
  const riskColors = {
    safe: 'badge-success',
    moderate: 'badge-warning',
    dangerous: 'badge-error',
  };

  return (
    <div className="card bg-base-200 shadow-sm my-2">
      <div className="card-body p-4">
        <h3 className="card-title text-sm">
          ⚠️ {data.title}
        </h3>
        <p className="text-xs opacity-70">{data.description}</p>

        <div className="bg-base-300 rounded p-2 text-xs font-mono">
          <div><span className="font-bold">{data.method}</span> {data.url}</div>
          <div className="mt-1 text-xs">
            {Object.entries(data.parameters).map(([key, val]) => (
              <div key={key}>  {key} = {JSON.stringify(val)}</div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className={\`badge badge-sm \${riskColors[data.riskLevel]}\`}>
            {data.riskLevel}
          </span>
          {data.isBatch && (
            <span className="badge badge-sm badge-info">
              批量 {data.batchCount} 条
            </span>
          )}
        </div>

        <div className="card-actions justify-end mt-2">
          <button className="btn btn-sm btn-error btn-outline" onClick={onReject}>
            ❌ 拒绝
          </button>
          <button className="btn btn-sm btn-success" onClick={onConfirm}>
            ✅ 确认执行
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### 确认状态流转

```
                          用户确认
  Tool Call 生成 ──► 待确认 ────────► 执行中 ──► 成功/失败
       │            (pending_       (executing)
       │            confirmation)
       │                │
       │                │ 用户拒绝
       │                └────────► 已拒绝 ──► 结果回传 AI
       │                          (rejected)   (AI 调整方案)
```

---

## 12. 错误处理与容错机制

### 12.1 错误分类

| 错误类型                | 说明                  | 处理策略                        |
| ----------------------- | --------------------- | ------------------------------- |
| **网络错误**            | 请求超时、连接失败    | 自动重试（最多 3 次，指数退避） |
| **HTTP 错误**           | 4xx、5xx 响应         | 返回给 AI 分析错误原因          |
| **认证错误**            | 401/403               | 提示用户重新登录目标站点        |
| **LLM 错误**            | API 限流、Token 超限  | 提示用户，建议等待或切换模型    |
| **参数错误**            | AI 生成了不合法的参数 | 返回校验错误给 AI 重新生成      |
| **Content Script 断开** | 页面刷新导致 CS 丢失  | 自动重新注入                    |

### 12.2 自动重试机制

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {},
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      // 不可重试的错误
      if (
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404
      ) {
        throw error;
      }

      if (attempt === maxRetries) throw error;

      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Unexpected: retry loop exited without return or throw");
}
```

### 12.3 Content Script 连接检测

```typescript
class ContentScriptConnection {
  // 检查 Content Script 是否可用
  static async ping(tabId: number): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "PING" });
      return response?.type === "PONG";
    } catch {
      return false;
    }
  }

  // 如果不可用，尝试重新注入
  static async ensureConnected(tabId: number): Promise<boolean> {
    if (await this.ping(tabId)) return true;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/main.tsx"],
      });
      // 等待注入完成
      await new Promise((r) => setTimeout(r, 500));
      return await this.ping(tabId);
    } catch {
      return false;
    }
  }
}
```

---

## 13. 性能优化策略

### 13.1 Token 优化

LLM API 调用的主要成本是 Token 消耗。优化策略：

1. **响应压缩**：使用 ResponseExtractor 只提取关键字段，而非将完整 API 响应传给 LLM
2. **上下文裁剪**：对话超过 10 轮后，压缩早期消息为摘要
3. **Tool 列表精简**：只传递与当前站点匹配的 Skills 作为 Tools，而非全部
4. **System Prompt 缓存**：相同站点的 System Prompt 可以复用

### 13.2 请求优化

1. **并发控制**：批量操作使用滑动窗口并发（默认 3 个并行）
2. **请求间隔**：避免触发目标站点的限流策略（默认 200ms 间隔）
3. **响应缓存**：查询类接口的响应可短时缓存（如 Skill 标记为 cacheable）
4. **防抖**：用户快速输入时防抖发送

### 13.3 UI 渲染优化

1. **虚拟列表**：大量 Skills 列表使用虚拟滚动
2. **消息流式渲染**：AI 的流式输出实时渲染，不等待完整响应
3. **懒加载 Tab**：非活动 Tab 内容懒加载
4. **Transition**：Tab 切换使用 CSS transition，而非重新挂载

---

## 14. 测试策略

### 14.1 测试金字塔

```
           ┌─────────┐
           │  E2E    │  Chrome Extension 集成测试
           ├─────────┤
          │  集成测试  │  Agent Engine + Skill Registry + Mock LLM
         ├───────────┤
        │  单元测试    │  Skill Schema 校验 / 参数组装 / Extractor
       └──────────────┘
```

### 14.2 关键测试场景

| 场景                     | 测试方法 | 覆盖内容                             |
| ------------------------ | -------- | ------------------------------------ |
| Skill Schema 校验        | 单元测试 | 各种合法/非法 Schema                 |
| HTTP 请求参数组装        | 单元测试 | path/query/body/header 参数          |
| Skill → OpenAI Tool 转换 | 单元测试 | 类型映射、必填字段                   |
| Agent Loop 执行          | 集成测试 | Mock LLM 返回，验证 Tool Call 执行链 |
| Content Script 通信      | E2E      | 真实浏览器环境消息传递               |
| 批量操作                 | 集成测试 | 并发控制、错误处理、进度回调         |

---

## 15. 开发阶段规划与里程碑

### Phase 1: 基础框架 (预计 1-2 周)

**目标**：完善基础架构，跑通核心链路

- [x] 项目脚手架搭建（Vite + React + TypeScript + CRX）
- [x] Popup UI 基础布局
- [x] Content Script 请求代理
- [ ] 添加 Background Service Worker
- [ ] 统一消息协议实现
- [ ] chrome.storage 存储层封装
- [ ] Skill Schema TypeScript 类型定义

### Phase 2: Skill 系统 (预计 1-2 周)

**目标**：完整的 Skill CRUD 和管理功能

- [ ] Skill 新增/编辑表单 UI
- [ ] Skill 删除（带确认）
- [ ] Skill JSON 导入/导出
- [ ] Skill Schema 校验器
- [ ] Skill 详情预览
- [ ] Skill 快速测试功能
- [ ] Skill → OpenAI Tool 转换器

### Phase 3: AI Agent 引擎 (预计 2-3 周)

**目标**：实现 AI 驱动的对话与任务执行

- [ ] Models 配置 UI 与持久化
- [ ] OpenAI SDK 集成
- [ ] Agent Engine 核心循环
- [ ] System Prompt 构建
- [ ] Tool Call 执行链路
- [ ] 响应 Extractor 实现
- [ ] Chat UI 完整实现（消息列表 + 输入框 + Tool 调用卡片）
- [ ] 流式输出支持

### Phase 4: 批量操作 & 增强 (预计 1-2 周)

**目标**：支持复杂的批量操作场景

- [ ] 批量执行引擎
- [ ] 执行进度展示 UI
- [ ] 用户确认机制
- [ ] 自动重试 & 错误处理
- [ ] Content Script 断线重连

### Phase 5: 频道系统 & 高级功能 (预计 1-2 周)

**目标**：频道管理和高级特性

- [ ] 频道 CRUD UI
- [ ] 自动频道匹配
- [ ] 频道导入/导出
- [ ] Side Panel 模式
- [ ] HAR 文件 → Skill 自动提取
- [ ] 对话历史管理

### Phase 6: 打磨 & 发布 (预计 1 周)

**目标**：质量保障和发布准备

- [ ] 完整的 FAQ 文档
- [ ] 单元测试覆盖
- [ ] E2E 测试
- [ ] 性能优化
- [ ] 安全审计
- [ ] 打包发布流程

---

## 16. 当前代码分析与改进建议

### 16.1 代码现状总结

基于对项目源码的全面分析，当前项目处于**早期原型阶段**：

| 维度           | 现状                                     | 评分     |
| -------------- | ---------------------------------------- | -------- |
| 项目结构       | ✅ 基础结构合理，使用 @crxjs/vite-plugin | ⭐⭐⭐⭐ |
| UI 框架        | ✅ React + Tailwind                      | ⭐⭐⭐⭐ |
| Popup 布局     | ✅ 左导航 + 右内容，Tab 切换已实现       | ⭐⭐⭐   |
| Skills 列表    | ✅ 硬编码 Mock 数据 + Modal 弹窗         | ⭐⭐     |
| Chat 功能      | ⬜ 仅占位文字                            | ⭐       |
| Models 配置    | ⬜ 仅占位文字                            | ⭐       |
| Channels       | ⬜ 仅占位文字                            | ⭐       |
| Content Script | ✅ 基础 fetch 代理已实现                 | ⭐⭐⭐   |
| Background SW  | ⬜ 未实现                                | ⭐       |
| AI 集成        | ⬜ openai SDK 已安装但未使用             | ⭐       |
| 类型定义       | ⬜ types/index.ts 为空                   | ⭐       |

### 16.2 具体改进建议

#### 16.2.1 项目结构重组

**当前**：

```
src/
├── components/
│   ├── channels/index.tsx
│   ├── chat/index.tsx
│   ├── FAQ/index.tsx
│   ├── models/index.tsx
│   └── skills/index.tsx
├── content/main.tsx
├── popup/
│   ├── App.tsx
│   ├── index.css
│   ├── index.html
│   └── main.tsx
└── types/index.ts
```

**建议**：

```
src/
├── background/              # 新增：Background Service Worker
│   └── index.ts
├── content/                 # Content Script
│   ├── main.tsx
│   ├── request-executor.ts  # 请求执行器（从 main 中拆分）
│   └── page-info.ts         # 页面信息收集
├── popup/                   # Popup 入口
│   ├── App.tsx
│   ├── index.css
│   ├── index.html
│   └── main.tsx
├── sidepanel/               # 新增：Side Panel 入口（可选）
│   ├── App.tsx
│   ├── index.html
│   └── main.tsx
├── components/              # UI 组件
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ToolCallCard.tsx
│   │   └── ChatInput.tsx
│   ├── skills/
│   │   ├── SkillsList.tsx
│   │   ├── SkillDetail.tsx
│   │   ├── SkillForm.tsx
│   │   └── SkillImport.tsx
│   ├── models/
│   │   └── ModelConfig.tsx
│   ├── channels/
│   │   ├── ChannelList.tsx
│   │   └── ChannelForm.tsx
│   ├── faq/
│   │   └── FAQ.tsx
│   └── shared/              # 共享组件
│       ├── ConfirmDialog.tsx
│       ├── JsonViewer.tsx
│       └── ProgressBar.tsx
├── core/                    # 新增：核心业务逻辑
│   ├── agent-engine.ts      # AI Agent 引擎
│   ├── skill-registry.ts    # Skill 注册与管理
│   ├── skill-converter.ts   # Skill → OpenAI Tool 转换
│   ├── request-builder.ts   # HTTP 请求参数组装
│   ├── batch-executor.ts    # 批量执行引擎
│   ├── response-extractor.ts # 响应数据提取
│   └── channel-matcher.ts   # 频道匹配
├── hooks/                   # 新增：自定义 Hooks
│   ├── useSkills.ts
│   ├── useChat.ts
│   ├── useModel.ts
│   ├── useChannels.ts
│   └── useContentScript.ts
├── utils/                   # 新增：工具函数
│   ├── storage.ts           # chrome.storage 封装
│   ├── messaging.ts         # 消息通信封装
│   ├── validation.ts        # 数据校验
│   ├── security.ts          # 安全相关
│   └── constants.ts         # 常量定义
└── types/                   # 类型定义
    ├── skill.ts
    ├── message.ts
    ├── agent.ts
    ├── channel.ts
    └── index.ts             # 统一导出
```

#### 16.2.2 Skills 组件改进

当前 Skills 列表数据是硬编码的，需要改为从 chrome.storage 动态加载，并支持 CRUD：

```typescript
// 改进前：硬编码数据
const skills = [
  { name: "商品详情", reason: "..." },
  // ...
];

// 改进后：从 Store 加载 + 完整的 SkillDefinition
const Skills = () => {
  const { skills, loading, addSkill, removeSkill } = useSkills();
  const currentHost = useCurrentHost();
  const filteredSkills = skills.filter((s) => matchHost(s, currentHost));
  // ...
};
```

#### 16.2.3 Content Script 改进

当前 Content Script 存在以下问题需要修复：

1. **缺少 sender 验证**：应验证消息来源确实是自己的扩展
2. **缺少超时机制**：长时间请求无法超时
3. **缺少 CSRF Token 自动处理**
4. **缺少请求取消能力**

建议按照第 7 节的增强设计进行重构。

#### 16.2.4 types/index.ts 填充

当前类型文件为空，建议按照附录中的类型定义进行补充。

---

## 17. 附录：关键数据结构定义

### 17.1 完整 TypeScript 类型定义

```typescript
// ============ Skill 相关 ============

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  api: SkillAPI;
  parameters: SkillParameter[];
  response: SkillResponse;
  meta: SkillMeta;
  binding: SkillBinding;
}

export interface SkillAPI {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  location: "path" | "query" | "body" | "header";
  required: boolean;
  description: string;
  default?: unknown;
  enum?: unknown[];
  example?: unknown;
  validation?: ParameterValidation;
  properties?: SkillParameter[];
  items?: Omit<SkillParameter, "name" | "location" | "required">;
}

export interface ParameterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface SkillResponse {
  type: "json" | "text" | "blob";
  schema?: Record<string, unknown>;
  extractors?: ResponseExtractor[];
}

export interface ResponseExtractor {
  name: string;
  path: string;
  description: string;
  transform?: "count" | "first" | "last" | "flatten" | "unique";
}

export interface SkillMeta {
  category?: string;
  tags?: string[];
  riskLevel?: "safe" | "moderate" | "dangerous";
  requireConfirm?: boolean;
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface SkillBinding {
  hostPatterns: string[];
  channelId?: string;
}

// ============ 消息通信 ============

export enum MessageType {
  EXECUTE_API = "EXECUTE_API",
  EXECUTE_API_RESULT = "EXECUTE_API_RESULT",
  EXECUTE_BATCH = "EXECUTE_BATCH",
  BATCH_PROGRESS = "BATCH_PROGRESS",
  CANCEL_REQUEST = "CANCEL_REQUEST",
  GET_PAGE_INFO = "GET_PAGE_INFO",
  SKILL_TEST = "SKILL_TEST",
  PING = "PING",
  PONG = "PONG",
}

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  requestId?: string;
  timestamp?: number;
}

export interface ExecuteAPIPayload {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  requestId?: string;
}

export interface APIResponse {
  success: boolean;
  status?: number;
  statusText?: string;
  data?: unknown;
  headers?: Record<string, string>;
  error?: string;
}

// ============ Agent 引擎 ============

export interface AgentConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ============ 强制确认机制 ============

export interface ConfirmationRequest {
  skillId: string;
  skillName: string;
  skillDescription: string;
  method: string;
  url: string;
  parameters: Record<string, unknown>;
  riskLevel: "safe" | "moderate" | "dangerous";
  headers?: Record<string, string>;
  body?: unknown;
  isBatch?: boolean;
  batchCount?: number;
  parameterTemplate?: Record<string, unknown>;
  varyingField?: string;
}

export interface ConfirmationCardData {
  title: string;
  description: string;
  method: string;
  url: string;
  parameters: Record<string, unknown>;
  riskLevel: "safe" | "moderate" | "dangerous";
  isBatch?: boolean;
  batchCount?: number;
}

export type ConfirmationResult = {
  confirmed: boolean;
  timestamp: number;
  userMessage?: string; // 用户输入的确认/拒绝文本
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCalls?: ToolCallDisplay[];
  status?: "pending" | "streaming" | "done" | "error";
  toolCallId?: string;
}

export interface ToolCallDisplay {
  id: string;
  skillName: string;
  skillId: string;
  arguments: Record<string, unknown>;
  status:
    | "pending_confirmation"
    | "confirmed"
    | "rejected"
    | "executing"
    | "success"
    | "error";
  result?: unknown;
  error?: string;
  duration?: number;
  batchProgress?: BatchProgress;
}

export interface BatchProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    item: unknown;
    error: string;
  }>;
}

export type AgentEvent =
  | { type: "llm_call_start" }
  | { type: "llm_streaming"; content: string }
  | { type: "assistant_message"; content: string }
  | { type: "tool_call_start"; toolCall: ToolCallDisplay }
  | { type: "tool_call_result"; toolCall: ToolCallDisplay; result: unknown }
  | { type: "batch_progress"; progress: BatchProgress }
  | { type: "error"; error: string }
  | { type: "done" };

// ============ 频道 ============

export interface Channel {
  id: string;
  name: string;
  description?: string;
  hostPatterns: string[];
  skillIds: string[];
  color?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

// ============ 存储 ============

export interface StorageSchema {
  skills: SkillDefinition[];
  modelConfig: AgentConfig;
  channels: Channel[];
  chatHistory: Record<string, ChatMessage[]>;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: "light" | "dark" | "auto";
  language: "zh-CN" | "en-US";
  batchConcurrency: number;
  batchDelay: number;
  autoConfirmSafeOps: boolean;
}
```

---

## 结语

Browser Claw 的核心创新在于将 **AI Function Calling** 与 **Chrome Extension Content Script** 结合，实现了"自然语言 → API 调用"的无缝桥接。通过 Skill-as-Document 的设计，用户无需编写代码即可扩展系统能力，AI 则负责理解意图、规划执行步骤、处理结果反馈。

项目当前已完成基础框架搭建，接下来的重点是：

1. **补全 Skill 系统**：让 Skill 从硬编码走向动态管理
2. **实现 Agent 引擎**：打通 LLM → Skill → Content Script 的完整链路
3. **完善 Chat UI**：提供直观的对话和任务执行体验
4. **增强安全性**：确保在生产环境中安全可靠

> 本文档将随项目迭代持续更新。
