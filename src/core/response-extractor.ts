import type { ResponseExtractor } from '@/types';

/**
 * 使用简易 JSONPath 从响应数据中提取值
 */
function getByPath(obj: unknown, path: string): unknown {
  // 简易 JSONPath 支持: $.data.items[*].id
  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // 处理数组通配符 items[*]
    const arrayMatch = part.match(/^(.+)\[\*\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr;
      continue;
    }

    // 处理数组索引 items[0]
    const indexMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (indexMatch) {
      const key = indexMatch[1];
      const idx = parseInt(indexMatch[2]);
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[idx];
      continue;
    }

    // 如果当前是数组（由 [*] 展开），对每个元素取属性
    if (Array.isArray(current)) {
      current = current.map((item) => (item as Record<string, unknown>)?.[part]).filter(v => v !== undefined);
      continue;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 应用 transform 操作
 */
function applyTransform(value: unknown, transform?: ResponseExtractor['transform']): unknown {
  if (!transform || !Array.isArray(value)) return value;

  switch (transform) {
    case 'count':
      return value.length;
    case 'first':
      return value[0];
    case 'last':
      return value[value.length - 1];
    case 'flatten':
      return value.flat();
    case 'unique':
      return [...new Set(value)];
    default:
      return value;
  }
}

/**
 * 从 API 响应中提取关键信息
 * 返回提取后的 key-value 对象，用于减少传递给 LLM 的 Token 量
 */
export function applyExtractors(
  data: unknown,
  extractors?: ResponseExtractor[]
): Record<string, unknown> {
  if (!extractors || extractors.length === 0) {
    // 无提取器，原样返回（截断到合理大小）
    const str = JSON.stringify(data);
    if (str && str.length > 8000) {
      return { _raw_truncated: str.slice(0, 8000) + '... (truncated)' };
    }
    return { _raw: data };
  }

  const result: Record<string, unknown> = {};
  for (const ext of extractors) {
    const value = getByPath(data, ext.path);
    result[ext.name] = applyTransform(value, ext.transform);
  }
  return result;
}
