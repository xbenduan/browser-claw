import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileJson,
  Github,
  Globe,
  HelpCircle,
  Layers,
  MessageSquare,
  Shield,
  Zap,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { APP_NAME, APP_VERSION } from "@/utils/constants";

const QUICK_START_ICONS = [Zap, FileJson, Layers, Globe, MessageSquare, Shield];
const QUICK_START_COLORS = [
  "text-yellow-500",
  "text-blue-500",
  "text-purple-500",
  "text-green-500",
  "text-cyan-500",
  "text-red-500",
];

const FAQ: React.FC = () => {
  const { messages, t } = useI18n();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar font-sans text-slate-700">
      {/* App Info Header */}
      <div className="text-center mb-8 animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 rounded-3xl bg-linear-to-br from-cyan-100 to-blue-100 border border-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-100">
          <div className="text-3xl">🦀</div>
        </div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-cyan-600 to-blue-600">
          {APP_NAME}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500">
            v{APP_VERSION}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-[10px] text-cyan-600">
            AI Agent
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-60 mx-auto leading-relaxed">
          {messages.faq.tagline}
        </p>
      </div>

      {/* Quick Start */}
      <div className="mb-8">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800">
          <div className="p-1 rounded bg-cyan-50">
            <BookOpen className="w-4 h-4 text-cyan-600" />
          </div>
          {messages.faq.quickStartTitle}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {messages.faq.quickStart.map((step, idx) => {
            const Icon = QUICK_START_ICONS[idx];
            const color = QUICK_START_COLORS[idx];
            return (
              <div
                key={step.title}
                className="glass-card p-3 flex flex-col gap-2 hover:-translate-y-0.5 transition-transform duration-300"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className="text-xs font-semibold text-slate-800">
                    {step.title}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800">
          <div className="p-1 rounded bg-purple-50">
            <HelpCircle className="w-4 h-4 text-purple-600" />
          </div>
          {messages.faq.faqTitle}
        </h2>
        <div className="space-y-2">
          {messages.faq.list.map((item, idx) => (
            <div
              key={idx}
              className={`glass-panel rounded-xl overflow-hidden transition-all duration-300 ${
                expandedIdx === idx
                  ? "bg-white border-cyan-200 shadow-sm"
                  : "bg-white/60 hover:bg-white/80 border-slate-200"
              }`}
            >
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              >
                <span
                  className={`text-xs font-medium ${expandedIdx === idx ? "text-cyan-700" : "text-slate-700"}`}
                >
                  {item.question}
                </span>
                {expandedIdx === idx ? (
                  <ChevronUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </button>

              {expandedIdx === idx && (
                <div className="px-4 pb-4 text-xs text-slate-500 leading-relaxed whitespace-pre-line animate-in slide-in-from-top-2 border-t border-slate-100 mt-1">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Links & Version */}
      <div className="border-t border-slate-200 pt-6 text-center">
        <div className="flex justify-center gap-4 mb-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-button text-xs py-1.5 px-4 text-slate-500 hover:text-slate-800"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
            <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
          </a>
        </div>
        <p className="text-[10px] text-slate-400">
          {t("faq.builtWith", { app: APP_NAME, version: APP_VERSION })}
        </p>
      </div>
    </div>
  );
};

export default FAQ;
