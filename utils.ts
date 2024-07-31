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

import { Token, TokenType, ParsedOperation, ParsedQuery } from './types';

export class RestQLParser {
  private tokens: Token[] = [];
  private pos: number = 0;

  parse(operationString: string): ParsedOperation {
    this.tokens = this.tokenize(operationString);
    this.pos = 0;
    
    const operationType = this.consumeToken(TokenType.IDENTIFIER).value.toLowerCase() as 'query' | 'mutation';
    const operationName = this.consumeToken(TokenType.IDENTIFIER).value;
    
    let variables: { [key: string]: { type: string } } = {};
    if (this.peek().type === TokenType.LEFT_PAREN) {
      variables = this.parseVariables();
    }

    const queries = this.parseQueries();

    return { operationType, operationName, variables, queries };
  }

  private tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;

    while (pos < input.length) {
      if (/\s/.test(input[pos])) {
        pos++;
        continue;
      }

      if (/[a-zA-Z_]/.test(input[pos])) {
        let identifier = '';
        const start = pos;
        while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos])) {
          identifier += input[pos++];
        }
        tokens.push({ type: TokenType.IDENTIFIER, value: identifier, pos: start });
        continue;
      }

      if (input[pos] === '{') {
        tokens.push({ type: TokenType.LEFT_BRACE, value: '{', pos });
        pos++;
        continue;
      }

      if (input[pos] === '}') {
        tokens.push({ type: TokenType.RIGHT_BRACE, value: '}', pos });
        pos++;
        continue;
      }

      if (input[pos] === '(') {
        tokens.push({ type: TokenType.LEFT_PAREN, value: '(', pos });
        pos++;
        continue;
      }

      if (input[pos] === ')') {
        tokens.push({ type: TokenType.RIGHT_PAREN, value: ')', pos });
        pos++;
        continue;
      }

      if (input[pos] === ':') {
        tokens.push({ type: TokenType.COLON, value: ':', pos });
        pos++;
        continue;
      }

      if (input[pos] === ',') {
        tokens.push({ type: TokenType.COMMA, value: ',', pos });
        pos++;
        continue;
      }

      if (input[pos] === '$') {
        tokens.push({ type: TokenType.IDENTIFIER, value: '$' + input[++pos], pos: pos - 1 });
        pos++;
        continue;
      }

      if (input[pos] === '!') {
        tokens.push({ type: TokenType.EXCLAMATION, value: '!', pos });
        pos++;
        continue;
      }

      if (input[pos] === '"') {
        let string = '';
        const start = pos;
        pos++; // Skip opening quote
        while (pos < input.length && input[pos] !== '"') {
          string += input[pos++];
        }
        if (pos < input.length) pos++; // Skip closing quote
        tokens.push({ type: TokenType.STRING, value: string, pos: start });
        continue;
      }

      throw new Error(`Unexpected character at position ${pos}: ${input[pos]}`);
    }

    tokens.push({ type: TokenType.EOF, value: '', pos: input.length });
    return tokens;
  }

  private parseVariables(): { [key: string]: { type: string } } {
    const variables: { [key: string]: { type: string } } = {};
    this.consumeToken(TokenType.LEFT_PAREN);
    
    while (this.peek().type !== TokenType.RIGHT_PAREN) {
      const varName = this.consumeToken(TokenType.IDENTIFIER).value.slice(1); // Remove '$'
      this.consumeToken(TokenType.COLON);
      const varType = this.consumeToken(TokenType.IDENTIFIER).value;
      const isRequired = this.peek().type === TokenType.EXCLAMATION;
      if (isRequired) {
        this.consumeToken(TokenType.EXCLAMATION);
      }
      variables[varName] = { type: varType + (isRequired ? '!' : '') };
      
      if (this.peek().type === TokenType.COMMA) {
        this.consumeToken(TokenType.COMMA);
      }
    }
    
    this.consumeToken(TokenType.RIGHT_PAREN);
    return variables;
  }

  private parseQueries(): ParsedQuery[] {
    const queries: ParsedQuery[] = [];
    this.consumeToken(TokenType.LEFT_BRACE);
    
    while (this.peek().type !== TokenType.RIGHT_BRACE) {
      queries.push(this.parseQuery());
    }
    
    this.consumeToken(TokenType.RIGHT_BRACE);
    return queries;
  }

  private parseQuery(): ParsedQuery {
    const queryName = this.consumeToken(TokenType.IDENTIFIER).value;
    let args: { [key: string]: string } = {};
    
    if (this.peek().type === TokenType.LEFT_PAREN) {
      args = this.parseArguments();
    }
    
    const fields = this.parseFields();
    
    return { queryName, args, fields };
  }

  private parseArguments(): { [key: string]: string } {
    const args: { [key: string]: string } = {};
    this.consumeToken(TokenType.LEFT_PAREN);
    
    while (this.peek().type !== TokenType.RIGHT_PAREN) {
      const argName = this.consumeToken(TokenType.IDENTIFIER).value;
      this.consumeToken(TokenType.COLON);
      const argValue = this.parseValue();
      args[argName] = argValue;
      
      if (this.peek().type === TokenType.COMMA) {
        this.consumeToken(TokenType.COMMA);
      }
    }
    
    this.consumeToken(TokenType.RIGHT_PAREN);
    return args;
  }

  private parseFields(): { [key: string]: any } {
    const fields: { [key: string]: any } = {};
    this.consumeToken(TokenType.LEFT_BRACE);
    
    while (this.peek().type !== TokenType.RIGHT_BRACE) {
      const fieldName = this.consumeToken(TokenType.IDENTIFIER).value;
      
      if (this.peek().type === TokenType.LEFT_BRACE) {
        fields[fieldName] = this.parseFields();
      } else {
        fields[fieldName] = true;
      }
      
      if (this.peek().type === TokenType.COMMA) {
        this.consumeToken(TokenType.COMMA);
      }
    }
    
    this.consumeToken(TokenType.RIGHT_BRACE);
    return fields;
  }

  private parseValue(): string {
    const token = this.consumeToken(TokenType.IDENTIFIER, TokenType.STRING);
    return token.type === TokenType.IDENTIFIER && token.value.startsWith('$')
      ? token.value
      : token.value;
  }

  private consumeToken(...expectedTypes: TokenType[]): Token {
    if (this.pos >= this.tokens.length) {
      throw new Error('Unexpected end of input');
    }
    
    const token = this.tokens[this.pos];
    if (!expectedTypes.includes(token.type)) {
      throw new Error(`Unexpected token: ${token.value} at position ${token.pos}`);
    }
    
    this.pos++;
    return token;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', pos: -1 };
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
