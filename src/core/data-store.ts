/**
 * DataStore — 运行时数据仓库
 *
 * 核心思路来自 IBM Research 的 Memory Pointer 方法：
 * 将大型 tool 输出存储在上下文窗口之外，LLM 通过短标识符（指针）与数据交互，
 * 实现零信息丢失 + 大幅降低 token 消耗。
 *
 * @see https://arxiv.org/abs/2511.22729
 */

export interface StoredData {
  /** 唯一指针 ID */
  id: string;
  /** 产生此数据的 skill 名称 */
  skillId: string;
  /** 产生此数据的 skill 调用参数摘要 */
  callArgs: string;
  /** 完整原始数据 */
  raw: unknown;
  /** JSON 字符串长度 */
  sizeChars: number;
  /** 存储时间戳 */
  timestamp: number;
  /** 最后访问时间戳（LRU 淘汰用） */
  lastAccess: number;
  /** 数据结构摘要（传给 LLM 的部分） */
  summary: DataSummary;
}

export interface DataSummary {
  /** 数据类型描述 */
  type: string;
  /** 顶层 key 列表（对象时） */
  topKeys?: string[];
  /** 主数据数组的 key（如 data.items） */
  mainArrayKey?: string;
  /** 主数据数组的长度 */
  mainArrayLength?: number;
  /** 单条记录的字段列表 */
  recordFields?: string[];
  /** 前 2 条样本记录 */
  sampleRecords?: unknown[];
  /** 分页信息 */
  pagination?: {
    hasMore?: boolean;
    total?: number;
    page?: number;
    pageSize?: number;
    nextCursor?: string;
  };
  /** 原始 JSON 大小（字符） */
  rawSizeChars: number;
}

/** 查询 stored data 的选项 */
export interface QueryOptions {
  /** 返回的路径（简单点分路径，如 "data.items"） */
  path?: string;
  /** 数组切片：起始索引（0-based） */
  offset?: number;
  /** 数组切片：返回数量 */
  limit?: number;
  /** 简单字段过滤：{ fieldName: value } */
  filter?: Record<string, unknown>;
  /** 只返回指定字段（投影） */
  fields?: string[];
}

// ============ 阈值配置 ============
/** 超过此字符数的 tool result 存入 DataStore，给 LLM 摘要 + 指针 */
export const STORE_THRESHOLD = 3000;
/** 数据存储过期时间（毫秒）：30 分钟 */
const DATA_TTL_MS = 30 * 60 * 1000;
/** 最大存储条目数 */
const MAX_ENTRIES = 50;

// ============ 全局单例 ============
const store = new Map<string, StoredData>();
let counter = 0;

/**
 * 判断 tool result 是否需要存入 DataStore
 */
export function shouldStoreData(data: unknown): boolean {
  const str = JSON.stringify(data);
  return str !== undefined && str.length > STORE_THRESHOLD;
}

/**
 * 将大型数据存入 DataStore，返回摘要 + 指针信息（放入 LLM 上下文）
 */
export function storeData(
  data: unknown,
  skillId: string,
  callArgs: Record<string, unknown>,
): { pointer: string; contextMessage: string } {
  const id = `ref_${skillId}_${++counter}_${Date.now().toString(36)}`;
  const rawStr = JSON.stringify(data);

  const summary = buildSummary(data, rawStr.length);

  const now = Date.now();

  // 存储前先淘汰过期数据，并检查容量上限
  evict();

  const stored: StoredData = {
    id,
    skillId,
    callArgs: JSON.stringify(callArgs).slice(0, 200),
    raw: data,
    sizeChars: rawStr.length,
    timestamp: now,
    lastAccess: now,
    summary,
  };

  store.set(id, stored);

  // 构造给 LLM 的紧凑上下文消息
  const contextMessage = buildContextMessage(id, summary);

  return { pointer: id, contextMessage };
}

/**
 * 查询已存储的数据 — 供内置 tool 调用
 */
export function queryStoredData(
  pointerId: string,
  options: QueryOptions = {},
): {
  success: boolean;
  data?: unknown;
  error?: string;
  meta?: Record<string, unknown>;
} {
  const stored = store.get(pointerId);
  if (!stored) {
    // 可能已过期淘汰，给出更友好的提示
    return {
      success: false,
      error: `Data pointer "${pointerId}" not found (may have expired). Available pointers: ${[...store.keys()].join(", ") || "none"}. Please re-fetch the data if needed.`,
    };
  }

  // 刷新访问时间（LRU）
  stored.lastAccess = Date.now();

  let result: unknown = stored.raw;

  // 1. 按路径导航
  if (options.path) {
    result = navigatePath(result, options.path);
    if (result === undefined) {
      return {
        success: false,
        error: `Path "${options.path}" not found in stored data. Top-level keys: ${stored.summary.topKeys?.join(", ") ?? "N/A"}`,
      };
    }
  }

  // 2. 如果结果是数组，支持 filter / fields / offset / limit
  if (Array.isArray(result)) {
    let arr = result;

    // 过滤
    if (options.filter && Object.keys(options.filter).length > 0) {
      arr = arr.filter((item) => {
        if (typeof item !== "object" || item === null) return false;
        const rec = item as Record<string, unknown>;
        return Object.entries(options.filter!).every(([k, v]) => {
          const val = rec[k];
          if (typeof v === "string") {
            return String(val).toLowerCase().includes(v.toLowerCase());
          }
          return val === v;
        });
      });
    }

    const totalAfterFilter = arr.length;

    // 切片
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    arr = arr.slice(offset, offset + limit);

    // 字段投影
    if (options.fields && options.fields.length > 0) {
      arr = arr.map((item) => {
        if (typeof item !== "object" || item === null) return item;
        const rec = item as Record<string, unknown>;
        const projected: Record<string, unknown> = {};
        for (const f of options.fields!) {
          if (f in rec) projected[f] = rec[f];
        }
        return projected;
      });
    }

    return {
      success: true,
      data: arr,
      meta: {
        totalRecords: totalAfterFilter,
        offset,
        limit,
        returned: arr.length,
        hasMore: offset + limit < totalAfterFilter,
      },
    };
  }

  // 非数组直接返回
  return { success: true, data: result };
}

/**
 * 获取所有当前存储的数据指针列表
 */
export function listStoredData(): Array<{
  id: string;
  skillId: string;
  sizeChars: number;
  summary: DataSummary;
}> {
  return [...store.values()].map((s) => ({
    id: s.id,
    skillId: s.skillId,
    sizeChars: s.sizeChars,
    summary: s.summary,
  }));
}

/**
 * 清空所有存储（仅在会话彻底结束时调用，如页面关闭）
 */
export function clearStore(): void {
  store.clear();
  counter = 0;
}

/**
 * 淘汰过期数据 + LRU 容量控制
 * 在每次 storeData 时自动调用
 */
function evict(): void {
  const now = Date.now();

  // 1. 移除过期条目（超过 TTL）
  for (const [id, entry] of store) {
    if (now - entry.lastAccess > DATA_TTL_MS) {
      store.delete(id);
    }
  }

  // 2. 如果仍超出容量上限，按 lastAccess 升序淘汰最久未访问的
  if (store.size >= MAX_ENTRIES) {
    const sorted = [...store.entries()].sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess,
    );
    const toRemove = store.size - MAX_ENTRIES + 1; // 留出 1 个位置给即将存入的
    for (let i = 0; i < toRemove; i++) {
      store.delete(sorted[i][0]);
    }
  }
}

// ============ 内部辅助函数 ============

function navigatePath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const indexMatch = part.match(/^(.+)\[(\d+|\*)\]$/);
    if (indexMatch) {
      const key = indexMatch[1];
      current = (current as Record<string, unknown>)[key];
      if (indexMatch[2] === "*") continue;
      if (Array.isArray(current)) {
        current = current[parseInt(indexMatch[2])];
      }
      continue;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function buildSummary(data: unknown, rawSizeChars: number): DataSummary {
  if (data === null || data === undefined) {
    return { type: "null", rawSizeChars };
  }

  if (Array.isArray(data)) {
    return buildArraySummary(data, rawSizeChars);
  }

  if (typeof data === "object") {
    return buildObjectSummary(data as Record<string, unknown>, rawSizeChars);
  }

  return { type: typeof data, rawSizeChars };
}

function buildArraySummary(arr: unknown[], rawSizeChars: number): DataSummary {
  const summary: DataSummary = {
    type: "array",
    mainArrayLength: arr.length,
    rawSizeChars,
  };

  summary.sampleRecords = arr.slice(0, 2);

  if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
    summary.recordFields = Object.keys(arr[0] as Record<string, unknown>);
  }

  return summary;
}

function buildObjectSummary(
  obj: Record<string, unknown>,
  rawSizeChars: number,
): DataSummary {
  const topKeys = Object.keys(obj);
  const summary: DataSummary = {
    type: "object",
    topKeys,
    rawSizeChars,
  };

  // 寻找主数据数组
  const arrayKeyPriority = [
    "data",
    "items",
    "list",
    "results",
    "records",
    "rows",
    "entries",
    "content",
    "hits",
    "documents",
  ];
  let mainArr: unknown[] | null = null;
  let mainKey: string | null = null;

  for (const key of arrayKeyPriority) {
    if (Array.isArray(obj[key])) {
      mainArr = obj[key] as unknown[];
      mainKey = key;
      break;
    }
  }

  if (!mainArr) {
    for (const key of topKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        mainArr = obj[key] as unknown[];
        mainKey = key;
        break;
      }
    }
  }

  if (mainArr && mainKey) {
    summary.mainArrayKey = mainKey;
    summary.mainArrayLength = mainArr.length;
    summary.sampleRecords = mainArr.slice(0, 2);

    if (
      mainArr.length > 0 &&
      typeof mainArr[0] === "object" &&
      mainArr[0] !== null
    ) {
      summary.recordFields = Object.keys(mainArr[0] as Record<string, unknown>);
    }
  }

  // 提取分页信息
  const pagination: NonNullable<DataSummary["pagination"]> = {};
  let hasPagination = false;

  const numField = (keys: string[]): number | undefined => {
    for (const k of keys) {
      if (k in obj && typeof obj[k] === "number") return obj[k] as number;
    }
    return undefined;
  };
  const strField = (keys: string[]): string | undefined => {
    for (const k of keys) {
      if (k in obj && typeof obj[k] === "string") return obj[k] as string;
    }
    return undefined;
  };
  const boolField = (keys: string[]): boolean | undefined => {
    for (const k of keys) {
      if (k in obj) return Boolean(obj[k]);
    }
    return undefined;
  };

  const total = numField(["total", "totalCount", "total_count"]);
  if (total !== undefined) {
    pagination.total = total;
    hasPagination = true;
  }

  const page = numField([
    "page",
    "pageNum",
    "page_num",
    "current_page",
    "currentPage",
  ]);
  if (page !== undefined) {
    pagination.page = page;
    hasPagination = true;
  }

  const pageSize = numField([
    "pageSize",
    "page_size",
    "per_page",
    "perPage",
    "limit",
  ]);
  if (pageSize !== undefined) {
    pagination.pageSize = pageSize;
    hasPagination = true;
  }

  const hasMore = boolField(["hasMore", "has_more", "hasNext", "has_next"]);
  if (hasMore !== undefined) {
    pagination.hasMore = hasMore;
    hasPagination = true;
  }

  const nextCursor = strField([
    "nextCursor",
    "next_cursor",
    "next_page_token",
    "nextPageToken",
    "cursor",
  ]);
  if (nextCursor !== undefined) {
    pagination.nextCursor = nextCursor;
    hasPagination = true;
  }

  if (hasPagination) {
    summary.pagination = pagination;
  }

  return summary;
}

function buildContextMessage(id: string, summary: DataSummary): string {
  const lines: string[] = [];

  lines.push(`[STORED DATA — pointer: "${id}"]`);
  lines.push(
    `Size: ${formatSize(summary.rawSizeChars)} | Type: ${summary.type}`,
  );

  if (summary.topKeys) {
    lines.push(`Top-level keys: ${summary.topKeys.join(", ")}`);
  }

  if (summary.mainArrayKey) {
    lines.push(
      `Main data: "${summary.mainArrayKey}" (${summary.mainArrayLength} records)`,
    );
  } else if (summary.type === "array") {
    lines.push(`Array: ${summary.mainArrayLength} records`);
  }

  if (summary.recordFields) {
    lines.push(`Fields: ${summary.recordFields.join(", ")}`);
  }

  if (summary.pagination) {
    const p = summary.pagination;
    const parts: string[] = [];
    if (p.total !== undefined) parts.push(`total=${p.total}`);
    if (p.page !== undefined) parts.push(`page=${p.page}`);
    if (p.pageSize !== undefined) parts.push(`pageSize=${p.pageSize}`);
    if (p.hasMore !== undefined) parts.push(`hasMore=${p.hasMore}`);
    if (p.nextCursor) parts.push(`nextCursor="${p.nextCursor}"`);
    lines.push(`Pagination: ${parts.join(", ")}`);
  }

  if (summary.sampleRecords && summary.sampleRecords.length > 0) {
    lines.push(`Sample (first ${summary.sampleRecords.length}):`);
    for (const rec of summary.sampleRecords) {
      const str = JSON.stringify(rec);
      lines.push(`  ${str.length > 500 ? str.slice(0, 500) + "..." : str}`);
    }
  }

  lines.push(
    `[Use query_stored_data with pointer="${id}" to retrieve, filter, slice, or project fields from this data]`,
  );

  return lines.join("\n");
}

function formatSize(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  if (chars < 1000000) return `${(chars / 1000).toFixed(1)}K chars`;
  return `${(chars / 1000000).toFixed(2)}M chars`;
}
