import { z } from 'zod';
import { tool, type Tool } from 'ai';
import type { SkillDefinition, SkillParameter } from '@/types';

function paramToZod(param: SkillParameter): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (param.type) {
    case 'string':
      if (param.enum && param.enum.length > 0) {
        schema = z.enum(param.enum as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      if (param.validation?.pattern) {
        schema = (schema as z.ZodString).regex(new RegExp(param.validation.pattern));
      }
      if (param.validation?.minLength !== undefined) {
        schema = (schema as z.ZodString).min(param.validation.minLength);
      }
      if (param.validation?.maxLength !== undefined) {
        schema = (schema as z.ZodString).max(param.validation.maxLength);
      }
      break;
    case 'number':
      schema = z.number();
      if (param.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(param.validation.min);
      }
      if (param.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(param.validation.max);
      }
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array': {
      const itemSchema = param.items
        ? zItemsToZod(param.items)
        : z.unknown();
      schema = z.array(itemSchema);
      break;
    }
    case 'object': {
      if (param.properties && param.properties.length > 0) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const prop of param.properties) {
          shape[prop.name] = paramToZod(prop);
        }
        schema = z.object(shape);
      } else {
        schema = z.record(z.string(), z.unknown());
      }
      break;
    }
    case 'null':
      schema = z.null();
      break;
    default:
      schema = z.string();
  }

  schema = schema.describe(param.description || param.name);

  if (!param.required) {
    schema = schema.optional();
  }

  if (param.default !== undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema = (schema as any).default(param.default);
    } catch {
      // skip if default can't be applied
    }
  }

  return schema;
}

function zItemsToZod(
  items: Omit<SkillParameter, 'name' | 'location' | 'required'>
): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (items.type) {
    case 'string':
      schema = z.string();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      schema = z.array(z.unknown());
      break;
    case 'object':
      schema = z.record(z.string(), z.unknown());
      break;
    default:
      schema = z.string();
  }

  if (items.description) {
    schema = schema.describe(items.description);
  }

  return schema;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function skillToZodSchema(skill: SkillDefinition): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of skill.parameters) {
    shape[param.name] = paramToZod(param);
  }

  return z.object(shape);
}

export function skillToAITool(
  skill: SkillDefinition,
  executeFn: (args: Record<string, unknown>) => Promise<unknown>,
): Tool {
  return tool({
    description: skill.description,
    inputSchema: skillToZodSchema(skill),
    execute: async (args) => executeFn(args as Record<string, unknown>),
  });
}

export function skillsToAITools(
  skills: SkillDefinition[],
  executeFnFactory: (skill: SkillDefinition) => (args: Record<string, unknown>) => Promise<unknown>,
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const skill of skills) {
    tools[skill.id] = skillToAITool(skill, executeFnFactory(skill));
  }

  return tools;
}
