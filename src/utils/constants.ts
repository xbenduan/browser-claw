// ============ 常量定义 ============

export const APP_NAME = 'Browser Claw';
export const APP_VERSION = '1.0.0';

export const MAX_AGENT_ITERATIONS = 10;
export const DEFAULT_REQUEST_TIMEOUT = 30000;
export const DEFAULT_BATCH_CONCURRENCY = 3;
export const DEFAULT_BATCH_DELAY = 200;

export const RISK_LEVEL_COLORS = {
  safe: 'badge-success',
  moderate: 'badge-warning',
  dangerous: 'badge-error',
} as const;

export const RISK_LEVEL_LABELS = {
  safe: '安全',
  moderate: '中风险',
  dangerous: '高风险',
} as const;

export const METHOD_COLORS: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-info',
  PUT: 'text-warning',
  PATCH: 'text-warning',
  DELETE: 'text-error',
};
