export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  'x-hostPatterns'?: string[];
  'x-category'?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, { default: string; enum?: string[]; description?: string }>;
}

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
  'x-riskLevel'?: 'safe' | 'moderate' | 'dangerous';
  'x-requireConfirm'?: boolean;
  'x-category'?: string;
  'x-tags'?: string[];
  'x-hostPatterns'?: string[];
  'x-extractors'?: OpenAPIExtractor[];
  'x-timeout'?: number;
  'x-headers'?: Record<string, string>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
  encoding?: Record<string, { contentType?: string; headers?: Record<string, unknown> }>;
}

export interface OpenAPIResponse {
  description?: string;
  headers?: Record<string, OpenAPIParameter>;
  content?: Record<string, OpenAPIMediaType>;
  links?: Record<string, unknown>;
}

export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  enum?: unknown[];
  const?: unknown;

  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean | number;
  exclusiveMaximum?: boolean | number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  multipleOf?: number;

  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  additionalProperties?: boolean | OpenAPISchema;
  items?: OpenAPISchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  not?: OpenAPISchema;

  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;

  $ref?: string;
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  responses?: Record<string, OpenAPIResponse>;
  headers?: Record<string, OpenAPIParameter>;
}

export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
}

export interface OpenAPISecurityRequirement {
  [schemeName: string]: string[];
}

export interface OpenAPITag {
  name: string;
  description?: string;
}

export interface OpenAPIExtractor {
  name: string;
  path: string;
  description?: string;
  transform?: 'count' | 'first' | 'last' | 'flatten' | 'unique';
}

export interface ParsedOperation {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  baseUrl: string;
  parameters: ParsedParameter[];
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  requireConfirm: boolean;
  category: string;
  tags: string[];
  hostPatterns: string[];
  extractors: OpenAPIExtractor[];
  timeout?: number;
  headers?: Record<string, string>;
  version: string;
  deprecated: boolean;
}

export interface ParsedParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  location: 'path' | 'query' | 'body' | 'header';
  required: boolean;
  description: string;
  default?: unknown;
  enum?: unknown[];
  example?: unknown;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  properties?: ParsedParameter[];
  items?: Omit<ParsedParameter, 'name' | 'location' | 'required'>;
}
