import { ValidationError } from './errors';
import { Token, ParsedOperation, TokenType, ParsedQuery, CacheEntry } from './types';

export class Tokenizer {
  private pos: number = 0;
  private input: string = "";

  tokenize(input: string): Token[] {
    this.pos = 0;
    this.input = input;
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      switch (char) {
        case "(":
          tokens.push({ type: TokenType.LEFT_PAREN, value: "(", pos: this.pos++ });
          break;
        case ")":
          tokens.push({ type: TokenType.RIGHT_PAREN, value: ")", pos: this.pos++ });
          break;
        case "{":
          tokens.push({ type: TokenType.LEFT_BRACE, value: "{", pos: this.pos++ });
          break;
        case "}":
          tokens.push({ type: TokenType.RIGHT_BRACE, value: "}", pos: this.pos++ });
          break;
        case ":":
          tokens.push({ type: TokenType.COLON, value: ":", pos: this.pos++ });
          break;
        case ",":
          tokens.push({ type: TokenType.COMMA, value: ",", pos: this.pos++ });
          break;
        case '"':
          tokens.push(this.tokenizeString());
          break;
        case "!":
          tokens.push({ type: TokenType.EXCLAMATION, value: "!", pos: this.pos++ });
          break;
        default:
          if (/[a-zA-Z0-9_$]/.test(char)) {
            tokens.push(this.tokenizeIdentifier());
          } else if (/\s/.test(char)) {
            this.pos++;
          } else {
            throw new ValidationError(`Unexpected character: ${char} at position ${this.pos}`);
          }
      }
    }

    tokens.push({ type: TokenType.EOF, value: "", pos: this.pos });
    return tokens;
  }

  private tokenizeString(): Token {
    const start = this.pos++;
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === "\\") this.pos++;
      this.pos++;
    }
    if (this.pos >= this.input.length) {
      throw new ValidationError(`Unterminated string starting at position ${start}`);
    }
    this.pos++;
    return { type: TokenType.STRING, value: this.input.slice(start, this.pos), pos: start };
  }

  private tokenizeIdentifier(): Token {
    const start = this.pos;
    while (this.pos < this.input.length && /[a-zA-Z0-9_$]/.test(this.input[this.pos])) {
      this.pos++;
    }
    return { type: TokenType.IDENTIFIER, value: this.input.slice(start, this.pos), pos: start };
  }
}

export class RestQLParser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private memoTable: Map<string, ParsedOperation> = new Map();

  parse(queryString: string): ParsedOperation {
    const tokenizer = new Tokenizer();
    this.tokens = tokenizer.tokenize(queryString);
    this.pos = 0;
    
    const memoKey = this.getMemoKey();
    if (this.memoTable.has(memoKey)) {
      return this.memoTable.get(memoKey)!;
    }

    const operationType = this.consume(TokenType.IDENTIFIER).value.toLowerCase();
    const operationName = this.consume(TokenType.IDENTIFIER).value;
    let variables: { [key: string]: string } = {};
    
    if (this.peek().type === TokenType.LEFT_PAREN) {
      variables = this.parseVariables();
    }
    
    this.consume(TokenType.LEFT_BRACE);
    const queries = this.parseQueries();
    this.consume(TokenType.RIGHT_BRACE);

    const parsedOperation: ParsedOperation = { operationType, operationName, variables, queries };
    this.memoTable.set(memoKey, parsedOperation);
    return parsedOperation;
  }

  private parseVariables(): { [key: string]: string } {
    const variables: { [key: string]: string } = {};
    this.consume(TokenType.LEFT_PAREN);
    while (this.peek().type !== TokenType.RIGHT_PAREN) {
      const varName = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.COLON);
      const varType = this.consume(TokenType.IDENTIFIER).value;
      if (this.peek().type === TokenType.EXCLAMATION) {
        this.consume(TokenType.EXCLAMATION);
      }
      variables[varName] = varType;
      if (this.peek().type === TokenType.COMMA) {
        this.consume(TokenType.COMMA);
      }
    }
    this.consume(TokenType.RIGHT_PAREN);
    return variables;
  }

  private parseQueries(): ParsedQuery[] {
    const queries: ParsedQuery[] = [];
    while (this.peek().type !== TokenType.RIGHT_BRACE) {
      queries.push(this.parseQuery());
    }
    return queries;
  }

  private parseQuery(): ParsedQuery {
    const queryName = this.consume(TokenType.IDENTIFIER).value;
    let args: { [key: string]: string } = {};
    let fields: { [key: string]: any } = {};

    if (this.peek().type === TokenType.LEFT_PAREN) {
      args = this.parseArguments();
    }

    fields = this.parseFields();

    return { queryName, args, fields };
  }

  private parseArguments(): { [key: string]: string } {
    const args: { [key: string]: string } = {};
    this.consume(TokenType.LEFT_PAREN);
    while (this.peek().type !== TokenType.RIGHT_PAREN) {
      const key = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.COLON);
      const value = this.parseValue();
      args[key] = value;
      if (this.peek().type === TokenType.COMMA) {
        this.consume(TokenType.COMMA);
      }
    }
    this.consume(TokenType.RIGHT_PAREN);
    return args;
  }

  private parseFields(): { [key: string]: any } {
    const fields: { [key: string]: any } = {};
    this.consume(TokenType.LEFT_BRACE);
    while (this.peek().type !== TokenType.RIGHT_BRACE) {
      const key = this.consume(TokenType.IDENTIFIER).value;
      if (this.peek().type === TokenType.LEFT_BRACE) {
        fields[key] = this.parseFields();
      } else if (this.peek().type === TokenType.LEFT_PAREN) {
        const args = this.parseArguments();
        fields[key] = { args, fields: this.parseFields() };
      } else {
        fields[key] = true;
      }
    }
    this.consume(TokenType.RIGHT_BRACE);
    return fields;
  }

  private parseValue(): string {
    if (this.peek().type === TokenType.STRING) {
      return this.consume(TokenType.STRING).value.replace(/^"|"$/g, "");
    } else if (this.peek().type === TokenType.IDENTIFIER) {
      return `$${this.consume(TokenType.IDENTIFIER).value}`;
    } else {
      throw new Error(`Unexpected token type: ${this.peek().type}`);
    }
  }

  private consume(expected: TokenType): Token {
    if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== expected) {
      throw new Error(`Expected ${TokenType[expected]} but got ${TokenType[this.tokens[this.pos].type]} at position ${this.tokens[this.pos].pos}`);
    }
    return this.tokens[this.pos++];
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private getMemoKey(): string {
    return this.tokens.slice(this.pos).map((t) => t.value).join("");
  }
}

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private cacheTimeout: number;

  constructor(cacheTimeout: number) {
    this.cache = new Map();
    this.cacheTimeout = cacheTimeout;
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTimeout) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export class BatchManager {
  private batchInterval: number;
  private queue: { [key: string]: (() => Promise<any>)[] };
  private timer: number | null;

  constructor(batchInterval: number) {
    this.batchInterval = batchInterval;
    this.queue = {};
    this.timer = null;
  }

  add<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (!this.queue[key]) {
      this.queue[key] = [];
    }

    return new Promise((resolve, reject) => {
      this.queue[key].push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.timer) {
        this.timer = window.setTimeout(() => this.executeBatch(), this.batchInterval);
      }
    });
  }

  private async executeBatch(): Promise<void> {
    const batchedOperations = this.queue;
    this.queue = {};
    this.timer = null;

    for (const key in batchedOperations) {
      const operations = batchedOperations[key];
      await Promise.all(operations.map(op => op()));
    }
  }
}
