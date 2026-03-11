import type { SkillDefinition, ExecuteAPIPayload } from '@/types';

/**
 * 根据 Skill 定义和 AI 生成的参数，组装 HTTP 请求
 */
export function buildHttpRequest(
  skill: SkillDefinition,
  args: Record<string, unknown>
): ExecuteAPIPayload {
  let url = skill.api.path;
  const queryParams = new URLSearchParams();
  const bodyParams: Record<string, unknown> = {};
  const headerParams: Record<string, string> = { ...skill.api.headers };

  for (const param of skill.parameters) {
    const value = args[param.name] ?? param.default;
    if (value === undefined || value === null) continue;

    switch (param.location) {
      case 'path':
        url = url.replace(`{${param.name}}`, encodeURIComponent(String(value)));
        break;
      case 'query':
        queryParams.set(param.name, String(value));
        break;
      case 'body':
        bodyParams[param.name] = value;
        break;
      case 'header':
        headerParams[param.name] = String(value);
        break;
    }
  }

  const baseUrl = skill.api.baseUrl || '';
  const queryString = queryParams.toString();
  const fullUrl = `${baseUrl}${url}${queryString ? '?' + queryString : ''}`;

  return {
    method: skill.api.method,
    url: fullUrl,
    body: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
    headers: Object.keys(headerParams).length > 0 ? headerParams : undefined,
    timeout: skill.api.timeout,
  };
}
