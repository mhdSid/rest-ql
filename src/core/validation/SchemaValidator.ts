import { Logger } from "../utils/Logger";
import { Schema, SchemaResource, ValueType, SchemaField } from "../types";
import { SchemaError } from "../validation/errors";

export class SchemaValidator extends Logger {
  private transformers: { [key: string]: Function };
  private schema: Schema;

  constructor(transformers: { [key: string]: Function }) {
    super("SchemaValidator");
    this.transformers = transformers;
    this.schema = {};
  }

  validateSchema(schema: Schema): void {
    this.schema = schema;
    this.log("Starting schema validation");
    for (const [resourceName, resource] of Object.entries(schema)) {
      if (resourceName === "_types") continue;
      this.validateSchemaResource(resourceName, resource, true);
    }

    // Validate nested types
    if (schema._types) {
      this.log("Validating nested types");
      for (const [typeName, type] of Object.entries(schema._types)) {
        this.validateSchemaResource(typeName, type, false);
      }
    }
    this.log("Schema validation completed successfully");
  }

  private validateSchemaResource(
    resourceName: string,
    resource: SchemaResource | ValueType,
    isTopLevel: boolean
  ): void {
    this.log(`Validating resource: ${resourceName}`);
    if (typeof resource !== "object" || resource === null) {
      this.error(`Resource ${resourceName} is not an object`);
      throw new SchemaError(`Resource ${resourceName} must be an object`);
    }

    if (isTopLevel) {
      this.validateTopLevelResource(resourceName, resource as SchemaResource);
    }

    if (typeof resource.fields !== "object" || resource.fields === null) {
      this.error(`Fields for resource ${resourceName} is not an object`);
      throw new SchemaError(
        `Fields for resource ${resourceName} must be an object`
      );
    }

    // Validate fields
    for (const [fieldName, field] of Object.entries(resource.fields)) {
      this.validateField(resourceName, fieldName, field);
    }

    // Validate transform
    if (resource.transform) {
      this.validateResourceTransform(resourceName, resource.transform);
    }
  }

  private validateTopLevelResource(
    resourceName: string,
    resource: SchemaResource
  ): void {
    if (
      !resource.endpoints ||
      typeof resource.endpoints !== "object" ||
      resource.endpoints === null
    ) {
      this.error(`Endpoints for resource ${resourceName} is not an object`);
      throw new SchemaError(
        `Endpoints for resource ${resourceName} must be an object`
      );
    }

    // Validate endpoints
    for (const [method, endpoint] of Object.entries(resource.endpoints)) {
      if (typeof endpoint.path !== "string") {
        this.error(
          `Path for ${method} endpoint of resource ${resourceName} is not a string`
        );
        throw new SchemaError(
          `Path for ${method} endpoint of resource ${resourceName} must be a string`
        );
      }
    }
  }

  private validateField(
    resourceName: string,
    fieldName: string,
    field: SchemaField
  ): void {
    this.log(`Validating field: ${fieldName} in resource ${resourceName}`);
    if (typeof field !== "object" || field === null) {
      this.error(
        `Field ${fieldName} of resource ${resourceName} is not an object`
      );
      throw new SchemaError(
        `Field ${fieldName} of resource ${resourceName} must be an object`
      );
    }

    if (typeof field.type !== "string") {
      this.error(
        `Type of field ${fieldName} of resource ${resourceName} is not a string`
      );
      throw new SchemaError(
        `Type of field ${fieldName} of resource ${resourceName} must be a string`
      );
    }

    if (typeof field.isNullable !== "boolean") {
      this.error(
        `isNullable property of field ${fieldName} of resource ${resourceName} is not a boolean`
      );
      throw new SchemaError(
        `isNullable property of field ${fieldName} of resource ${resourceName} must be a boolean`
      );
    }

    this.validateFieldType(field.type, resourceName, fieldName);

    if (field.from && typeof field.from !== "string") {
      this.error(
        `From property of field ${fieldName} of resource ${resourceName} is not a string`
      );
      throw new SchemaError(
        `From property of field ${fieldName} of resource ${resourceName} must be a string`
      );
    }

    if (field.transform) {
      this.validateFieldTransform(resourceName, fieldName, field.transform);
    }
  }

  private validateFieldType(
    type: string,
    resourceName: string,
    fieldName: string
  ): void {
    const baseTypes = ["Boolean", "String", "Int"];
    let strippedType = type.replace(/[\[\]!]/g, "");

    if (
      !baseTypes.includes(strippedType) &&
      !this.schema[strippedType.toLowerCase()] &&
      !this.schema._types?.[strippedType]
    ) {
      this.error(
        `Invalid type: ${type} for field ${fieldName} in resource ${resourceName}`
      );
      throw new SchemaError(
        `Invalid type: ${type} for field ${fieldName} in resource ${resourceName}`
      );
    }

    // Validate array types
    if (type.includes("[")) {
      this.validateArrayType(type, resourceName, fieldName);
    }

    // Validate nullability
    this.validateNullability(type, resourceName, fieldName);
  }

  private validateArrayType(
    type: string,
    resourceName: string,
    fieldName: string
  ): void {
    const arrayDepth = (type.match(/\[/g) || []).length;
    const closingBrackets = (type.match(/\]/g) || []).length;
    if (arrayDepth !== closingBrackets) {
      this.error(
        `Invalid array type: ${type} for field ${fieldName} in resource ${resourceName}`
      );
      throw new SchemaError(
        `Invalid array type: ${type} for field ${fieldName} in resource ${resourceName}`
      );
    }
  }

  private validateNullability(
    type: string,
    resourceName: string,
    fieldName: string
  ): void {
    if (
      type.endsWith("!") &&
      type.indexOf("[") !== -1 &&
      type.lastIndexOf("]") < type.lastIndexOf("!")
    ) {
      this.error(
        `Invalid nullability placement in array type: ${type} for field ${fieldName} in resource ${resourceName}`
      );
      throw new SchemaError(
        `Invalid nullability placement in array type: ${type} for field ${fieldName} in resource ${resourceName}`
      );
    }
  }

  private validateResourceTransform(
    resourceName: string,
    transform: string
  ): void {
    if (typeof this.transformers[transform] !== "function") {
      this.error(
        `Transform ${transform} for resource ${resourceName} is not a function`
      );
      throw new SchemaError(
        `Transform ${transform} for resource ${resourceName} must be a function`
      );
    }
  }

  private validateFieldTransform(
    resourceName: string,
    fieldName: string,
    transform: string
  ): void {
    if (typeof this.transformers[transform] !== "function") {
      this.error(
        `Transform ${transform} for field ${fieldName} of resource ${resourceName} is not a function`
      );
      throw new SchemaError(
        `Transform ${transform} for field ${fieldName} of resource ${resourceName} must be a function`
      );
    }
  }
}
