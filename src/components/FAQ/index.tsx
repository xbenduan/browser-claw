import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Github,
  Zap,
  Shield,
  Globe,
  MessageSquare,
  FileJson,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { APP_NAME, APP_VERSION } from '@/utils/constants';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    question: '什么是 Browser Claw？',
    answer:
      'Browser Claw 是一个 Chrome 扩展 AI Agent，允许你用自然语言控制网页 API 操作。它通过 OpenAI Function Calling 将自然语言指令映射为预配置的 API Skill，然后通过 Content Script 在页面上下文中执行 HTTP 请求，自动携带当前网站的 Cookie 和认证信息。',
  },
  {
    question: '如何添加一个新的 Skill？',
    answer:
      '在「能力」面板中，点击「添加」按钮，粘贴符合 Skill Schema 的 JSON 配置即可。Skill 定义需要包含 API 的 URL、HTTP 方法、参数描述、响应提取器等信息。你也可以通过导入 JSON 文件批量添加多个 Skills。',
  },
  {
    question: '为什么每次 API 调用都需要确认？',
    answer:
      '这是 Human-in-the-Loop 安全机制。每次 AI 决定调用 API 时，系统会展示完整的请求详情（URL、方法、参数），你需要明确确认后才会真正发出请求。这可以防止 AI 误解意图导致意外操作，尤其是写入类操作（POST/PUT/DELETE）。',
  },
  {
    question: '如何配置 AI 模型？',
    answer:
      '在「模型」面板中，填入你的 OpenAI API 兼容服务的 Base URL 和 API Key。支持任何兼容 OpenAI Chat Completions API 的服务（如 OpenAI、Azure OpenAI、本地 Ollama、vLLM 等）。推荐使用 GPT-4o 或 Claude 3.5 级别的模型以获得最佳效果。',
  },
  {
    question: '什么是频道（Channel）？',
    answer:
      '频道是 Skills 的分组机制，按照网站域名进行组织。每个频道绑定一组域名规则（支持 * 通配符），当你浏览匹配域名的网站时，系统会自动筛选出该频道关联的 Skills，让 AI 只看到与当前网站相关的能力。',
  },
  {
    question: 'Content Script 连接失败怎么办？',
    answer:
      '1. 确认当前页面是 http/https 页面（chrome:// 等特殊页面不支持）\n2. 尝试刷新页面重新注入 Content Script\n3. 检查扩展是否对当前网站有足够的权限\n4. 打开浏览器 DevTools 的 Console 查看是否有错误信息',
  },
  {
    question: 'Skill 参数的位置（in 字段）有哪些选项？',
    answer:
      '• path：路径参数，替换 URL 中的 {参数名} 占位符\n• query：查询参数，追加到 URL 的 ? 后面\n• body：请求体参数，用于 POST/PUT/PATCH 的 JSON body\n• header：请求头参数，设置为 HTTP 请求头',
  },
  {
    question: '如何使用批量执行功能？',
    answer:
      '在对话中，当 AI 需要对多个目标执行相同操作时（如批量标记 Issue），系统会自动启用批量模式。你可以在确认时看到批量任务列表，支持设置并发数和间隔时间，并且会显示实时进度。',
  },
];

const QUICK_START_STEPS = [
  {
    icon: Zap,
    title: '1. 配置模型',
    desc: '在「模型」面板填入 API Base URL 和 Key',
  },
  {
    icon: FileJson,
    title: '2. 导入 Skills',
    desc: '在「能力」面板添加或导入 Skill 配置',
  },
  {
    icon: Layers,
    title: '3. 创建频道',
    desc: '在「频道」面板按网站分组 Skills（可选）',
  },
  {
    icon: Globe,
    title: '4. 打开目标网站',
    desc: '导航到你想操作的网站页面',
  },
  {
    icon: MessageSquare,
    title: '5. 开始对话',
    desc: '在「会话」面板用自然语言描述你的需求',
  },
  {
    icon: Shield,
    title: '6. 确认执行',
    desc: '审核 AI 生成的 API 调用，确认后执行',
  },
];

const FAQ: React.FC = () => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* App Info Header */}
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🦀</div>
        <h1 className="text-lg font-bold">{APP_NAME}</h1>
        <p className="text-xs text-base-content/50 mt-0.5">
          Chrome Extension AI Agent · v{APP_VERSION}
        </p>
        <p className="text-xs text-base-content/40 mt-1">
          用自然语言驱动浏览器 API 操作
        </p>
      </div>

      {/* Quick Start */}
      <div className="mb-6">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" />
          快速开始
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_START_STEPS.map((step) => (
            <div
              key={step.title}
              className="card bg-base-200 p-2.5 flex flex-row items-start gap-2"
            >
              <step.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold">{step.title}</p>
                <p className="text-[10px] text-base-content/60 mt-0.5">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-6">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" />
          常见问题
        </h2>
        <div className="space-y-1">
          {FAQ_LIST.map((item, idx) => (
            <div key={idx} className="collapse collapse-arrow bg-base-200">
              <input
                type="radio"
                name="faq-accordion"
                checked={expandedIdx === idx}
                onChange={() =>
                  setExpandedIdx(expandedIdx === idx ? null : idx)
                }
              />
              <div
                className="collapse-title text-xs font-medium py-2 min-h-0"
                onClick={() =>
                  setExpandedIdx(expandedIdx === idx ? null : idx)
                }
              >
                {item.question}
              </div>
              <div className="collapse-content">
                <p className="text-xs text-base-content/70 whitespace-pre-line leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links & Version */}
      <div className="border-t border-base-300 pt-4 text-center">
        <div className="flex justify-center gap-4 mb-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-xs gap-1"
          >
            <Github className="w-3 h-3" />
            GitHub
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <p className="text-[10px] text-base-content/30">
          {APP_NAME} v{APP_VERSION} · Built with React + OpenAI + Chrome
          Extensions API
        </p>
      </div>
    </div>
  );
};

export default FAQ;
