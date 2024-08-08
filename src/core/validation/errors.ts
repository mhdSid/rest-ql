import { Logger } from "../utils/Logger";

export class RestQLError extends Error {
  protected logger: Logger;

  constructor(message: string) {
    super(message);
    this.name = "RestQLError";
    this.logger = new Logger(this.name);
    this.logError();
  }

  protected logError(): void {
    this.logger.error(`${this.name}: ${this.message}`);
    if (this.stack) {
      this.logger.error(`Stack trace: ${this.stack}`);
    }
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
