import type { SkillDefinition } from "@/types";

/**
 * 内置 Skill ID 常量
 * 用于在 agent-engine 中识别需要特殊处理的内置 Skill
 */
export const BUILTIN_SKILL_IDS = {
  READ_PAGE_CONTENT: "__builtin_read_page_content",
  QUERY_STORED_DATA: "__builtin_query_stored_data",
} as const;

/**
 * 内置 Skill：读取当前网页内容
 * 适用于所有网站，通过 Content Script 直接读取 DOM 内容
 */
const readPageContentSkill: SkillDefinition = {
  id: BUILTIN_SKILL_IDS.READ_PAGE_CONTENT,
  name: "读取网页内容",
  description:
    "读取当前浏览器标签页的网页内容，包括正文文本、标题、页面描述、标题结构和页面链接。可用于总结页面内容、提取信息、回答关于当前页面的问题。",
  version: "1.0.0",
  api: {
    method: "GET",
    path: "/__builtin/read-page-content",
    baseUrl: "",
  },
  parameters: [
    {
      name: "maxLength",
      type: "number",
      location: "query",
      required: false,
      description:
        "返回内容的最大字符数，默认 15000。如果用户只需要摘要可以设置较小的值如 3000",
      default: 15000,
    },
    {
      name: "includeLinks",
      type: "boolean",
      location: "query",
      required: false,
      description: "是否包含页面链接列表，默认 true",
      default: true,
    },
    {
      name: "includeHeadings",
      type: "boolean",
      location: "query",
      required: false,
      description: "是否包含页面标题结构（h1-h6），默认 true",
      default: true,
    },
  ],
  response: {
    type: "json",
    extractors: [],
  },
  meta: {
    category: "内置工具",
    tags: ["builtin", "page-content", "reader"],
    riskLevel: "safe",
    requireConfirm: false,
  },
  binding: {
    hostPatterns: ["*"],
  },
};

/**
 * 内置 Skill：查询已存储的大型数据
 *
 * 当 API 返回的数据量很大时，系统会自动将完整数据存入 DataStore 并给你一个指针 ID。
 * 使用此工具通过指针 ID 查询、过滤、切片、投影存储的完整数据，避免上下文溢出。
 */
const queryStoredDataSkill: SkillDefinition = {
  id: BUILTIN_SKILL_IDS.QUERY_STORED_DATA,
  name: "查询存储数据",
  description:
    '通过指针 ID 查询之前 API 调用返回的大型数据。支持路径导航、数组切片（offset/limit）、字段过滤（filter）和字段投影（fields）。当你在 tool result 中看到 "[STORED DATA — pointer: ...]" 时，使用此工具获取完整数据。',
  version: "1.0.0",
  api: {
    method: "GET",
    path: "/__builtin/query-stored-data",
    baseUrl: "",
  },
  parameters: [
    {
      name: "pointer",
      type: "string",
      location: "query",
      required: true,
      description:
        '数据指针 ID，如 "ref_getUsers_1_abc123"。在之前的 tool result 中可以找到。',
    },
    {
      name: "path",
      type: "string",
      location: "query",
      required: false,
      description:
        '数据路径（点分格式），用于导航到嵌套数据。例如 "data.items" 或 "result.users"。不填则返回顶层数据。',
    },
    {
      name: "offset",
      type: "number",
      location: "query",
      required: false,
      description:
        "数组切片起始索引（0-based），默认 0。与 limit 配合实现分页浏览。",
      default: 0,
    },
    {
      name: "limit",
      type: "number",
      location: "query",
      required: false,
      description: "返回的最大记录数，默认 50。设置较小值避免返回过多数据。",
      default: 50,
    },
    {
      name: "filter",
      type: "object",
      location: "body",
      required: false,
      description:
        '简单字段过滤条件。格式 { "fieldName": "value" }。字符串值支持模糊匹配（不区分大小写），其他类型精确匹配。',
    },
    {
      name: "fields",
      type: "array",
      location: "body",
      required: false,
      description:
        '字段投影列表，只返回指定字段。例如 [["id", "name", "email"]。不填返回所有字段。',
      items: {
        type: "string",
        description: "字段名",
      },
    },
  ],
  response: {
    type: "json",
    extractors: [],
  },
  meta: {
    category: "内置工具",
    tags: ["builtin", "data-query", "memory-pointer"],
    riskLevel: "safe",
    requireConfirm: false,
  },
  binding: {
    hostPatterns: ["*"],
  },
};

/**
 * 所有内置 Skills 列表
 */
export const builtinSkills: SkillDefinition[] = [
  readPageContentSkill,
  queryStoredDataSkill,
];

/**
 * 判断一个 Skill ID 是否是内置 Skill
 */
export function isBuiltinSkill(skillId: string): boolean {
  return Object.values(BUILTIN_SKILL_IDS).includes(
    skillId as (typeof BUILTIN_SKILL_IDS)[keyof typeof BUILTIN_SKILL_IDS],
  );
}
