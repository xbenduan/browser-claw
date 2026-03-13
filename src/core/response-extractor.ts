import type { ResponseExtractor } from "@/types";
import { shouldStoreData, storeData } from "./data-store";

/**
 * 使用简易 JSONPath 从响应数据中提取值
 */
function getByPath(obj: unknown, path: string): unknown {
  // 简易 JSONPath 支持: $.data.items[*].id
  const parts = path.replace(/^\$\.?/, "").split(".");
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
      current = current
        .map((item) => (item as Record<string, unknown>)?.[part])
        .filter((v) => v !== undefined);
      continue;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 应用 transform 操作
 */
function applyTransform(
  value: unknown,
  transform?: ResponseExtractor["transform"],
): unknown {
  if (!transform || !Array.isArray(value)) return value;

  switch (transform) {
    case "count":
      return value.length;
    case "first":
      return value[0];
    case "last":
      return value[value.length - 1];
    case "flatten":
      return value.flat();
    case "unique":
      return [...new Set(value)];
    default:
      return value;
  }
}

/**
 * 从 API 响应中提取关键信息
 *
 * 核心改动：不再截断大数据。当数据量超过阈值时，
 * 完整数据存入 DataStore，返回摘要 + 指针给 LLM。
 * 数据零丢失，LLM 可通过 query_stored_data 工具随时查询完整数据。
 */
export function applyExtractors(
  data: unknown,
  extractors?: ResponseExtractor[],
  skillId?: string,
  callArgs?: Record<string, unknown>,
): Record<string, unknown> {
  if (!extractors || extractors.length === 0) {
    // 无提取器 — 检查是否需要存入 DataStore
    if (shouldStoreData(data)) {
      const { pointer, contextMessage } = storeData(
        data,
        skillId ?? "unknown",
        callArgs ?? {},
      );
      return {
        _data_pointer: pointer,
        _summary: contextMessage,
      };
    }
    // 数据量小，直接返回
    return { _raw: data };
  }

  // 有提取器：先提取
  const result: Record<string, unknown> = {};
  for (const ext of extractors) {
    const value = getByPath(data, ext.path);
    result[ext.name] = applyTransform(value, ext.transform);
  }

  // 提取后的结果如果还是很大，也存入 DataStore
  if (shouldStoreData(result)) {
    const { pointer, contextMessage } = storeData(
      result,
      skillId ?? "unknown",
      callArgs ?? {},
    );
    return {
      _data_pointer: pointer,
      _summary: contextMessage,
      // 保留提取器的 key 名称，方便 LLM 理解
      _extracted_keys: Object.keys(result),
    };
  }

  return result;
}
