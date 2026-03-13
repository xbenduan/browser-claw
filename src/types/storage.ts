// ============ 存储结构 ============

import type { SkillDefinition } from "./skill";
import type { Channel } from "./channel";
import type { AgentConfig } from "./agent";
import type { ChatSession } from "./session";

export interface StorageSchema {
  skills: SkillDefinition[];
  modelConfig: AgentConfig;
  channels: Channel[];
  preferences: UserPreferences;
  chatHistory: Record<string, unknown>;
  /** 多会话存储 */
  sessions: ChatSession[];
  /** 当前活跃的会话 ID */
  activeSessionId: string;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "zh" | "en";
  confirmBeforeExecute: boolean;
  maxHistoryMessages: number;
}

/**
 * 模型配置默认值
 * 优先从 .env 文件读取，方便本地调试时免去反复配置
 *
 * .env 示例：
 *   VITE_DEFAULT_API_KEY=sk-xxxx
 *   VITE_DEFAULT_BASE_URL=https://api.openai.com/v1
 *   VITE_DEFAULT_MODEL=gpt-4o
 */
export const DEFAULT_MODEL_CONFIG: AgentConfig = {
  baseURL: import.meta.env.VITE_DEFAULT_BASE_URL || "https://api.openai.com/v1",
  apiKey: import.meta.env.VITE_DEFAULT_API_KEY || "",
  model: import.meta.env.VITE_DEFAULT_MODEL || "gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  language: "zh",
  confirmBeforeExecute: true,
  maxHistoryMessages: 50,
};
