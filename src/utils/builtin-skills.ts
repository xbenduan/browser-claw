import type { SkillDefinition } from '@/types';

/**
 * 内置 Skill ID 常量
 * 用于在 agent-engine 中识别需要特殊处理的内置 Skill
 */
export const BUILTIN_SKILL_IDS = {
  READ_PAGE_CONTENT: '__builtin_read_page_content',
} as const;

/**
 * 内置 Skill：读取当前网页内容
 * 适用于所有网站，通过 Content Script 直接读取 DOM 内容
 */
const readPageContentSkill: SkillDefinition = {
  id: BUILTIN_SKILL_IDS.READ_PAGE_CONTENT,
  name: '读取网页内容',
  description: '读取当前浏览器标签页的网页内容，包括正文文本、标题、页面描述、标题结构和页面链接。可用于总结页面内容、提取信息、回答关于当前页面的问题。',
  version: '1.0.0',
  api: {
    method: 'GET',
    path: '/__builtin/read-page-content',
    baseUrl: '',
  },
  parameters: [
    {
      name: 'maxLength',
      type: 'number',
      location: 'query',
      required: false,
      description: '返回内容的最大字符数，默认 15000。如果用户只需要摘要可以设置较小的值如 3000',
      default: 15000,
    },
    {
      name: 'includeLinks',
      type: 'boolean',
      location: 'query',
      required: false,
      description: '是否包含页面链接列表，默认 true',
      default: true,
    },
    {
      name: 'includeHeadings',
      type: 'boolean',
      location: 'query',
      required: false,
      description: '是否包含页面标题结构（h1-h6），默认 true',
      default: true,
    },
  ],
  response: {
    type: 'json',
    extractors: [],
  },
  meta: {
    category: '内置工具',
    tags: ['builtin', 'page-content', 'reader'],
    riskLevel: 'safe',
    requireConfirm: false,
  },
  binding: {
    hostPatterns: ['*'],
  },
};

/**
 * 所有内置 Skills 列表
 */
export const builtinSkills: SkillDefinition[] = [
  readPageContentSkill,
];

/**
 * 判断一个 Skill ID 是否是内置 Skill
 */
export function isBuiltinSkill(skillId: string): boolean {
  return Object.values(BUILTIN_SKILL_IDS).includes(skillId as typeof BUILTIN_SKILL_IDS[keyof typeof BUILTIN_SKILL_IDS]);
}
