export class RestQLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestQLError";
  }
}

export class NetworkError extends RestQLError {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ValidationError extends RestQLError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class SchemaError extends RestQLError {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}
