// ============ Agent 引擎类型 ============

export interface AgentConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ConfirmationRequest {
  skillId: string;
  skillName: string;
  skillDescription: string;
  method: string;
  url: string;
  parameters: Record<string, unknown>;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  headers?: Record<string, string>;
  body?: unknown;
  isBatch?: boolean;
  batchCount?: number;
  parameterTemplate?: Record<string, unknown>;
  varyingField?: string;
}

/**
 * 确认操作的结果。
 * - confirmed: 用户是否确认执行
 * - modifiedParameters: 如果用户修改了参数，这里是修改后的参数对象
 */
export interface ConfirmationResult {
  confirmed: boolean;
  modifiedParameters?: Record<string, unknown>;
}

export interface ConfirmationCardData {
  title: string;
  description: string;
  method: string;
  url: string;
  parameters: Record<string, unknown>;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  isBatch?: boolean;
  batchCount?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallDisplay[];
  status?: 'pending' | 'streaming' | 'done' | 'error';
  toolCallId?: string;
}

export interface ToolCallDisplay {
  id: string;
  skillName: string;
  skillId: string;
  arguments: Record<string, unknown>;
  status: 'pending_confirmation' | 'confirmed' | 'rejected' | 'executing' | 'success' | 'error';
  result?: unknown;
  error?: string;
  duration?: number;
  confirmation?: ConfirmationRequest;
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
  | { type: 'llm_call_start' }
  | { type: 'llm_streaming'; content: string }
  | { type: 'assistant_message'; content: string }
  | { type: 'tool_call_start'; toolCall: ToolCallDisplay }
  | { type: 'confirmation_required'; toolCall: ToolCallDisplay; confirmData: ConfirmationRequest }
  | { type: 'tool_call_result'; toolCall: ToolCallDisplay; result: unknown }
  | { type: 'batch_progress'; progress: BatchProgress }
  | { type: 'error'; error: string }
  | { type: 'done' }
  | { type: 'step_finish' };
