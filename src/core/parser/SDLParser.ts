import {
  Schema,
  SchemaResource,
  ValueType,
  SchemaField,
  Endpoint,
  HttpMethod,
} from "../types";

export class SDLParser {
  private input: string;
  private pos: number;
  private schema: Schema;
  private currentType: SchemaResource | ValueType | null;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
    this.schema = { _types: {} };
    this.currentType = null;
  }

  public parseSDL(): Schema {
    try {
      while (this.pos < this.input.length) {
        this.consumeWhitespace();
        if (this.input.slice(this.pos, this.pos + 4) === "type") {
          this.parseType();
        } else if (this.pos < this.input.length) {
          throw new Error(
            `Unexpected character at position ${this.pos}: ${
              this.input[this.pos]
            }`
          );
        }
      }
      return this.schema;
    } catch (error) {
      throw error;
    }
  }

  private parseType(): void {
    this.consumeToken("type");
    this.consumeWhitespace();
    const typeName = this.parseIdentifier();
    this.consumeWhitespace();
    this.consumeToken("{");

    this.currentType = {
      fields: {},
      endpoints: {},
      transform: undefined,
    };

    this.parseTypeBody();
    this.consumeToken("}");

    if (
      "endpoints" in this.currentType &&
      Object.keys(this.currentType.endpoints).length > 0
    ) {
      this.schema[typeName.toLowerCase()] = this.currentType as SchemaResource;
    } else {
      if ("endpoints" in this.currentType) {
        delete (this.currentType as any).endpoints;
      }
      this.schema._types[typeName] = this.currentType as ValueType;
    }

    this.currentType = null;
  }

  private parseTypeBody(): void {
    while (this.pos < this.input.length) {
      this.consumeWhitespace();

      if (this.peekChar() === "}") {
        break;
      } else if (this.peekChar() === "@") {
        const directive = this.parseDirective();
        if (directive.type === "transform" && this.currentType) {
          this.currentType.transform = directive.value;
        }
      } else {
        this.parseField();
      }
    }
  }

  private parseField(): void {
    const fieldName = this.parseIdentifier();

    this.consumeWhitespace();
    this.consumeToken(":");
    this.consumeWhitespace();
    const fieldType = this.parseFieldType();

    const field: SchemaField = { type: fieldType };

    this.consumeWhitespace();
    while (this.peekChar() === "@") {
      const directive = this.parseDirective();
      if (directive.type === "from") {
        field.from = directive.value;
      } else if (directive.type === "transform") {
        field.transform = directive.value;
      }
    }

    // Check if the field type is a reference to another resource
    if (this.schema._types[fieldType] || this.schema[fieldType.toLowerCase()]) {
      field.isResource = true;
    }

    if (this.currentType) {
      this.currentType.fields[fieldName] = field;
    }
  }
  private parseFieldType(): string {
    let fieldType = "";

    while (this.peekChar() === "[") {
      this.consumeToken("[");
      fieldType += "[";
      this.consumeWhitespace();
    }

    fieldType += this.parseIdentifier();

    while (this.peekChar() === "]") {
      this.consumeToken("]");
      fieldType += "]";
      this.consumeWhitespace();
    }

    return fieldType;
  }

  private parseDirective(): { type: string; value: string } {
    this.consumeToken("@");
    const directiveName = this.parseIdentifier();
    this.consumeWhitespace();
    this.consumeToken("(");

    if (directiveName === "from" || directiveName === "transform") {
      const value = this.parseString();
      this.consumeToken(")");
      return { type: directiveName, value };
    } else if (directiveName === "endpoint") {
      const method = this.parseIdentifier() as HttpMethod;
      this.consumeWhitespace();
      this.consumeToken(",");
      this.consumeWhitespace();
      const path = this.parseString();
      this.consumeWhitespace();
      this.consumeToken(",");
      this.consumeWhitespace();
      const dataPath = this.parseString();
      this.consumeToken(")");

      if (this.currentType && "endpoints" in this.currentType) {
        this.currentType.endpoints[method] = { method, path };
        this.currentType.dataPath = dataPath;
      } else {
        console.warn("No current resource to add endpoint to");
      }

      return { type: "endpoint", value: "" };
    }

    throw new Error(`Unknown directive: @${directiveName}`);
  }

  private parseIdentifier(): string {
    const start = this.pos;
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    if (start === this.pos) {
      throw new Error(`Expected identifier at position ${this.pos}`);
    }
    return this.input.slice(start, this.pos);
  }

  private parseString(): string {
    this.consumeToken('"');
    const start = this.pos;
    while (this.input[this.pos] !== '"') {
      if (this.pos >= this.input.length) {
        throw new Error("Unterminated string");
      }
      this.pos++;
    }
    const value = this.input.slice(start, this.pos);
    this.consumeToken('"');
    return value;
  }

  private consumeToken(expected: string): void {
    this.consumeWhitespace();
    if (this.input.slice(this.pos, this.pos + expected.length) !== expected) {
      throw new Error(
        `Expected "${expected}" but found "${this.input.slice(
          this.pos,
          this.pos + expected.length || 1
        )}"`
      );
    }
    this.pos += expected.length;
  }

  private consumeWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private peekChar(): string {
    return this.pos < this.input.length ? this.input[this.pos] : "";
  }

  private getErrorContext(): string {
    const start = Math.max(0, this.pos - 20);
    const end = Math.min(this.input.length, this.pos + 20);
    return `...${this.input.slice(start, this.pos)}[HERE>${this.input.slice(
      this.pos,
      end
    )}...`;
  }
}
