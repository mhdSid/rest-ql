import { Logger } from "../utils/Logger";
import { Tokenizer } from "../parser/Tokenizer";
import {
  Token,
  ParsedOperation,
  TokenType,
  ParsedQuery,
  VariableDefinition,
} from "../types";

export class RestQLParser extends Logger {
  private tokens: Token[] = [];
  private pos = 0;
  private tokenizer: Tokenizer;

  constructor() {
    super("RestQLParser");
    this.tokenizer = new Tokenizer();
  }

  parse(operationString: string): ParsedOperation {
    try {
      this.tokens = this.tokenizer.tokenize(operationString);
      this.pos = 0;

      const operationType = this.parseOperationType();
      const operationName = this.parseOperationName();
      const variables = this.parseVariables();
      const queries = this.parseQueries();

      const parsedOperation: ParsedOperation = {
        operationType,
        operationName,
        variables,
        queries,
      };

      this.log("Parsed operation:", parsedOperation);
      return parsedOperation;
    } catch (error) {
      this.error("Error parsing operation:", error);
      throw error;
    }
  }

  private parseOperationType(): "query" | "mutation" {
    const token = this.consumeToken(TokenType.IDENTIFIER);
    const operationType = token.value.toLowerCase() as "query" | "mutation";
    if (operationType !== "query" && operationType !== "mutation") {
      throw new Error(`Invalid operation type: ${operationType}`);
    }
    return operationType;
  }

  private parseOperationName(): string {
    return this.consumeToken(TokenType.IDENTIFIER).value;
  }

  private parseVariables(): { [key: string]: VariableDefinition } {
    const variables: { [key: string]: VariableDefinition } = {};
    if (this.peek().type === TokenType.LEFT_PAREN) {
      this.consumeToken(TokenType.LEFT_PAREN);

      while (this.peek().type !== TokenType.RIGHT_PAREN) {
        const varName = this.consumeToken(TokenType.IDENTIFIER).value;
        this.consumeToken(TokenType.COLON);
        const varType = this.consumeToken(TokenType.IDENTIFIER).value;
        const isRequired = this.peek().type === TokenType.EXCLAMATION;
        if (isRequired) {
          this.consumeToken(TokenType.EXCLAMATION);
        }
        variables[varName] = { type: varType + (isRequired ? "!" : "") };

        if (this.peek().type === TokenType.COMMA) {
          this.consumeToken(TokenType.COMMA);
        }
      }

      this.consumeToken(TokenType.RIGHT_PAREN);
    }
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

  private parseFields(): { [key: string]: any } {
    const fields: { [key: string]: any } = {};
    this.consumeToken(TokenType.LEFT_BRACE);

    while (this.peek().type !== TokenType.RIGHT_BRACE) {
      const fieldName = this.consumeToken(TokenType.IDENTIFIER).value;

      let fieldArgs = {};
      if (this.peek().type === TokenType.LEFT_PAREN) {
        fieldArgs = this.parseArguments();
      }

      if (this.peek().type === TokenType.LEFT_BRACE) {
        fields[fieldName] = {
          args: fieldArgs,
          fields: this.parseFields(),
        };
      } else {
        fields[fieldName] = {
          args: fieldArgs,
          value: true,
        };
      }

      if (this.peek().type === TokenType.COMMA) {
        this.consumeToken(TokenType.COMMA);
      }
    }

    this.consumeToken(TokenType.RIGHT_BRACE);
    return fields;
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

  private parseValue(): string {
    const token = this.consumeToken(TokenType.IDENTIFIER, TokenType.STRING);
    return token.type === TokenType.IDENTIFIER && token.value.startsWith("$")
      ? token.value
      : token.value;
  }

  private consumeToken(...expectedTypes: TokenType[]): Token {
    if (this.pos >= this.tokens.length) {
      throw new Error("Unexpected end of input");
    }

    const token = this.tokens[this.pos];
    if (!expectedTypes.includes(token.type)) {
      const errorMessage = `Unexpected token: ${token.value} (${
        TokenType[token.type]
      }) at position ${token.pos}. Expected: ${expectedTypes
        .map((t) => TokenType[t])
        .join(" or ")}`;
      this.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.pos++;
    return token;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: "", pos: -1 };
  }
}
