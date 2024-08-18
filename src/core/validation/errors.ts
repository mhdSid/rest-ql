/**
 * Base error class for RestQL-related errors.
 * @extends Error
 */
export class RestQLError extends Error {
  /**
   * Creates a new RestQLError instance.
   * @param {string} errorMessage - The error message
   */
  constructor (errorMessage: string) {
    super(errorMessage)
    this.name = 'RestQLError'
  }
}

/**
 * Error class for network-related issues in RestQL.
 * @extends RestQLError
 */
export class NetworkError extends RestQLError {
  /**
   * Creates a new NetworkError instance.
   * @param {string} errorMessage - The error message describing the network issue
   */
  constructor (errorMessage: string) {
    super(errorMessage)
    this.name = 'NetworkError'
  }
}

/**
 * Error class for validation issues in RestQL.
 * @extends RestQLError
 */
export class ValidationError extends RestQLError {
  /**
   * Creates a new ValidationError instance.
   * @param {string} errorMessage - The error message describing the validation issue
   */
  constructor (errorMessage: string) {
    super(errorMessage)
    this.name = 'ValidationError'
  }
}

/**
 * Error class for schema-related issues in RestQL.
 * @extends RestQLError
 */
export class SchemaError extends RestQLError {
  /**
   * Creates a new SchemaError instance.
   * @param {string} errorMessage - The error message describing the schema issue
   */
  constructor (errorMessage: string) {
    super(errorMessage)
    this.name = 'SchemaError'
  }
}
