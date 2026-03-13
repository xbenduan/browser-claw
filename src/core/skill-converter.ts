import type { SkillDefinition } from "@/types";
import type OpenAI from "openai";

/**
 * Skill 定义 → OpenAI Tool 格式转换
 */
export function skillToOpenAITool(
  skill: SkillDefinition,
): OpenAI.ChatCompletionTool {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const param of skill.parameters) {
    const prop: Record<string, unknown> = {
      type: param.type,
      description: param.description,
    };
    if (param.enum) prop.enum = param.enum;
    if (param.default !== undefined) prop.default = param.default;
    if (param.validation?.min !== undefined)
      prop.minimum = param.validation.min;
    if (param.validation?.max !== undefined)
      prop.maximum = param.validation.max;
    if (param.validation?.minLength !== undefined)
      prop.minLength = param.validation.minLength;
    if (param.validation?.maxLength !== undefined)
      prop.maxLength = param.validation.maxLength;
    if (param.validation?.pattern) prop.pattern = param.validation.pattern;
    if (param.example !== undefined) prop.example = param.example;

    // 嵌套 object
    if (param.type === "object" && param.properties) {
      const nested: Record<string, Record<string, unknown>> = {};
      const nestedRequired: string[] = [];
      for (const sub of param.properties) {
        nested[sub.name] = { type: sub.type, description: sub.description };
        if (sub.required) nestedRequired.push(sub.name);
      }
      prop.properties = nested;
      if (nestedRequired.length > 0) prop.required = nestedRequired;
    }

    // 数组元素
    if (param.type === "array" && param.items) {
      prop.items = {
        type: param.items.type,
        description: param.items.description,
      };
    }

    properties[param.name] = prop;
    if (param.required) required.push(param.name);
  }

  return {
    type: "function" as const,
    function: {
      name: skill.id,
      description: skill.description,
      parameters: {
        type: "object" as const,
        properties,
        required,
      },
    },
  };
}

/**
 * 批量转换
 */
export function skillsToOpenAITools(
  skills: SkillDefinition[],
): OpenAI.ChatCompletionTool[] {
  return skills.map(skillToOpenAITool);
}
