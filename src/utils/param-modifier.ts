import type { SkillDefinition } from '@/types';

export interface ParseResult {
  success: boolean;
  newParams?: Record<string, unknown>;
  changes?: string[];
  error?: string;
}

/**
 * 解析用户的自然语言参数修改指令
 * 支持常见的中英文修改模式：
 *   - "把 X 改成 Y" / "将 X 设为 Y" / "X 改为 Y"
 *   - "set X to Y" / "change X to Y"
 *   - "X = Y" / "X: Y"
 *   - "删除 X" / "remove X"
 *   - "添加 X = Y" / "add X = Y"
 */
export function parseChatModification(
  input: string,
  currentParams: Record<string, unknown>,
  _skillDef?: SkillDefinition
): ParseResult {
  const text = input.trim();
  const changes: string[] = [];
  const newParams = { ...currentParams };

  // 模式 1: "把 X 改成/设为/改为 Y" | "将 X 改成/设为/改为 Y"
  const cnPattern = /(?:把|将)\s*(\w+)\s*(?:改成|设为|改为|设置为|更改为|变为|变成)\s*(.+)/gi;
  let match = cnPattern.exec(text);
  if (match) {
    const [, key, rawValue] = match;
    const value = parseValue(rawValue.trim());
    const actualKey = findActualKey(key, newParams);
    newParams[actualKey] = value;
    changes.push(`${actualKey} → ${JSON.stringify(value)}`);
    return { success: true, newParams, changes };
  }

  // 模式 2: "X 改成/设为 Y"
  const cnPattern2 = /(\w+)\s*(?:改成|设为|改为|设置为|更改为|变为|变成)\s*(.+)/gi;
  match = cnPattern2.exec(text);
  if (match) {
    const [, key, rawValue] = match;
    const value = parseValue(rawValue.trim());
    const actualKey = findActualKey(key, newParams);
    newParams[actualKey] = value;
    changes.push(`${actualKey} → ${JSON.stringify(value)}`);
    return { success: true, newParams, changes };
  }

  // 模式 3: "set X to Y" / "change X to Y"
  const enPattern = /(?:set|change|update|modify)\s+(\w+)\s+(?:to|=)\s+(.+)/gi;
  match = enPattern.exec(text);
  if (match) {
    const [, key, rawValue] = match;
    const value = parseValue(rawValue.trim());
    const actualKey = findActualKey(key, newParams);
    newParams[actualKey] = value;
    changes.push(`${actualKey} → ${JSON.stringify(value)}`);
    return { success: true, newParams, changes };
  }

  // 模式 4: "X = Y" 或 "X: Y"
  const assignPattern = /^(\w+)\s*[=:]\s*(.+)$/gm;
  let hasAssignment = false;
  let assignMatch;
  while ((assignMatch = assignPattern.exec(text)) !== null) {
    const [, key, rawValue] = assignMatch;
    const value = parseValue(rawValue.trim());
    const actualKey = findActualKey(key, newParams);
    newParams[actualKey] = value;
    changes.push(`${actualKey} → ${JSON.stringify(value)}`);
    hasAssignment = true;
  }
  if (hasAssignment) {
    return { success: true, newParams, changes };
  }

  // 模式 5: "删除 X" / "移除 X" / "remove X" / "delete X"
  const removePattern = /(?:删除|移除|去掉|remove|delete)\s+(\w+)/gi;
  match = removePattern.exec(text);
  if (match) {
    const [, key] = match;
    const actualKey = findActualKey(key, newParams);
    if (actualKey in newParams) {
      delete newParams[actualKey];
      changes.push(`删除 ${actualKey}`);
      return { success: true, newParams, changes };
    }
    return { success: false, error: `参数 "${key}" 不存在` };
  }

  return { success: false };
}

/**
 * 智能解析值：自动转换为合适的类型
 */
export function parseValue(raw: string): unknown {
  // Boolean
  if (/^(true|yes|是)$/i.test(raw)) return true;
  if (/^(false|no|否)$/i.test(raw)) return false;
  // Null
  if (/^(null|none|空|无)$/i.test(raw)) return null;
  // Number
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  // JSON array/object
  if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to string
    }
  }
  // Remove surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * 在参数对象中查找实际的 key（忽略大小写、camelCase/snake_case）
 */
export function findActualKey(input: string, params: Record<string, unknown>): string {
  // 精确匹配
  if (input in params) return input;
  // 忽略大小写匹配
  const lower = input.toLowerCase();
  for (const key of Object.keys(params)) {
    if (key.toLowerCase() === lower) return key;
  }
  // camelCase vs snake_case 互转匹配
  const camel = input.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (camel in params) return camel;
  const snake = input.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  if (snake in params) return snake;
  // 没找到就用原始输入
  return input;
}
