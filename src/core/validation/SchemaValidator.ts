import { Schema, SchemaResource } from "../types";
import { SchemaError } from "../validation/errors";

export class SchemaValidator {
  private transformers: { [key: string]: Function };

  constructor(transformers: { [key: string]: Function }) {
    this.transformers = transformers;
  }

  validateSchema(schema: Schema): void {
    for (const [resourceName, resource] of Object.entries(schema)) {
      if (resourceName === "_types") continue;
      this.validateSchemaResource(resourceName, resource, true);
    }

    // Validate nested types
    if (schema._types) {
      for (const [typeName, type] of Object.entries(schema._types)) {
        this.validateSchemaResource(typeName, type, false);
      }
    }
  }

  private validateSchemaResource(
    resourceName: string,
    resource: SchemaResource | ValueType,
    isTopLevel: boolean
  ): void {
    if (typeof resource !== "object" || resource === null) {
      throw new SchemaError(`Resource ${resourceName} must be an object`);
    }

    if (isTopLevel) {
      if (
        !resource.endpoints ||
        typeof resource.endpoints !== "object" ||
        resource.endpoints === null
      ) {
        throw new SchemaError(
          `Endpoints for resource ${resourceName} must be an object`
        );
      }

      // Validate endpoints
      for (const [method, endpoint] of Object.entries(resource.endpoints)) {
        if (typeof endpoint.path !== "string") {
          throw new SchemaError(
            `Path for ${method} endpoint of resource ${resourceName} must be a string`
          );
        }
      }
    }

    if (typeof resource.fields !== "object" || resource.fields === null) {
      throw new SchemaError(
        `Fields for resource ${resourceName} must be an object`
      );
    }

    // Validate fields
    for (const [fieldName, field] of Object.entries(resource.fields)) {
      if (typeof field !== "object" || field === null) {
        throw new SchemaError(
          `Field ${fieldName} of resource ${resourceName} must be an object`
        );
      }

      if (typeof field.type !== "string") {
        throw new SchemaError(
          `Type of field ${fieldName} of resource ${resourceName} must be a string`
        );
      }
    }

    // Validate transform
    if (
      resource.transform &&
      typeof this.transformers[resource.transform] !== "function"
    ) {
      throw new SchemaError(
        `Transform ${resource.transform} for resource ${resourceName} must be a function`
      );
    }
  }
}
