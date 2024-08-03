import { RestQLParser } from "./Parser";
import {
  Schema,
  BaseUrls,
  RestQLOptions,
  ParsedOperation,
  VariableValues,
  HttpMethod,
  ParsedQuery,
  SchemaResource,
} from "./types";
import { SDLParser } from "./SDLParser";
import { CacheManager } from "./CacheManager";
import { BatchManager } from "./BatchManager";
import { RestQLExecutor } from "./RestQLExecutor";
import { ValidationError, SchemaError } from "./errors";

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

  constructor(
    sdl: string,
    baseUrls: BaseUrls,
    options: RestQLOptions = {},
    transformers: { [key: string]: Function } = {}
  ) {
    this.baseUrls = baseUrls;
    this.options = {
      cacheTimeout: 5 * 60 * 1000,
      headers: {},
      maxRetries: 3,
      retryDelay: 1000,
      batchInterval: 50,
      ...options,
    };

    this.sdlParser = new SDLParser(sdl);
    try {
      this.schema = this.sdlParser.parseSDL();
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

    this.validateSchema(this.schema);
  }

  async execute(
    operationString: string,
    variables: VariableValues = {}
  ): Promise<any> {
    const parsedOperation = this.queryParser.parse(operationString);

    if (parsedOperation.operationType === "query") {
      return this.executeQuery(parsedOperation, variables);
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
    variables: VariableValues
  ): Promise<any> {
    const results: any = {};

    for (const query of parsedOperation.queries) {
      const resourceSchema = this.schema[query.queryName.toLowerCase()];
      if (!resourceSchema) {
        throw new Error(`Resource "${query.queryName}" not found in schema.`);
      }
      const result = await this.executeQueryField(
        query.queryName,
        query.fields,
        query.args,
        variables,
        resourceSchema
      );
      results[query.queryName] = result;
    }

    return results;
  }

  private async executeQueryField(
    fieldName: string,
    fields: any,
    args: any,
    variables: VariableValues,
    resourceSchema: SchemaResource
  ): Promise<any> {
    if (!resourceSchema.endpoints) {
      throw new Error(`No endpoints defined for resource "${fieldName}".`);
    }

    if (!resourceSchema.endpoints.GET) {
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
      const extractedData = this.extractNestedValue(result, dataPath);

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

  private async executeMutation(
    parsedOperation: ParsedOperation,
    variables: VariableValues
  ): Promise<any> {
    const results: any = {};

    for (const mutation of parsedOperation.queries) {
      const resolvedArgs = this.resolveVariables(mutation.args, variables);
      const result = await this.executor.execute(
        { ...mutation, args: resolvedArgs },
        this.schema[mutation.queryName],
        variables,
        HttpMethod.POST
      );
      const resourceSchema = this.schema[mutation.queryName];
      const dataPath = resourceSchema.dataPath || "";
      const extractedData = this.extractNestedValue(result, dataPath);
      const shapedResult = this.shapeData(
        extractedData,
        mutation,
        resourceSchema
      );

      results[mutation.queryName] = this.cherryPickFields(
        shapedResult,
        mutation.fields
      );
    }

    return results;
  }

  private shapeData(
    data: any,
    query: ParsedQuery,
    resourceSchema: SchemaResource | ValueType
  ): any {
    const shapedData: any = {};

    for (const [fieldName, fieldValue] of Object.entries(query.fields)) {
      const fieldSchema = resourceSchema.fields[fieldName];
      if (!fieldSchema) {
        console.warn(
          `Field schema for "${fieldName}" not found in resource schema.`
        );
        continue;
      }

      // Extract raw value
      const rawValue = this.extractNestedValue(
        data,
        fieldSchema.from || fieldName
      );

      let shapedFieldValue;

      if (typeof fieldValue === "object" && fieldValue !== null) {
        // Handle nested objects and arrays
        if (Array.isArray(rawValue)) {
          const itemType = fieldSchema.type.replace(/[\[\]]/g, "");
          const itemSchema = this.schema._types[itemType];
          shapedFieldValue = this.shapeNestedArrays(
            rawValue,
            fieldValue,
            itemSchema,
            fieldSchema.type
          );
        } else {
          // For nested objects, use the type from the schema to get the correct nested schema
          const nestedType = fieldSchema.type.replace(/[\[\]]/g, "");
          const nestedSchema = this.schema._types[nestedType];
          if (nestedSchema) {
            shapedFieldValue = this.shapeData(
              rawValue,
              { fields: fieldValue },
              nestedSchema
            );
          } else {
            console.warn(`Schema for nested type ${nestedType} not found`);
            shapedFieldValue = rawValue;
          }
        }
      } else {
        shapedFieldValue = rawValue;
      }

      // Apply field-level transformer if defined
      if (fieldSchema.transform && this.transformers[fieldSchema.transform]) {
        console.log(
          `Applying transformer ${fieldSchema.transform} to field ${fieldName}`
        );
        shapedData[fieldName] = this.transformers[fieldSchema.transform](data, {
          [fieldName]: shapedFieldValue,
        })[fieldName];
      } else {
        shapedData[fieldName] = shapedFieldValue;
      }
    }

    // Apply resource-level transformer if defined
    if (
      "transform" in resourceSchema &&
      resourceSchema.transform &&
      this.transformers[resourceSchema.transform]
    ) {
      return this.transformers[resourceSchema.transform](data, shapedData);
    }

    return shapedData;
  }

  private shapeNestedArrays(
    rawValue: any[],
    fieldValue: any,
    itemSchema: SchemaResource | ValueType,
    fieldType: string
  ): any[] {
    const nestedLevel = (fieldType.match(/\[/g) || []).length;

    if (nestedLevel === 1) {
      return rawValue.map((item) =>
        this.shapeData(item, { fields: fieldValue }, itemSchema)
      );
    } else {
      return rawValue.map((item) =>
        this.shapeNestedArrays(
          item,
          fieldValue,
          itemSchema,
          fieldType.slice(1, -1)
        )
      );
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

  private extractNestedValue(data: any, path: string): any {
    return path.split(".").reduce((acc, part) => {
      if (acc == null) return undefined; // Safeguard against undefined intermediate values

      if (part.includes("[") && part.includes("]")) {
        const [arrayName, indexStr] = part.split("[");
        const index = parseInt(indexStr.replace("]", ""), 10);
        return acc && acc[arrayName] && acc[arrayName][index];
      }
      return acc && acc[part];
    }, data);
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

  private validateSchema(schema: Schema): void {
    if (typeof schema !== "object" || schema === null) {
      throw new SchemaError("Schema must be a non-null object");
    }

    for (const [resourceName, resource] of Object.entries(schema)) {
      if (resourceName === "_types") continue;
      this.validateSchemaResource(resourceName, resource);
    }
  }

  private validateSchemaResource(
    resourceName: string,
    resource: SchemaResource
  ): void {
    if (typeof resource !== "object" || resource === null) {
      throw new SchemaError(
        `Resource ${resourceName} must be a non-null object`
      );
    }

    if (typeof resource.fields !== "object" || resource.fields === null) {
      throw new SchemaError(
        `Fields for resource ${resourceName} must be an object`
      );
    }

    if (typeof resource.endpoints !== "object" || resource.endpoints === null) {
      throw new SchemaError(
        `Endpoints for resource ${resourceName} must be an object`
      );
    }

    for (const [method, endpoint] of Object.entries(resource.endpoints)) {
      if (typeof endpoint.path !== "string") {
        throw new SchemaError(
          `Path for ${method} endpoint in resource ${resourceName} must be a string`
        );
      }
    }

    if (
      resource.transform &&
      typeof this.transformers[resource.transform] !== "function"
    ) {
      throw new SchemaError(
        `Transformer ${resource.transform} for resource ${resourceName} is not defined`
      );
    }
  }
}
