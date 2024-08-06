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
    variables: VariableValues = {},
    options: { useCache?: boolean } = {}
  ): Promise<any | any[]> {
    const { useCache = true } = options;
    const parsedOperation = this.queryParser.parse(operationString);

    if (parsedOperation.operationType === "query") {
      return this.executeQuery(parsedOperation, variables, useCache);
    } else if (parsedOperation.operationType === "mutation") {
      return this.executeMutation(parsedOperation, variables);
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
  ): Promise<any> {
    const results: any = {};
    const batchPromises: Promise<void>[] = [];

    for (const query of parsedOperation.queries) {
      const resourceSchema = this.schema[query.queryName.toLowerCase()];
      if (!resourceSchema) {
        throw new Error(`Resource "${query.queryName}" not found in schema.`);
      }

      const cacheKey = this.getCacheKey(query.queryName, query.args, variables);
      if (useCache && this.cacheManager.has(cacheKey)) {
        results[query.queryName] = this.cacheManager.get(cacheKey);
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
            results[query.queryName] = result;

            if (useCache) {
              this.cacheManager.set(cacheKey, result);
            }
          })
        );
      }
    }

    await Promise.all(batchPromises);
    return results;
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
          const shapedResult = this.shapeData(
            extractedData,
            mutation,
            resourceSchema
          );

          results.push(this.cherryPickFields(shapedResult, mutation.fields));
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

  private async executeQueryField(
    fieldName: string,
    fields: any,
    args: any,
    variables: VariableValues,
    resourceSchema: SchemaResource
  ): Promise<any> {
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

      // Handle the case where extractedData is an array (for top-level fields like Post)
      if (Array.isArray(extractedData)) {
        return Promise.all(
          extractedData.map((item) =>
            this.shapeData(item, { fields }, resourceSchema)
          )
        );
      }

      // Handle nested resources
      for (const [nestedFieldName, nestedFieldValue] of Object.entries(
        fields
      )) {
        const nestedFieldSchema = resourceSchema.fields[nestedFieldName];
        if (nestedFieldSchema && nestedFieldSchema.isResource) {
          const nestedResourceSchema =
            this.schema[nestedFieldSchema.type.toLowerCase()];
          if (nestedResourceSchema) {
            const nestedResult = await this.executeQueryField(
              nestedFieldName,
              nestedFieldValue,
              {},
              variables,
              nestedResourceSchema as SchemaResource
            );
            extractedData[nestedFieldName] = nestedResult;
          } else {
            console.error(
              `Schema not found for nested resource: ${nestedFieldName}`
            );
          }
        }
      }

      const shapedResult = this.shapeData(
        extractedData,
        { fields },
        resourceSchema
      );
      return shapedResult;
    } catch (error) {
      console.error(`Error executing query for ${fieldName}:`, error);
      throw error;
    }
  }

  private async shapeData(
    data: any,
    query: ParsedQuery,
    resourceSchema: SchemaResource | ValueType
  ): Promise<any> {
    // If data is an array, map over it and shape each item
    if (Array.isArray(data)) {
      return Promise.all(
        data.map((item) => this.shapeData(item, query, resourceSchema))
      );
    }

    const shapedData: any = {};

    for (const [fieldName, fieldValue] of Object.entries(query.fields)) {
      const fieldSchema = resourceSchema.fields[fieldName];
      if (!fieldSchema) {
        console.warn(
          `Field schema for "${fieldName}" not found in resource schema.`
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
          if (rawValue === undefined) {
            try {
              rawValue = await this.executeQueryField(
                fieldName,
                fieldValue as any,
                {},
                {},
                nestedResourceSchema as SchemaResource
              );
            } catch (error) {
              console.error(
                `Error fetching nested resource ${fieldName}:`,
                error
              );
              rawValue = null;
            }
          }
          if (rawValue !== null) {
            shapedData[fieldName] = rawValue;
          }
        }
      } else if (typeof fieldValue === "object" && fieldValue !== null) {
        const nestedType = fieldSchema.type.replace(/[\[\]]/g, "");
        const nestedSchema = this.schema._types[nestedType];
        if (nestedSchema) {
          rawValue = await this.shapeData(
            rawValue,
            { fields: fieldValue as any },
            nestedSchema
          );
        } else {
          console.warn(`Schema not found for nested type: ${nestedType}`);
        }
      }

      if (fieldSchema.transform && this.transformers[fieldSchema.transform]) {
        const transformedValue = this.transformers[fieldSchema.transform](
          data,
          {
            [fieldName]: rawValue,
          }
        )[fieldName];
        shapedData[fieldName] = transformedValue;
      } else if (
        !(fieldSchema.isResource || this.schema[fieldSchema.type.toLowerCase()])
      ) {
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
        shapedData
      );
      return finalTransformedData;
    }

    return shapedData;
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

  private cherryPickFields(data: any, fields: any): any {
    const result: any = {};

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (typeof fieldValue === "object" && fieldValue !== null) {
        if (Array.isArray(data[fieldName])) {
          result[fieldName] = data[fieldName].map((item: any) =>
            this.cherryPickFields(item, fieldValue)
          );
        } else {
          result[fieldName] = this.cherryPickFields(
            data[fieldName],
            fieldValue
          );
        }
      } else {
        result[fieldName] = data[fieldName];
      }
    }

    return result;
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
    variables: VariableValues
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
