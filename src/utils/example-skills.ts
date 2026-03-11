import type { SkillDefinition } from '@/types';

/**
 * 内置示例 Skills
 * 帮助用户了解 Skill JSON 的格式，可以直接添加或作为模板修改
 */
export const EXAMPLE_SKILLS: SkillDefinition[] = [
  {
    id: 'github_list_repos',
    name: 'GitHub 仓库列表',
    description:
      '获取指定用户的 GitHub 公开仓库列表，支持按排序方式和方向筛选。适用于浏览和了解某个用户或组织的项目情况。',
    version: '1.0.0',
    api: {
      method: 'GET',
      path: '/users/{username}/repos',
      baseUrl: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    },
    parameters: [
      {
        name: 'username',
        type: 'string',
        location: 'path',
        required: true,
        description: 'GitHub 用户名',
        example: 'octocat',
      },
      {
        name: 'sort',
        type: 'string',
        location: 'query',
        required: false,
        description: '排序字段',
        enum: ['created', 'updated', 'pushed', 'full_name'],
        default: 'updated',
      },
      {
        name: 'per_page',
        type: 'number',
        location: 'query',
        required: false,
        description: '每页返回数量',
        default: 10,
        validation: { min: 1, max: 100 },
      },
    ],
    response: {
      type: 'json',
      extractors: [
        {
          name: 'repo_names',
          path: '$[*].full_name',
          description: '所有仓库的全名列表',
        },
        {
          name: 'repo_count',
          path: '$',
          description: '返回的仓库数量',
          transform: 'count',
        },
      ],
    },
    meta: {
      category: 'GitHub',
      tags: ['查询', '仓库', 'GitHub'],
      riskLevel: 'safe',
      requireConfirm: false,
    },
    binding: {
      hostPatterns: ['github.com', '*.github.com'],
    },
  },
  {
    id: 'github_create_issue',
    name: 'GitHub 创建 Issue',
    description:
      '在指定 GitHub 仓库中创建一个新的 Issue。可以设置标题、正文内容和标签。适用于快速记录 Bug、提出 Feature Request 等场景。',
    version: '1.0.0',
    api: {
      method: 'POST',
      path: '/repos/{owner}/{repo}/issues',
      baseUrl: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 15000,
    },
    parameters: [
      {
        name: 'owner',
        type: 'string',
        location: 'path',
        required: true,
        description: '仓库拥有者（用户名或组织名）',
        example: 'octocat',
      },
      {
        name: 'repo',
        type: 'string',
        location: 'path',
        required: true,
        description: '仓库名称',
        example: 'hello-world',
      },
      {
        name: 'title',
        type: 'string',
        location: 'body',
        required: true,
        description: 'Issue 标题',
      },
      {
        name: 'body',
        type: 'string',
        location: 'body',
        required: false,
        description: 'Issue 正文内容（支持 Markdown）',
      },
      {
        name: 'labels',
        type: 'array',
        location: 'body',
        required: false,
        description: '标签列表',
        items: { type: 'string', description: '标签名称' },
      },
    ],
    response: {
      type: 'json',
      extractors: [
        {
          name: 'issue_number',
          path: '$.number',
          description: '新建 Issue 的编号',
        },
        {
          name: 'issue_url',
          path: '$.html_url',
          description: 'Issue 的网页链接',
        },
      ],
    },
    meta: {
      category: 'GitHub',
      tags: ['创建', 'Issue', 'GitHub'],
      riskLevel: 'moderate',
      requireConfirm: true,
    },
    binding: {
      hostPatterns: ['github.com', '*.github.com'],
    },
  },
  {
    id: 'jsonplaceholder_get_posts',
    name: '查询文章列表',
    description:
      '从 JSONPlaceholder 测试 API 获取文章列表，支持按用户 ID 筛选。这是一个公开的测试接口，可以放心体验，无需任何认证。',
    version: '1.0.0',
    api: {
      method: 'GET',
      path: '/posts',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 8000,
    },
    parameters: [
      {
        name: 'userId',
        type: 'number',
        location: 'query',
        required: false,
        description: '按用户 ID 筛选文章',
        example: 1,
      },
    ],
    response: {
      type: 'json',
      extractors: [
        {
          name: 'titles',
          path: '$[*].title',
          description: '所有文章标题',
        },
        {
          name: 'count',
          path: '$',
          description: '文章总数',
          transform: 'count',
        },
      ],
    },
    meta: {
      category: '测试',
      tags: ['查询', '测试', '文章'],
      riskLevel: 'safe',
      requireConfirm: false,
    },
    binding: {
      hostPatterns: ['jsonplaceholder.typicode.com', '*'],
    },
  },
];

/** 获取单个示例的格式化 JSON（用于展示在编辑器中） */
export function getExampleSkillJSON(index: number = 0): string {
  return JSON.stringify(EXAMPLE_SKILLS[index] ?? EXAMPLE_SKILLS[0], null, 2);
}

/** 获取最简格式的 Skill 模板 */
export const SKILL_TEMPLATE: SkillDefinition = {
  id: 'my_skill_id',
  name: '我的 Skill 名称',
  description: '详细描述这个 Skill 做什么，AI 会根据描述判断何时调用它',
  version: '1.0.0',
  api: {
    method: 'GET',
    path: '/api/v1/example',
    baseUrl: 'https://your-site.com',
    timeout: 10000,
  },
  parameters: [
    {
      name: 'param_name',
      type: 'string',
      location: 'query',
      required: false,
      description: '参数说明',
    },
  ],
  response: {
    type: 'json',
    extractors: [
      {
        name: 'result',
        path: '$.data',
        description: '返回数据',
      },
    ],
  },
  meta: {
    category: '分类',
    tags: ['标签'],
    riskLevel: 'safe',
    requireConfirm: false,
  },
  binding: {
    hostPatterns: ['your-site.com'],
  },
};

export function getSkillTemplateJSON(): string {
  return JSON.stringify(SKILL_TEMPLATE, null, 2);
}
