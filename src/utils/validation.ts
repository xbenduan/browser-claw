import type { SkillDefinition } from "@/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const VALID_PARAM_TYPES = ["string", "number", "boolean", "array", "object"];
const VALID_PARAM_LOCATIONS = ["path", "query", "body", "header"];
const VALID_RISK_LEVELS = ["safe", "moderate", "dangerous"];

/**
 * 校验 Skill 定义是否合法
 */
export function validateSkill(skill: unknown): ValidationResult {
  const errors: string[] = [];

  if (!skill || typeof skill !== "object") {
    return { valid: false, errors: ["Skill must be a non-null object"] };
  }

  const s = skill as Record<string, unknown>;

  // 基础字段校验
  if (!s.id || typeof s.id !== "string")
    errors.push('Missing or invalid "id" (string)');
  if (!s.name || typeof s.name !== "string")
    errors.push('Missing or invalid "name" (string)');
  if (!s.description || typeof s.description !== "string")
    errors.push('Missing or invalid "description" (string)');
  if (!s.version || typeof s.version !== "string")
    errors.push('Missing or invalid "version" (string)');

  // API 字段校验
  const api = s.api as Record<string, unknown> | undefined;
  if (!api || typeof api !== "object") {
    errors.push('Missing or invalid "api" object');
  } else {
    if (!api.method || !VALID_METHODS.includes(api.method as string)) {
      errors.push(`api.method must be one of: ${VALID_METHODS.join(", ")}`);
    }
    if (!api.path || typeof api.path !== "string") {
      errors.push("api.path must be a non-empty string");
    }
    if (
      api.baseUrl &&
      typeof api.baseUrl === "string" &&
      !api.baseUrl.startsWith("http")
    ) {
      errors.push("api.baseUrl must start with http:// or https://");
    }
    if (typeof api.path === "string") {
      if (api.path.includes("..") || api.path.includes("//")) {
        errors.push('Suspicious path pattern detected (contains ".." or "//")');
      }
    }
  }

  // 参数校验
  const parameters = s.parameters;
  if (!Array.isArray(parameters)) {
    errors.push('"parameters" must be an array');
  } else {
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i] as Record<string, unknown>;
      if (!p.name || typeof p.name !== "string")
        errors.push(`parameters[${i}]: missing "name"`);
      if (!VALID_PARAM_TYPES.includes(p.type as string))
        errors.push(`parameters[${i}]: invalid type "${p.type}"`);
      if (!VALID_PARAM_LOCATIONS.includes(p.location as string))
        errors.push(`parameters[${i}]: invalid location "${p.location}"`);
      if (typeof p.required !== "boolean")
        errors.push(`parameters[${i}]: "required" must be boolean`);
      if (!p.description || typeof p.description !== "string")
        errors.push(`parameters[${i}]: missing "description"`);
    }
  }

  // Response 校验
  const response = s.response as Record<string, unknown> | undefined;
  if (!response || typeof response !== "object") {
    errors.push('Missing or invalid "response" object');
  } else {
    if (!["json", "text", "blob"].includes(response.type as string)) {
      errors.push("response.type must be one of: json, text, blob");
    }
  }

  // Meta 校验
  const meta = s.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta === "object") {
    if (
      meta.riskLevel &&
      !VALID_RISK_LEVELS.includes(meta.riskLevel as string)
    ) {
      errors.push(
        `meta.riskLevel must be one of: ${VALID_RISK_LEVELS.join(", ")}`,
      );
    }
  }

  // Binding 校验
  const binding = s.binding as Record<string, unknown> | undefined;
  if (!binding || typeof binding !== "object") {
    errors.push('Missing or invalid "binding" object');
  } else {
    if (
      !Array.isArray(binding.hostPatterns) ||
      binding.hostPatterns.length === 0
    ) {
      errors.push("binding.hostPatterns must be a non-empty array");
    } else {
      for (const pattern of binding.hostPatterns as string[]) {
        if (pattern === "*" || pattern === "*.*") {
          errors.push(`Host pattern "${pattern}" is too broad`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 批量校验 Skills
 */
export function validateSkills(skills: unknown[]): {
  valid: SkillDefinition[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: SkillDefinition[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];

  for (let i = 0; i < skills.length; i++) {
    const result = validateSkill(skills[i]);
    if (result.valid) {
      valid.push(skills[i] as SkillDefinition);
    } else {
      invalid.push({ index: i, errors: result.errors });
    }
  }

  return { valid, invalid };
}
