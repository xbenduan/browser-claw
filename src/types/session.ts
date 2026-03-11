// ============ 会话管理类型 ============

import type { ChatMessage } from './agent';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  hostname: string;
  /** 会话摘要 - 取第一条用户消息 */
  preview: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  hostname: string;
  preview: string;
  messageCount: number;
}
