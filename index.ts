import { Schema, BaseUrls, RestQLOptions, EventType, Subscriber, ParsedOperation, ParsedQuery, CompiledOperation, Endpoint, HttpMethod, VariableValues, CacheEntry } from './types';
import { RestQLParser, CacheManager, BatchManager } from './utils';
import { NetworkError, ValidationError, SchemaError } from './errors';

export class RestQL {
  private schema: Schema;
  private baseUrls: BaseUrls;
  private subscribers: { [key in EventType]?: Subscriber[] };
  private pollingIntervals: { [key: string]: number };
  private options: Required<RestQLOptions>;
  private parser: RestQLParser;
  private compiledOperations: Map<string, CompiledOperation>;
  private activeRequests: Set<string>;
  private cacheManager: CacheManager;
  private batchManager: BatchManager;

  constructor(schema: Schema, baseUrls: BaseUrls, options: RestQLOptions = {}) {
    this.validateSchema(schema);
    this.schema = schema;
    this.baseUrls = baseUrls;
    this.subscribers = {};
    this.pollingIntervals = {};
    this.options = {
      cacheTimeout: 5 * 60 * 1000,
      headers: {},
      maxRetries: 3,
      retryDelay: 1000,
      batchInterval: 50,
      ...options,
    };
    this.parser = new RestQLParser();
    this.compiledOperations = new Map();
    this.activeRequests = new Set();
    this.cacheManager = new CacheManager(this.options.cacheTimeout);
    this.batchManager = new BatchManager(this.options.batchInterval);
  }

  async execute(operationString: string, variables: VariableValues = {}): Promise<any> {
    const parsedOperation = this.parser.parse(operationString);
    
    if (parsedOperation.operationType === 'query') {
      return this.executeQuery(parsedOperation, variables);
    } else if (parsedOperation.operationType === 'mutation') {
      return this.executeMutation(parsedOperation, variables);
    } else {
      throw new ValidationError(`Unsupported operation type: ${parsedOperation.operationType}`);
    }
  }

  private async executeQuery(parsedOperation: ParsedOperation, variables: VariableValues): Promise<any> {
    const compiledQueryKey = JSON.stringify({ operation: parsedOperation, variables });
    
    if (this.compiledOperations.has(compiledQueryKey)) {
      return this.compiledOperations.get(compiledQueryKey)!(variables);
    }

    const optimizedQueries = this.optimizeQueries(parsedOperation.queries);
    const results = await this.executeQueries(optimizedQueries, variables);
    const shapedData = this.shapeData(results, optimizedQueries);

    this.notifySubscribers("query", shapedData);
    this.compileOperation(compiledQueryKey, optimizedQueries);

    return shapedData;
  }

  private async executeMutation(parsedOperation: ParsedOperation, variables: VariableValues): Promise<any> {
    const { queries } = parsedOperation;
    if (queries.length !== 1) {
      throw new ValidationError("Mutation must have exactly one operation");
    }

    const mutation = queries[0];
    const { queryName, args, fields } = mutation;
    const endpoint = this.getEndpoint(queryName, "POST");
    const url = this.buildUrl(endpoint.path, {});
    const body = this.resolveVariables(args, variables);

    const response = await this.fetch(url, "POST", body);
    const data = await response.json();

    const shapedData = this.shapeData([data], [mutation]);
    this.notifySubscribers("mutation", shapedData);

    return shapedData[queryName];
  }

  private async executeQueries(queries: ParsedQuery[], variables: VariableValues): Promise<any[]> {
    const results: any[] = [];
    const batchPromises: Promise<any>[] = [];

    for (const query of queries) {
      const { queryName, args, fields } = query;
      const endpoint = this.getEndpoint(queryName, "GET");
      const resolvedArgs = this.resolveVariables(args, variables);
      const url = this.buildUrl(endpoint.path, resolvedArgs);
      const cacheKey = this.getCacheKey(url, resolvedArgs);

      const cachedData = this.cacheManager.get(cacheKey);
      if (cachedData) {
        results.push(cachedData);
      } else {
        batchPromises.push(
          this.batchManager.add(url, async () => {
            const response = await this.fetch(url, "GET");
            const data = await response.json();
            this.cacheManager.set(cacheKey, data);
            return { url, data };
          })
        );
      }
    }

    const batchedResults = await Promise.all(batchPromises);

    for (const { url, data } of batchedResults) {
      results.push(data);
    }

    return results;
  }

  private resolveVariables(args: { [key: string]: string }, variables: VariableValues): { [key: string]: any } {
    const resolved: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const varName = value.slice(1);
        if (!(varName in variables)) {
          throw new ValidationError(`Variable $${varName} is not defined`);
        }
        resolved[key] = variables[varName];
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private compileOperation(key: string, queries: ParsedQuery[]) {
    const compiledOperation = async (variables: VariableValues) => {
      const results = await this.executeQueries(queries, variables);
      return this.shapeData(results, queries);
    };
    this.compiledOperations.set(key, compiledOperation);
  }

  private optimizeQueries(queries: ParsedQuery[]): ParsedQuery[] {
    // Implement query optimization logic here if needed
    return queries;
  }

  private getEndpoint(resourceName: string, method: HttpMethod): Endpoint {
    const resource = this.schema[resourceName];
    if (!resource) {
      throw new SchemaError(`Resource "${resourceName}" not found in schema.`);
    }
    const endpoint = resource.endpoints[method];
    if (!endpoint) {
      throw new SchemaError(
        `Endpoint for method "${method}" not found in resource "${resourceName}".`
      );
    }
    return endpoint;
  }

  private buildUrl(path: string, args: { [key: string]: string }): string {
    let url = this.baseUrls[path] || this.baseUrls.default;
    url += path;
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      queryParams.append(key, value);
    }
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }
    return url;
  }

  private async fetch(
    url: string,
    method: HttpMethod,
    body?: any
  ): Promise<Response> {
    const headers: HeadersInit = { "Content-Type": "application/json", ...this.options.headers };
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new NetworkError(
        `Request to ${url} failed with status ${response.status}`
      );
    }
    return response;
  }

  private shapeData(results: any[], queries: ParsedQuery[]): any {
    const shapedData: any = {};
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const resourceSchema = this.schema[query.queryName];
      const data = this.extractData(results[i], resourceSchema.dataPath);
      shapedData[query.queryName] = this.applyFields(data, query.fields, resourceSchema.fields);
    }
    return shapedData;
  }

  private extractData(data: any, dataPath?: string): any {
    if (!dataPath) return data;
    return dataPath.split('.').reduce((acc, part) => {
      if (part.endsWith(']')) {
        const [key, index] = part.slice(0, -1).split('[');
        return acc && acc[key] && acc[key][parseInt(index, 10)];
      }
      return acc && acc[part];
    }, data);
  }

  private applyFields(data: any, fields: { [key: string]: any }, fieldMappings: { [key: string]: string | { [key: string]: any } }): any {
    const result: any = {};
    for (const key of Object.keys(fields)) {
      const rawKey = fieldMappings[key];
      if (typeof rawKey === "string") {
        result[key] = data[rawKey];
      } else if (typeof rawKey === "object" && typeof fields[key] === "object") {
        const nestedData = data[Object.keys(rawKey)[0]];
        if (Array.isArray(nestedData)) {
          result[key] = nestedData.map((item: any) => this.applyFields(item, fields[key], rawKey[Object.keys(rawKey)[0]]));
        } else {
          result[key] = this.applyFields(nestedData, fields[key], rawKey[Object.keys(rawKey)[0]]);
        }
      } else {
        result[key] = data[key];
      }
    }
    return result;
  }

  private getCacheKey(url: string, args: { [key: string]: string }): string {
    const sortedArgs = Object.keys(args)
      .sort()
      .map((key) => `${key}=${args[key]}`)
      .join("&");
    return `${url}?${sortedArgs}`;
  }

  subscribe(eventType: EventType, subscriber: Subscriber) {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    this.subscribers[eventType]!.push(subscriber);
  }

  private notifySubscribers(eventType: EventType, data: any) {
    if (this.subscribers[eventType]) {
      for (const subscriber of this.subscribers[eventType]!) {
        subscriber(data);
      }
    }
  }

  private validateSchema(schema: Schema): void {
    if (typeof schema !== "object" || schema === null) {
      throw new SchemaError("Schema must be a non-null object");
    }

    Object.keys(schema).forEach((resource) => {
      const resourceSchema = schema[resource];
      if (typeof resourceSchema !== "object" || resourceSchema === null) {
        throw new SchemaError(`Schema for resource ${resource} must be a non-null object`);
      }

      if (typeof resourceSchema.fields !== "object" || resourceSchema.fields === null) {
        throw new SchemaError(`Fields for resource ${resource} must be an object`);
      }

      if (typeof resourceSchema.endpoints !== "object" || resourceSchema.endpoints === null) {
        throw new SchemaError(`Endpoints for resource ${resource} must be a non-null object`);
      }

      Object.keys(resourceSchema.endpoints).forEach((endpoint) => {
        const endpointSchema = resourceSchema.endpoints[endpoint];
        if (typeof endpointSchema !== "object" || endpointSchema === null) {
          throw new SchemaError(`Endpoint ${endpoint} for resource ${resource} must be a non-null object`);
        }

        if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(endpointSchema.method)) {
          throw new SchemaError(`Invalid HTTP method for endpoint ${endpoint} in resource ${resource}`);
        }

        if (typeof endpointSchema.path !== "string") {
          throw new SchemaError(`Path for endpoint ${endpoint} in resource ${resource} must be a string`);
        }
      });
    });
  }
}
