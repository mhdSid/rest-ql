import { Schema, SchemaResource } from "../types";
import { SchemaError } from "../validation/errors";

export class SchemaValidator {
  private transformers: { [key: string]: Function };

  constructor(transformers: { [key: string]: Function }) {
    this.transformers = transformers;
  }

  validateSchema(schema: Schema): void {
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
