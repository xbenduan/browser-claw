// ============ Skill 相关类型定义 ============

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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  location: 'path' | 'query' | 'body' | 'header';
  required: boolean;
  description: string;
  default?: unknown;
  enum?: unknown[];
  example?: unknown;
  validation?: ParameterValidation;
  properties?: SkillParameter[];
  items?: Omit<SkillParameter, 'name' | 'location' | 'required'>;
}

export interface ParameterValidation {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface SkillResponse {
  type: 'json' | 'text' | 'blob';
  schema?: Record<string, unknown>;
  extractors?: ResponseExtractor[];
}

export interface ResponseExtractor {
  name: string;
  path: string;
  description: string;
  transform?: 'count' | 'first' | 'last' | 'flatten' | 'unique';
}

export interface SkillMeta {
  category?: string;
  tags?: string[];
  riskLevel?: 'safe' | 'moderate' | 'dangerous';
  requireConfirm?: boolean;
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface SkillBinding {
  hostPatterns: string[];
}
