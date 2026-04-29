// ============ 消息通信类型 ============

export enum MessageType {
  EXECUTE_API = "EXECUTE_API",
  EXECUTE_API_RESULT = "EXECUTE_API_RESULT",
  EXECUTE_BATCH = "EXECUTE_BATCH",
  BATCH_PROGRESS = "BATCH_PROGRESS",
  CANCEL_REQUEST = "CANCEL_REQUEST",
  GET_PAGE_INFO = "GET_PAGE_INFO",
  READ_PAGE_CONTENT = "READ_PAGE_CONTENT",
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

export interface PageInfo {
  url: string;
  hostname: string;
  title: string;
}

export interface PageContentResult {
  success: boolean;
  url: string;
  title: string;
  hostname: string;
  content: string;
  contentLength: number;
  excerpt: string;
  metaDescription: string;
  headings: { level: number; text: string }[];
  links: { text: string; href: string }[];
  error?: string;
}
