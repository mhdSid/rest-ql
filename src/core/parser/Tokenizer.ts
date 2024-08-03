import { ValidationError } from "../validation/errors";
import { Token, TokenType } from "../types";

export class Tokenizer {
  private pos = 0;
  private input = "";

  tokenize(input: string): Token[] {
    this.pos = 0;
    this.input = input;
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      switch (char) {
        case "(":
          tokens.push({
            type: TokenType.LEFT_PAREN,
            value: "(",
            pos: this.pos++,
          });
          break;
        case ")":
          tokens.push({
            type: TokenType.RIGHT_PAREN,
            value: ")",
            pos: this.pos++,
          });
          break;
        case "{":
          tokens.push({
            type: TokenType.LEFT_BRACE,
            value: "{",
            pos: this.pos++,
          });
          break;
        case "}":
          tokens.push({
            type: TokenType.RIGHT_BRACE,
            value: "}",
            pos: this.pos++,
          });
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
          tokens.push({
            type: TokenType.EXCLAMATION,
            value: "!",
            pos: this.pos++,
          });
          break;
        default:
          if (/[a-zA-Z0-9_$]/.test(char)) {
            tokens.push(this.tokenizeIdentifier());
          } else if (/\s/.test(char)) {
            this.pos++;
          } else {
            throw new ValidationError(
              `Unexpected character: ${char} at position ${this.pos}`
            );
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
      throw new ValidationError(
        `Unterminated string starting at position ${start}`
      );
    }
    this.pos++;
    return {
      type: TokenType.STRING,
      value: this.input.slice(start, this.pos),
      pos: start,
    };
  }

  private tokenizeIdentifier(): Token {
    const start = this.pos;
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_$]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    return {
      type: TokenType.IDENTIFIER,
      value: this.input.slice(start, this.pos),
      pos: start,
    };
  }
}
