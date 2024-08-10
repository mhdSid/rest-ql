import { Logger } from "../utils/Logger";
import { Schema, SchemaResource, ValueType, SchemaField } from "../types";
import { SchemaError } from "../validation/errors";

/**
 * SchemaValidator class for validating RestQL schemas.
 * This class ensures that the provided schema adheres to the expected structure and rules.
 * @extends Logger
 */
export class SchemaValidator extends Logger {
  private transformFunctions: { [key: string]: Function };
  private currentSchema: Schema;

  /**
   * Creates an instance of SchemaValidator.
   * @param {Object.<string, Function>} transformers - A dictionary of transform functions
   */
  constructor(transformers: { [key: string]: Function }) {
    super("SchemaValidator");
    this.transformFunctions = transformers;
    this.currentSchema = {};
  }

  /**
   * Validates the entire schema structure.
   * This method iterates through all resources and nested types in the schema,
   * validating each one individually.
   * @param {Schema} schema - The schema to validate
   * @throws {SchemaError} If any part of the schema is invalid
   */
  validateSchema(schema: Schema): void {
    this.currentSchema = schema;
    this.log("Starting schema validation");
    for (const [resourceName, resource] of Object.entries(schema)) {
      if (resourceName === "_types") continue;
      this.validateSchemaResource(resourceName, resource, true);
    }

    if (schema._types) {
      this.log("Validating nested types");
      for (const [typeName, type] of Object.entries(schema._types)) {
        this.validateSchemaResource(typeName, type, false);
      }
    }
    this.log("Schema validation completed successfully");
  }

  /**
   * Validates a single schema resource or type.
   * This method checks the structure of a resource, including its fields and transforms.
   * @param {string} resourceName - The name of the resource or type
   * @param {SchemaResource | ValueType} resource - The resource or type to validate
   * @param {boolean} isTopLevel - Whether this is a top-level resource
   * @throws {SchemaError} If the resource is invalid
   * @private
   */
  private validateSchemaResource(
    resourceName: string,
    resource: SchemaResource | ValueType,
    isTopLevel: boolean
  ): void {
    this.log(`Validating resource: ${resourceName}`);
    this.ensureResourceIsObject(resourceName, resource);

    if (isTopLevel) {
      this.validateTopLevelResource(resourceName, resource as SchemaResource);
    }

    this.ensureFieldsAreValid(resourceName, resource);

    for (const [fieldName, field] of Object.entries(resource.fields)) {
      this.validateField(resourceName, fieldName, field);
    }

    if (resource.transform) {
      this.validateResourceTransform(resourceName, resource.transform);
    }
  }

  /**
   * Validates a top-level resource in the schema.
   * This method checks the endpoints of a resource.
   * @param {string} resourceName - The name of the resource
   * @param {SchemaResource} resource - The resource to validate
   * @throws {SchemaError} If the resource is invalid
   * @private
   */
  private validateTopLevelResource(
    resourceName: string,
    resource: SchemaResource
  ): void {
    this.ensureEndpointsAreValid(resourceName, resource);

    for (const [method, endpoint] of Object.entries(resource.endpoints)) {
      this.ensureEndpointPathIsString(resourceName, method, endpoint);
    }
  }

  /**
   * Validates a single field in a resource.
   * This method checks the type, nullability, and transform of a field.
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @param {SchemaField} field - The field to validate
   * @throws {SchemaError} If the field is invalid
   * @private
   */
  private validateField(
    resourceName: string,
    fieldName: string,
    field: SchemaField
  ): void {
    this.log(`Validating field: ${fieldName} in resource ${resourceName}`);
    this.ensureFieldIsObject(resourceName, fieldName, field);
    this.ensureFieldTypeIsString(resourceName, fieldName, field);
    this.ensureFieldNullabilityIsBoolean(resourceName, fieldName, field);

    this.validateFieldType(field.type, resourceName, fieldName);

    this.ensureFieldFromIsString(resourceName, fieldName, field);

    if (field.transform) {
      this.validateFieldTransform(resourceName, fieldName, field.transform);
    }
  }

  /**
   * Validates the type of a field.
   * This method checks if the type is a valid base type, custom type, or array type.
   * @param {string} type - The type to validate
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @throws {SchemaError} If the type is invalid
   * @private
   */
  private validateFieldType(
    type: string,
    resourceName: string,
    fieldName: string
  ): void {
    const baseTypes = ["Boolean", "String", "Int"];
    let strippedType = type.replace(/[\[\]!]/g, "");

    if (
      !baseTypes.includes(strippedType) &&
      !this.currentSchema[strippedType.toLowerCase()] &&
      !this.currentSchema._types?.[strippedType]
    ) {
      this.throwInvalidTypeError(type, resourceName, fieldName);
    }

    if (type.includes("[")) {
      this.validateArrayType(type, resourceName, fieldName);
    }

    this.validateNullability(type, resourceName, fieldName);
  }

  /**
   * Validates an array type.
   * This method checks if the array brackets are balanced.
   * @param {string} type - The type to validate
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @throws {SchemaError} If the array type is invalid
   * @private
   */
  private validateArrayType(
    type: string,
    resourceName: string,
    fieldName: string
  ): void {
    const arrayDepth = (type.match(/\[/g) || []).length;
    const closingBrackets = (type.match(/\]/g) || []).length;
    if (arrayDepth !== closingBrackets) {
      this.throwInvalidArrayTypeError(type, resourceName, fieldName);
    }
  }

  /**
   * Validates the nullability of a type.
   * This method checks if the nullability marker (!) is correctly placed.
   * @param {string} type - The type to validate
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @throws {SchemaError} If the nullability is invalid
   * @private
   */
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
      this.throwInvalidNullabilityError(type, resourceName, fieldName);
    }
  }

  /**
   * Validates a resource-level transform function.
   * This method checks if the specified transform function exists.
   * @param {string} resourceName - The name of the resource
   * @param {string} transform - The name of the transform function
   * @throws {SchemaError} If the transform function is invalid
   * @private
   */
  private validateResourceTransform(
    resourceName: string,
    transform: string
  ): void {
    this.ensureTransformIsFunction(transform, resourceName);
  }

  /**
   * Validates a field-level transform function.
   * This method checks if the specified transform function exists.
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @param {string} transform - The name of the transform function
   * @throws {SchemaError} If the transform function is invalid
   * @private
   */
  private validateFieldTransform(
    resourceName: string,
    fieldName: string,
    transform: string
  ): void {
    this.ensureTransformIsFunction(transform, resourceName, fieldName);
  }

  // Helper methods for throwing specific errors

  /**
   * Throws an error for an invalid type.
   * @param {string} type - The invalid type
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @throws {SchemaError} Always throws this error
   * @private
   */
  private throwInvalidTypeError(
    type: string,
    resourceName: string,
    fieldName: string
  ): never {
    const errorMsg = `Invalid type: ${type} for field ${fieldName} in resource ${resourceName}`;
    this.error(errorMsg);
    throw new SchemaError(errorMsg);
  }

  /**
   * Throws an error for an invalid array type.
   * @param {string} type - The invalid array type
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @throws {SchemaError} Always throws this error
   * @private
   */
  private throwInvalidArrayTypeError(
    type: string,
    resourceName: string,
    fieldName: string
  ): never {
    const errorMsg = `Invalid array type: ${type} for field ${fieldName} in resource ${resourceName}`;
    this.error(errorMsg);
    throw new SchemaError(errorMsg);
  }

  /**
   * Throws an error for invalid nullability placement.
   * @param {string} type - The type with invalid nullability
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @throws {SchemaError} Always throws this error
   * @private
   */
  private throwInvalidNullabilityError(
    type: string,
    resourceName: string,
    fieldName: string
  ): never {
    const errorMsg = `Invalid nullability placement in array type: ${type} for field ${fieldName} in resource ${resourceName}`;
    this.error(errorMsg);
    throw new SchemaError(errorMsg);
  }

  // Helper methods for common validation checks

  /**
   * Ensures that a resource is an object.
   * @param {string} resourceName - The name of the resource
   * @param {any} resource - The resource to check
   * @throws {SchemaError} If the resource is not an object
   * @private
   */
  private ensureResourceIsObject(resourceName: string, resource: any): void {
    if (typeof resource !== "object" || resource === null) {
      const errorMsg = `Resource ${resourceName} must be an object`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that the fields of a resource are valid.
   * @param {string} resourceName - The name of the resource
   * @param {any} resource - The resource to check
   * @throws {SchemaError} If the fields are not valid
   * @private
   */
  private ensureFieldsAreValid(resourceName: string, resource: any): void {
    if (typeof resource.fields !== "object" || resource.fields === null) {
      const errorMsg = `Fields for resource ${resourceName} must be an object`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that the endpoints of a resource are valid.
   * @param {string} resourceName - The name of the resource
   * @param {SchemaResource} resource - The resource to check
   * @throws {SchemaError} If the endpoints are not valid
   * @private
   */
  private ensureEndpointsAreValid(
    resourceName: string,
    resource: SchemaResource
  ): void {
    if (
      !resource.endpoints ||
      typeof resource.endpoints !== "object" ||
      resource.endpoints === null
    ) {
      const errorMsg = `Endpoints for resource ${resourceName} must be an object`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that an endpoint path is a string.
   * @param {string} resourceName - The name of the resource
   * @param {string} method - The HTTP method of the endpoint
   * @param {any} endpoint - The endpoint to check
   * @throws {SchemaError} If the path is not a string
   * @private
   */
  private ensureEndpointPathIsString(
    resourceName: string,
    method: string,
    endpoint: any
  ): void {
    if (typeof endpoint.path !== "string") {
      const errorMsg = `Path for ${method} endpoint of resource ${resourceName} must be a string`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that a field is an object.
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @param {any} field - The field to check
   * @throws {SchemaError} If the field is not an object
   * @private
   */
  private ensureFieldIsObject(
    resourceName: string,
    fieldName: string,
    field: any
  ): void {
    if (typeof field !== "object" || field === null) {
      const errorMsg = `Field ${fieldName} of resource ${resourceName} must be an object`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that a field's type is a string.
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @param {SchemaField} field - The field to check
   * @throws {SchemaError} If the type is not a string
   * @private
   */
  private ensureFieldTypeIsString(
    resourceName: string,
    fieldName: string,
    field: SchemaField
  ): void {
    if (typeof field.type !== "string") {
      const errorMsg = `Type of field ${fieldName} of resource ${resourceName} must be a string`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that a field's nullability is a boolean.
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @param {SchemaField} field - The field to check
   * @throws {SchemaError} If the nullability is not a boolean
   * @private
   */
  private ensureFieldNullabilityIsBoolean(
    resourceName: string,
    fieldName: string,
    field: SchemaField
  ): void {
    if (typeof field.isNullable !== "boolean") {
      const errorMsg = `isNullable property of field ${fieldName} of resource ${resourceName} must be a boolean`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that a field's 'from' property is a string if it exists.
   * @param {string} resourceName - The name of the resource
   * @param {string} fieldName - The name of the field
   * @param {SchemaField} field - The field to check
   * @throws {SchemaError} If the 'from' property is not a string
   * @private
   */
  private ensureFieldFromIsString(
    resourceName: string,
    fieldName: string,
    field: SchemaField
  ): void {
    if (field.from && typeof field.from !== "string") {
      const errorMsg = `From property of field ${fieldName} of resource ${resourceName} must be a string`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }

  /**
   * Ensures that a transform function exists and is actually a function.
   * @param {string} transform - The name of the transform function
   * @param {string} resourceName - The name of the resource
   * @param {string} [fieldName] - The name of the field (if applicable)
   * @throws {SchemaError} If the transform is not a function
   * @private
   */
  private ensureTransformIsFunction(
    transform: string,
    resourceName: string,
    fieldName?: string
  ): void {
    if (typeof this.transformFunctions[transform] !== "function") {
      const context = fieldName ? `field ${fieldName} of ` : "";
      const errorMsg = `Transform ${transform} for ${context}resource ${resourceName} must be a function`;
      this.error(errorMsg);
      throw new SchemaError(errorMsg);
    }
  }
}
