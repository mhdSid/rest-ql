export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface Endpoint {
  method: HttpMethod;
  path: string;
}

export interface SchemaFieldMapping {
  [key: string]: string | SchemaFieldMapping;
}

export interface SchemaResource {
  fields: SchemaFieldMapping;
  endpoints: { [key: string]: Endpoint };
  dataPath?: string;
}

export interface Schema {
  [resource: string]: SchemaResource;
}

export interface BaseUrls {
  [resource: string]: string;
  default: string;
}

export interface RestQLOptions {
  cacheTimeout?: number;
  headers?: HeadersInit;
  maxRetries?: number;
  retryDelay?: number;
  batchInterval?: number;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
}

export type EventType = 'query' | 'mutation';

export type Subscriber = (data: any) => void;

export interface ParsedQuery {
  queryName: string;
  args: { [key: string]: string };
  fields: { [key: string]: any };
}

export interface ParsedOperation {
  operationType: 'query' | 'mutation';
  operationName: string;
  variables: { [key: string]: string };
  queries: ParsedQuery[];
}

export type CompiledQuery = () => Promise<any>;

export type VariableValues = { [key: string]: any };

export type CompiledOperation = (variables: VariableValues) => Promise<any>;

export interface PaginationInfo {
  hasNextPage: boolean;
  endCursor: string;
}

export enum TokenType {
  IDENTIFIER = "IDENTIFIER",
  LEFT_BRACE = "LEFT_BRACE",
  RIGHT_BRACE = "RIGHT_BRACE",
  LEFT_PAREN = "LEFT_PAREN",
  RIGHT_PAREN = "RIGHT_PAREN",
  COLON = "COLON",
  COMMA = "COMMA",
  STRING = "STRING",
  EOF = "EOF",
  EXCLAMATION = "EXCLAMATION"
}

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}
