import { Logger } from "../utils/Logger";
import { ValidationError } from "../validation/errors";
import { Token, TokenType } from "../types";

export class Tokenizer extends Logger {
  private pos = 0;
  private input = "";

  constructor() {
    super("Tokenizer");
  }

  tokenize(input: string): Token[] {
    this.pos = 0;
    this.input = input;
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      switch (char) {
        case "(":
          tokens.push(this.createToken(TokenType.LEFT_PAREN, "("));
          break;
        case ")":
          tokens.push(this.createToken(TokenType.RIGHT_PAREN, ")"));
          break;
        case "{":
          tokens.push(this.createToken(TokenType.LEFT_BRACE, "{"));
          break;
        case "}":
          tokens.push(this.createToken(TokenType.RIGHT_BRACE, "}"));
          break;
        case ":":
          tokens.push(this.createToken(TokenType.COLON, ":"));
          break;
        case ",":
          tokens.push(this.createToken(TokenType.COMMA, ","));
          break;
        case '"':
          tokens.push(this.tokenizeString());
          break;
        case "!":
          tokens.push(this.createToken(TokenType.EXCLAMATION, "!"));
          break;
        default:
          if (/[a-zA-Z0-9_$]/.test(char)) {
            tokens.push(this.tokenizeIdentifier());
          } else if (/\s/.test(char)) {
            this.pos++;
          } else {
            const errorMsg = `Unexpected character: ${char} at position ${this.pos}`;
            this.error(errorMsg);
            throw new ValidationError(errorMsg);
          }
      }
    }

    tokens.push(this.createToken(TokenType.EOF, ""));
    this.log(`Tokenization complete. Total tokens: ${tokens.length}`);
    return tokens;
  }

  private createToken(type: TokenType, value: string): Token {
    const token: Token = { type, value, pos: this.pos };
    this.pos += value.length;
    this.log(`Created token: ${TokenType[type]} at position ${token.pos}`);
    return token;
  }

  private tokenizeString(): Token {
    const start = this.pos++;
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === "\\") this.pos++;
      this.pos++;
    }
    if (this.pos >= this.input.length) {
      const errorMsg = `Unterminated string starting at position ${start}`;
      this.error(errorMsg);
      throw new ValidationError(errorMsg);
    }
    this.pos++;
    const value = this.input.slice(start, this.pos);
    this.log(`Tokenized string: ${value} at position ${start}`);
    return { type: TokenType.STRING, value, pos: start };
  }

  private tokenizeIdentifier(): Token {
    const start = this.pos;
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_$]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    const value = this.input.slice(start, this.pos);
    this.log(`Tokenized identifier: ${value} at position ${start}`);
    return { type: TokenType.IDENTIFIER, value, pos: start };
  }
}
