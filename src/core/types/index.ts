export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export interface Schema {
  [key: string]: SchemaResource;
  _types: { [key: string]: ValueType };
}

export interface SchemaResource {
  fields: { [key: string]: SchemaField };
  endpoints: { [key: string]: Endpoint };
  dataPath?: string;
  transform?: string;
}

export interface ValueType {
  fields: { [key: string]: SchemaField };
  transform?: string;
}

export interface SchemaField {
  type: string; // This can now be like "[[Score]]" for nested arrays
  from?: string;
  transform?: string;
}
export interface Endpoint {
  method: HttpMethod;
  path: string;
}

export interface BaseUrls {
  [key: string]: string;
  default: string;
}

export interface RestQLOptions {
  cacheTimeout?: number;
  headers?: { [key: string]: string };
  maxRetries?: number;
  retryDelay?: number;
  batchInterval?: number;
  maxBatchSize?: number;
}

export interface ParsedOperation {
  operationType: "query" | "mutation";
  operationName: string;
  variables: { [key: string]: { type: string } };
  queries: ParsedQuery[];
}

export interface ParsedQuery {
  queryName: string;
  args: { [key: string]: string };
  fields: { [key: string]: any };
}

export type VariableValues = { [key: string]: any };

export enum TokenType {
  LEFT_PAREN,
  RIGHT_PAREN,
  LEFT_BRACE,
  RIGHT_BRACE,
  COLON,
  COMMA,
  STRING,
  IDENTIFIER,
  EXCLAMATION,
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export type Subscriber = (data: any) => void;

export type EventType = "query" | "mutation";

export type CompiledOperation = (variables: VariableValues) => Promise<any>;

export interface BatchRequest {
  url: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

// You might also want to add these types for completeness:

export interface CacheItem {
  data: any;
  expiry: number;
}

export interface RestQLExecutorOptions {
  baseUrls: BaseUrls;
  headers: { [key: string]: string };
}

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export interface BatchManagerOptions {
  batchInterval: number;
  maxBatchSize?: number;
}

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export interface BatchManagerOptions {
  batchInterval: number;
  maxBatchSize?: number;
}
