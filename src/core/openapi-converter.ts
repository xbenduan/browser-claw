import yaml from 'js-yaml';
import type {
  OpenAPISpec,
  OpenAPIOperation,
  OpenAPIParameter as OAPIParam,
  OpenAPISchema,
  OpenAPIRequestBody,
  ParsedOperation,
  // ParsedParameter — used only in openapi.ts
} from '@/types/openapi';
import type { SkillDefinition, SkillParameter, ResponseExtractor, SkillAPI } from '@/types';

const VALID_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

export function parseOpenAPISpec(input: string): OpenAPISpec {
  let parsed: unknown;
  const trimmed = input.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    parsed = JSON.parse(trimmed);
  } else {
    parsed = yaml.load(trimmed);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid OpenAPI spec: must be a non-null object');
  }

  const spec = parsed as Record<string, unknown>;
  const version = String(spec.openapi ?? '');

  if (!version.startsWith('3.')) {
    throw new Error(`Unsupported OpenAPI version: ${version || 'missing'}. Only 3.x is supported.`);
  }

  return parsed as OpenAPISpec;
}

export function validateOpenAPISpec(spec: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be a non-null object'] };
  }

  const s = spec as Record<string, unknown>;

  if (!s.openapi || typeof s.openapi !== 'string') {
    errors.push('Missing or invalid "openapi" field (expected "3.x.y")');
  } else if (!String(s.openapi).startsWith('3.')) {
    errors.push(`Unsupported OpenAPI version: ${s.openapi}`);
  }

  if (!s.info || typeof s.info !== 'object') {
    errors.push('Missing "info" object');
  } else {
    const info = s.info as Record<string, unknown>;
    if (!info.title || typeof info.title !== 'string') {
      errors.push('Missing "info.title"');
    }
    if (!info.version || typeof info.version !== 'string') {
      errors.push('Missing "info.version"');
    }
  }

  if (!s.paths || typeof s.paths !== 'object') {
    errors.push('Missing "paths" object');
  } else {
    const paths = s.paths as Record<string, unknown>;
    let hasOperations = false;
    for (const [path, methods] of Object.entries(paths)) {
      if (!path.startsWith('/')) {
        errors.push(`Invalid path: "${path}" (must start with /)`);
      }
      if (methods && typeof methods === 'object') {
        for (const method of Object.keys(methods as Record<string, unknown>)) {
          if (VALID_METHODS.includes(method.toLowerCase())) {
            hasOperations = true;
          }
        }
      }
    }
    if (!hasOperations) {
      errors.push('No operations found in "paths"');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function openAPISpecToSkills(spec: OpenAPISpec): SkillDefinition[] {
  const baseUrl = extractBaseUrl(spec);
  const globalHostPatterns = spec.info['x-hostPatterns'] ?? (baseUrl ? [new URL(baseUrl).hostname] : ['*']);
  const globalCategory = spec.info['x-category'] ?? spec.info.title;

  const skills: SkillDefinition[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!VALID_METHODS.includes(method.toLowerCase())) continue;

      const op = operation as OpenAPIOperation;
      if (op.deprecated) continue;

      const skill = operationToSkill(op, method.toUpperCase(), path, baseUrl, globalHostPatterns, globalCategory, spec.info.version);
      skills.push(skill);
    }
  }

  return skills;
}

export function openAPISpecToParsedOperations(spec: OpenAPISpec): ParsedOperation[] {
  const baseUrl = extractBaseUrl(spec);
  const globalHostPatterns = spec.info['x-hostPatterns'] ?? (baseUrl ? [new URL(baseUrl).hostname] : ['*']);
  const globalCategory = spec.info['x-category'] ?? spec.info.title;

  const operations: ParsedOperation[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!VALID_METHODS.includes(method.toLowerCase())) continue;

      const op = operation as OpenAPIOperation;

      operations.push({
        id: generateOperationId(op, method, path),
        name: op.summary || op.operationId || `${method.toUpperCase()} ${path}`,
        description: op.description || op.summary || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        baseUrl,
        parameters: extractParameters(op, spec.components),
        riskLevel: op['x-riskLevel'] ?? 'safe',
        requireConfirm: op['x-requireConfirm'] ?? (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD'),
        category: op['x-category'] ?? globalCategory,
        tags: op['x-tags'] ?? op.tags ?? [],
        hostPatterns: op['x-hostPatterns'] ?? globalHostPatterns,
        extractors: op['x-extractors'] ?? [],
        timeout: op['x-timeout'],
        headers: op['x-headers'],
        version: spec.info.version,
        deprecated: op.deprecated ?? false,
      });
    }
  }

  return operations;
}

function operationToSkill(
  op: OpenAPIOperation,
  method: string,
  path: string,
  baseUrl: string,
  globalHostPatterns: string[],
  globalCategory: string,
  version: string,
): SkillDefinition {
  const parameters = extractParameters(op, undefined);

  return {
    id: generateOperationId(op, method, path),
    name: op.summary || op.operationId || `${method} ${path}`,
    description: op.description || op.summary || `${method} ${path}`,
    version,
    api: {
      method: method as SkillAPI['method'],
      path,
      baseUrl,
      headers: op['x-headers'],
      timeout: op['x-timeout'],
    },
    parameters,
    response: {
      type: 'json',
      extractors: (op['x-extractors'] ?? []) as ResponseExtractor[],
    },
    meta: {
      category: op['x-category'] ?? globalCategory,
      tags: op['x-tags'] ?? op.tags ?? [],
      riskLevel: op['x-riskLevel'] ?? 'safe',
      requireConfirm: op['x-requireConfirm'],
    },
    binding: {
      hostPatterns: op['x-hostPatterns'] ?? globalHostPatterns,
    },
  };
}

function extractBaseUrl(spec: OpenAPISpec): string {
  if (spec.servers && spec.servers.length > 0) {
    let url = spec.servers[0].url;
    if (url.startsWith('/')) {
      url = `https://example.com${url}`;
    }
    return url.replace(/\/+$/, '');
  }
  return '';
}

function generateOperationId(op: OpenAPIOperation, method: string, path: string): string {
  if (op.operationId) return op.operationId.replace(/[^a-zA-Z0-9_]/g, '_');

  const segments = path
    .replace(/^\//, '')
    .split('/')
    .map((s) => {
      s = s.replace(/[{}]/g, '');
      return s.replace(/[^a-zA-Z0-9]/g, '_');
    })
    .filter(Boolean);

  return [method.toLowerCase(), ...segments].join('_');
}

function extractParameters(op: OpenAPIOperation, _components?: unknown): SkillParameter[] {
  const params: SkillParameter[] = [];

  if (op.parameters) {
    for (const p of op.parameters) {
      params.push(openAPIParamToSkillParam(p));
    }
  }

  if (op.requestBody) {
    const bodyParams = extractBodyParameters(op.requestBody);
    params.push(...bodyParams);
  }

  return params;
}

function openAPIParamToSkillParam(p: OAPIParam): SkillParameter {
  const schema = p.schema ?? {};
  const param: SkillParameter = {
    name: p.name,
    type: schemaTypeToSkillType(schema),
    location: p.in === 'cookie' ? 'header' : p.in,
    required: p.required ?? false,
    description: p.description ?? schema.description ?? '',
  };

  if (schema.enum) param.enum = schema.enum;
  if (schema.default !== undefined) param.default = schema.default;
  if (p.example !== undefined) param.example = p.example;
  else if (schema.example !== undefined) param.example = schema.example;

  const validation: SkillParameter['validation'] = {};
  if (schema.minimum !== undefined) validation.min = schema.minimum;
  if (schema.maximum !== undefined) validation.max = schema.maximum;
  if (schema.minLength !== undefined) validation.minLength = schema.minLength;
  if (schema.maxLength !== undefined) validation.maxLength = schema.maxLength;
  if (schema.pattern) validation.pattern = schema.pattern;
  if (Object.keys(validation).length > 0) param.validation = validation;

  if (schema.type === 'object' && schema.properties) {
    param.properties = Object.entries(schema.properties).map(([name, propSchema]) => ({
      name,
      type: schemaTypeToSkillType(propSchema),
      location: 'body' as const,
      required: (schema.required ?? []).includes(name),
      description: propSchema.description ?? '',
    }));
  }

  if (schema.type === 'array' && schema.items) {
    param.items = {
      type: schemaTypeToSkillType(schema.items),
      description: schema.items.description ?? '',
    };
  }

  return param;
}

function extractBodyParameters(requestBody: OpenAPIRequestBody): SkillParameter[] {
  const params: SkillParameter[] = [];

  for (const [contentType, mediaType] of Object.entries(requestBody.content ?? {})) {
    const schema = mediaType.schema;
    if (!schema) continue;

    if (contentType.includes('json') && schema.type === 'object' && schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const param: SkillParameter = {
          name,
          type: schemaTypeToSkillType(propSchema),
          location: 'body',
          required: (schema.required ?? []).includes(name),
          description: propSchema.description ?? '',
        };

        if (propSchema.enum) param.enum = propSchema.enum;
        if (propSchema.default !== undefined) param.default = propSchema.default;
        if (propSchema.example !== undefined) param.example = propSchema.example;

        const validation: SkillParameter['validation'] = {};
        if (propSchema.minimum !== undefined) validation.min = propSchema.minimum;
        if (propSchema.maximum !== undefined) validation.max = propSchema.maximum;
        if (propSchema.minLength !== undefined) validation.minLength = propSchema.minLength;
        if (propSchema.maxLength !== undefined) validation.maxLength = propSchema.maxLength;
        if (propSchema.pattern) validation.pattern = propSchema.pattern;
        if (Object.keys(validation).length > 0) param.validation = validation;

        params.push(param);
      }
    } else if (contentType.includes('json')) {
      params.push({
        name: 'body',
        type: schemaTypeToSkillType(schema),
        location: 'body',
        required: requestBody.required ?? true,
        description: schema.description ?? requestBody.description ?? 'Request body',
      });
    }
  }

  return params;
}

function schemaTypeToSkillType(schema: OpenAPISchema): SkillParameter['type'] {
  if (schema.type === 'integer') return 'number';
  return (schema.type as SkillParameter['type']) ?? 'string';
}

export function skillToOpenAPISpec(skill: SkillDefinition): OpenAPISpec {
  const operation: OpenAPIOperation = {
    operationId: skill.id,
    summary: skill.name,
    description: skill.description,
    parameters: skill.parameters
      .filter((p) => p.location !== 'body')
      .map(skillParamToOpenAPIParam),
    responses: {
      '200': { description: 'Successful response' },
    },
  };

  const bodyParams = skill.parameters.filter((p) => p.location === 'body');
  if (bodyParams.length > 0) {
    operation.requestBody = {
      required: bodyParams.some((p) => p.required),
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              bodyParams.map((p) => [p.name, skillParamToSchema(p)])
            ),
            required: bodyParams.filter((p) => p.required).map((p) => p.name),
          },
        },
      },
    };
  }

  if (skill.meta.riskLevel && skill.meta.riskLevel !== 'safe') {
    operation['x-riskLevel'] = skill.meta.riskLevel;
  }
  if (skill.meta.requireConfirm) {
    operation['x-requireConfirm'] = true;
  }
  if (skill.meta.category) {
    operation['x-category'] = skill.meta.category;
  }
  if (skill.meta.tags?.length) {
    operation['x-tags'] = skill.meta.tags;
    operation.tags = skill.meta.tags;
  }
  if (skill.binding.hostPatterns.length > 0) {
    operation['x-hostPatterns'] = skill.binding.hostPatterns;
  }
  if (skill.response.extractors?.length) {
    operation['x-extractors'] = skill.response.extractors;
  }
  if (skill.api.timeout) {
    operation['x-timeout'] = skill.api.timeout;
  }
  if (skill.api.headers && Object.keys(skill.api.headers).length > 0) {
    operation['x-headers'] = skill.api.headers;
  }

  const servers: OpenAPISpec['servers'] = [];
  if (skill.api.baseUrl) {
    servers.push({ url: skill.api.baseUrl });
  }

  const infoHostPatterns = skill.binding.hostPatterns.length > 0 ? skill.binding.hostPatterns : undefined;
  const infoCategory = skill.meta.category;

  return {
    openapi: '3.1.0',
    info: {
      title: skill.name,
      version: skill.version,
      description: skill.description,
      'x-hostPatterns': infoHostPatterns,
      'x-category': infoCategory,
    },
    servers: servers.length > 0 ? servers : undefined,
    paths: {
      [skill.api.path]: {
        [skill.api.method.toLowerCase()]: operation,
      },
    },
  };
}

function skillParamToOpenAPIParam(p: SkillParameter): OAPIParam {
  return {
    name: p.name,
    in: p.location as 'path' | 'query' | 'header',
    required: p.required,
    description: p.description,
    schema: skillParamToSchema(p),
    example: p.example,
  };
}

function skillParamToSchema(p: SkillParameter | Omit<SkillParameter, 'name' | 'location' | 'required'>): OpenAPISchema {
  const schema: OpenAPISchema = {
    type: p.type === 'number' ? 'number' : p.type,
    description: p.description,
  };

  if ('enum' in p && p.enum) schema.enum = p.enum;
  if ('default' in p && p.default !== undefined) schema.default = p.default;
  if ('example' in p && p.example !== undefined) schema.example = p.example;

  if ('validation' in p && p.validation) {
    if (p.validation.min !== undefined) schema.minimum = p.validation.min;
    if (p.validation.max !== undefined) schema.maximum = p.validation.max;
    if (p.validation.minLength !== undefined) schema.minLength = p.validation.minLength;
    if (p.validation.maxLength !== undefined) schema.maxLength = p.validation.maxLength;
    if (p.validation.pattern) schema.pattern = p.validation.pattern;
  }

  if ('properties' in p && p.properties) {
    schema.type = 'object';
    schema.properties = Object.fromEntries(
      p.properties.map((sub) => [sub.name, skillParamToSchema(sub)])
    );
    schema.required = p.properties.filter((s) => s.required).map((s) => s.name);
  }

  if ('items' in p && p.items) {
    schema.type = 'array';
    schema.items = skillParamToSchema(p.items);
  }

  return schema;
}
