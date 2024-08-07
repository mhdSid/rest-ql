import { RestQLParser } from "./parser/Parser";
import {
  Schema,
  BaseUrls,
  RestQLOptions,
  ParsedOperation,
  VariableValues,
  HttpMethod,
  ParsedQuery,
  SchemaResource,
  ValueType,
} from "./types";
import { SDLParser } from "./parser/SDLParser";
import { CacheManager } from "./cache/CacheManager";
import { BatchManager } from "./batch/BatchManager";
import { RestQLExecutor } from "./executor/RestQLExecutor";
import { ValidationError } from "./validation/errors";
import { SchemaValidator } from "./validation/SchemaValidator";
import lodashGet from "lodash.get";

export class RestQL {
  private schema: Schema;
  private baseUrls: BaseUrls;
  private options: Required<RestQLOptions>;
  private sdlParser: SDLParser;
  private queryParser: RestQLParser;
  private cacheManager: CacheManager;
  private batchManager: BatchManager;
  private executor: RestQLExecutor;
  private transformers: { [key: string]: Function };
  private schemaValidator: SchemaValidator;
  private debugMode: boolean;

  constructor(
    sdl: string,
    baseUrls: BaseUrls,
    options: RestQLOptions = {},
    transformers: { [key: string]: Function } = {},
    debugMode: boolean = false
  ) {
    this.baseUrls = baseUrls;
    this.options = {
      cacheTimeout: 5 * 60 * 1000,
      headers: {},
      maxRetries: 3,
      retryDelay: 1000,
      batchInterval: 50,
      maxBatchSize: Infinity,
      ...options,
    };
    this.schemaValidator = new SchemaValidator(transformers);
    this.debugMode = debugMode;

    this.sdlParser = new SDLParser(sdl);
    try {
      this.schema = this.sdlParser.parseSDL();
      this.schemaValidator.validateSchema(this.schema);
    } catch (error) {
      throw error;
    }

    this.queryParser = new RestQLParser();
    this.cacheManager = new CacheManager(this.options.cacheTimeout);
    this.batchManager = new BatchManager(
      this.options.batchInterval,
      this.options.maxBatchSize
    );
    this.executor = new RestQLExecutor(baseUrls, this.options.headers);
    this.transformers = transformers;
  }

  private log(...args: any[]) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  async execute(
    operationString: string,
    variables: { [key: string]: any } = {},
    options: { useCache?: boolean } = {}
  ): Promise<any | any[]> {
    const parsedOperation = this.queryParser.parse(operationString);
    if (parsedOperation.operationType === "query") {
      const result = await this.executeQuery(
        parsedOperation,
        variables,
        options.useCache ?? true
      );
      return result.shapedData;
    } else if (parsedOperation.operationType === "mutation") {
      const result = await this.executeMutation(parsedOperation, variables);
      return result;
    } else {
      throw new ValidationError(
        `Unsupported operation type: ${parsedOperation.operationType}`
      );
    }
  }

  private async executeQuery(
    parsedOperation: ParsedOperation,
    variables: VariableValues,
    useCache: boolean
  ): Promise<{ shapedData: any; rawResponses: { [key: string]: any } }> {
    const results: any = {};
    const rawResponses: { [key: string]: any } = {};
    const batchPromises: Promise<void>[] = [];

    for (const query of parsedOperation.queries) {
      const resourceSchema = this.schema[query.queryName.toLowerCase()];
      if (!resourceSchema) {
        throw new Error(`Resource "${query.queryName}" not found in schema.`);
      }

      const cacheKey = this.getCacheKey(query.queryName, query.args, variables);
      if (useCache && this.cacheManager.has(cacheKey)) {
        const cachedResult = this.cacheManager.get(cacheKey);
        results[query.queryName] = cachedResult.shapedData;
        rawResponses[query.queryName] = cachedResult.rawResponse;
      } else {
        batchPromises.push(
          this.batchManager.add(query.queryName, async () => {
            const result = await this.executeQueryField(
              query.queryName,
              query.fields,
              query.args,
              variables,
              resourceSchema
            );
            results[query.queryName] = result.shapedData;
            rawResponses[query.queryName] = result.rawResponse;

            if (useCache) {
              this.cacheManager.set(cacheKey, result);
            }
          })
        );
      }
    }

    await Promise.all(batchPromises);
    return { shapedData: results, rawResponses };
  }

  private async executeMutation(
    parsedOperation: ParsedOperation,
    variables: VariableValues
  ): Promise<any[]> {
    const results: any[] = [];
    const batchPromises: Promise<void>[] = [];

    for (const mutation of parsedOperation.queries) {
      batchPromises.push(
        this.batchManager.add(mutation.queryName, async () => {
          const [operationType, resourceName] = this.parseMutationType(
            mutation.queryName
          );
          const resourceSchema = this.schema[resourceName.toLowerCase()];
          if (!resourceSchema) {
            throw new Error(`Resource "${resourceName}" not found in schema.`);
          }

          const method = this.getHttpMethodForOperation(operationType);
          const endpoint = resourceSchema.endpoints[method];
          if (!endpoint) {
            throw new Error(
              `${method} endpoint not found for resource "${resourceName}".`
            );
          }

          const result = await this.executor.execute(
            mutation,
            resourceSchema,
            variables,
            method
          );
          const dataPath = resourceSchema.dataPath || "";
          const extractedData = this.extractNestedValue(result, dataPath);
          const shapedResult = await this.shapeData(
            extractedData,
            mutation,
            resourceSchema,
            variables
          );

          const pickedResult = this.cherryPickFields(
            shapedResult,
            mutation.fields
          );
          results.push(pickedResult);
        })
      );
    }

    await Promise.all(batchPromises);
    return results;
  }

  private parseMutationType(mutationName: string): [string, string] {
    const operationTypes = ["create", "update", "patch", "delete"];
    for (const opType of operationTypes) {
      if (mutationName.toLowerCase().startsWith(opType)) {
        return [opType, mutationName.slice(opType.length)];
      }
    }
    throw new Error(`Unknown mutation type: ${mutationName}`);
  }

  private getHttpMethodForOperation(operationType: string): HttpMethod {
    switch (operationType) {
      case "create":
        return HttpMethod.POST;
      case "update":
        return HttpMethod.PUT;
      case "patch":
        return HttpMethod.PATCH;
      case "delete":
        return HttpMethod.DELETE;
      default:
        throw new Error(`Unsupported operation type: ${operationType}`);
    }
  }

  private cherryPickFields(data: any, fields: any): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const result: any = {};

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (typeof fieldValue === "object" && fieldValue !== null) {
        if (fieldValue.value === true) {
          result[fieldName] = data[fieldName];
        } else if (fieldValue.fields) {
          if (Array.isArray(data[fieldName])) {
            result[fieldName] = data[fieldName].map((item: any) =>
              this.cherryPickFields(item, fieldValue.fields)
            );
          } else if (
            typeof data[fieldName] === "object" &&
            data[fieldName] !== null
          ) {
            result[fieldName] = this.cherryPickFields(
              data[fieldName],
              fieldValue.fields
            );
          } else {
            result[fieldName] = data[fieldName];
          }
        }
      } else if (fieldValue === true) {
        result[fieldName] = data[fieldName];
      }
    }
    return result;
  }

  private async shapeData(
    data: any,
    query: ParsedQuery,
    resourceSchema: SchemaResource | ValueType,
    variables: VariableValues,
    rawResponses: { [key: string]: any } = {}
  ): Promise<any> {
    if (Array.isArray(data)) {
      return Promise.all(
        data.map((item) =>
          this.shapeData(item, query, resourceSchema, variables, rawResponses)
        )
      );
    }

    const shapedData: any = {};

    for (const [fieldName, fieldValue] of Object.entries(query.fields)) {
      const fieldSchema = resourceSchema.fields?.[fieldName];
      if (!fieldSchema) {
        console.warn(
          `Field schema for "${fieldName}" not found in resource schema. Skipping.`
        );
        continue;
      }

      const fromPath = fieldSchema.from || fieldName;
      let rawValue = this.extractNestedValue(data, fromPath);

      if (
        fieldSchema.isResource ||
        this.schema[fieldSchema.type.toLowerCase()]
      ) {
        const nestedResourceSchema =
          this.schema[fieldSchema.type.toLowerCase()];
        if (nestedResourceSchema) {
          try {
            const nestedQuery = {
              queryName: fieldName,
              args: fieldValue.args || {},
              fields: fieldValue.fields,
            };
            const nestedResult = await this.executeQueryField(
              fieldName,
              nestedQuery.fields,
              nestedQuery.args,
              variables,
              nestedResourceSchema
            );
            rawValue = nestedResult.shapedData;
          } catch (error) {
            rawValue = null;
          }
        }
      } else if (typeof fieldValue === "object" && fieldValue.fields) {
        const nestedType = fieldSchema.type.replace(/[\[\]]/g, "");
        const nestedSchema = this.schema._types[nestedType];
        if (nestedSchema) {
          const nestedResult = await this.shapeData(
            rawValue,
            { fields: fieldValue.fields },
            nestedSchema,
            variables,
            rawResponses
          );
          rawValue = nestedResult;
        } else {
          console.warn(`Schema not found for nested type: ${nestedType}`);
        }
      }

      if (fieldSchema.transform && this.transformers[fieldSchema.transform]) {
        const transformedValue = this.transformers[fieldSchema.transform](
          data,
          {
            [fieldName]: rawValue,
          },
          rawResponses
        );
        shapedData[fieldName] = transformedValue;
      } else {
        shapedData[fieldName] = rawValue;
      }
    }

    if (
      "transform" in resourceSchema &&
      resourceSchema.transform &&
      this.transformers[resourceSchema.transform]
    ) {
      const finalTransformedData = this.transformers[resourceSchema.transform](
        data,
        shapedData,
        rawResponses
      );
      return finalTransformedData;
    }

    return shapedData;
  }

  private async executeQueryField(
    fieldName: string,
    fields: any,
    args: any,
    variables: VariableValues,
    resourceSchema: SchemaResource
  ): Promise<{ shapedData: any; rawResponse: any }> {
    if (!resourceSchema.endpoints) {
      console.error(`No endpoints defined for resource "${fieldName}".`);
      throw new Error(`No endpoints defined for resource "${fieldName}".`);
    }

    if (!resourceSchema.endpoints.GET) {
      console.error(`GET endpoint not found for resource "${fieldName}".`);
      throw new Error(`GET endpoint not found for resource "${fieldName}".`);
    }

    const endpoint = resourceSchema.endpoints.GET;
    const resolvedArgs = this.resolveVariables(args, variables);

    try {
      const result = await this.executor.execute(
        { queryName: fieldName, fields, args: resolvedArgs },
        resourceSchema,
        variables,
        HttpMethod.GET
      );

      const dataPath = resourceSchema.dataPath || "";
      let extractedData = this.extractNestedValue(result, dataPath);

      const shapedResult = await this.shapeData(
        extractedData,
        { fields },
        resourceSchema,
        variables,
        { [fieldName]: result }
      );
      return { shapedData: shapedResult, rawResponse: result };
    } catch (error) {
      console.error(`Error executing query for ${fieldName}:`, error);
      throw error;
    }
  }

  private extractNestedValue(data: any, path: string): any {
    const value = lodashGet(data, path);
    return value;
  }

  private shapeNestedArrays(
    rawValue: any[],
    fieldValue: any,
    itemSchema: SchemaResource | ValueType,
    fieldType: string
  ): any[] {
    const nestedLevel = (fieldType.match(/\[/g) || []).length;

    if (nestedLevel === 1) {
      const shapedArray = rawValue.map((item) =>
        this.shapeData(item, { fields: fieldValue }, itemSchema)
      );
      return shapedArray;
    } else {
      const shapedArray = rawValue.map((item) =>
        this.shapeNestedArrays(
          item,
          fieldValue,
          itemSchema,
          fieldType.slice(1, -1)
        )
      );
      return shapedArray;
    }
  }

  private getCacheKey(
    fieldName: string,
    args: any,
    variables: VariableValues
  ): string {
    const resolvedArgs = this.resolveVariables(args, variables);
    return `${fieldName}:${JSON.stringify(resolvedArgs)}`;
  }

  private resolveVariables(
    args: { [key: string]: string },
    variables: { [key: string]: any }
  ): { [key: string]: any } {
    const resolved: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "string" && value.startsWith("$")) {
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
}
