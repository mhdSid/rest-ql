import { Logger } from '../utils/Logger'
import { Tokenizer } from '../parser/Tokenizer'
import {
  Token,
  ParsedOperation,
  TokenType,
  ParsedQuery,
  VariableDefinition
} from '../types'

/**
 * RestQLParser class for parsing RestQL operations.
 * @extends Logger
 */
export class RestQLParser extends Logger {
  private tokenSequence: Token[] = []
  private currentPosition = 0
  private tokenizer: Tokenizer

  /**
   * Creates an instance of RestQLParser.
   */
  constructor () {
    super('RestQLParser')
    this.tokenizer = new Tokenizer()
  }

  /**
   * Parses a RestQL operation string into a structured format.
   * @param {string} operationString - The RestQL operation string to parse
   * @returns {ParsedOperation} The parsed operation structure
   * @throws {Error} If parsing fails
   */
  parse (operationString: string): ParsedOperation {
    try {
      this.tokenSequence = this.tokenizer.tokenize(operationString)
      this.currentPosition = 0

      const operationType = this.extractOperationType()
      const operationName = this.extractOperationName()
      const variables = this.extractVariables()
      const queries = this.extractQueries()

      const parsedOperation: ParsedOperation = {
        operationType,
        operationName,
        variables,
        queries
      }

      this.log('Parsed operation:', parsedOperation)
      return parsedOperation
    } catch (error) {
      this.error('Error parsing operation:', error)
      throw error
    }
  }

  /**
   * Extracts the operation type from the token sequence.
   * @returns {"query" | "mutation"} The operation type
   * @private
   */
  private extractOperationType (): 'query' | 'mutation' {
    const token = this.consumeToken(TokenType.IDENTIFIER)
    const operationType = token.value.toLowerCase() as 'query' | 'mutation'
    if (operationType !== 'query' && operationType !== 'mutation') {
      throw new Error(`Invalid operation type: ${operationType}`)
    }
    return operationType
  }

  /**
   * Extracts the operation name from the token sequence.
   * @returns {string} The operation name
   * @private
   */
  private extractOperationName (): string {
    return this.consumeToken(TokenType.IDENTIFIER).value
  }

  /**
   * Extracts variable definitions from the token sequence.
   * @returns {{ [key: string]: VariableDefinition }} The extracted variables
   * @private
   */
  private extractVariables (): { [key: string]: VariableDefinition } {
    const variables: { [key: string]: VariableDefinition } = {}
    if (this.peekNextToken().type === TokenType.LEFT_PAREN) {
      this.consumeToken(TokenType.LEFT_PAREN)

      while (this.peekNextToken().type !== TokenType.RIGHT_PAREN) {
        const varName = this.consumeToken(TokenType.IDENTIFIER).value.slice(1) // Remove the '$' prefix
        this.consumeToken(TokenType.COLON)
        let varType = this.consumeToken(TokenType.IDENTIFIER).value
        const isRequired = this.peekNextToken().type === TokenType.EXCLAMATION
        if (isRequired) {
          this.consumeToken(TokenType.EXCLAMATION)
          varType += '!'
        }
        variables[varName] = { type: varType, isRequired }
        this.log(
          `Extracted variable: ${varName}, type: ${varType}, required: ${isRequired}`
        )

        if (this.peekNextToken().type === TokenType.COMMA) {
          this.consumeToken(TokenType.COMMA)
        }
      }

      this.consumeToken(TokenType.RIGHT_PAREN)
    }
    this.log('Extracted variables:', variables)
    return variables
  }

  /**
   * Extracts queries from the token sequence.
   * @returns {ParsedQuery[]} The extracted queries
   * @private
   */
  private extractQueries (): ParsedQuery[] {
    const queries: ParsedQuery[] = []
    this.consumeToken(TokenType.LEFT_BRACE)

    while (this.peekNextToken().type !== TokenType.RIGHT_BRACE) {
      queries.push(this.extractSingleQuery())
    }

    this.consumeToken(TokenType.RIGHT_BRACE)
    return queries
  }

  /**
   * Extracts a single query from the token sequence.
   * @returns {ParsedQuery} The extracted query
   * @private
   */
  private extractSingleQuery (): ParsedQuery {
    const queryName = this.consumeToken(TokenType.IDENTIFIER).value
    let args: { [key: string]: string } = {}

    if (this.peekNextToken().type === TokenType.LEFT_PAREN) {
      args = this.extractArguments()
    }

    const fields = this.extractFields()

    return { queryName, args, fields }
  }

  /**
   * Extracts fields from the token sequence.
   * @returns {{ [key: string]: any }} The extracted fields
   * @private
   */
  private extractFields (): { [key: string]: any } {
    const fields: { [key: string]: any } = {}
    this.consumeToken(TokenType.LEFT_BRACE)

    while (this.peekNextToken().type !== TokenType.RIGHT_BRACE) {
      const fieldName = this.consumeToken(TokenType.IDENTIFIER).value

      let fieldArgs = {}
      if (this.peekNextToken().type === TokenType.LEFT_PAREN) {
        fieldArgs = this.extractArguments()
      }

      if (this.peekNextToken().type === TokenType.LEFT_BRACE) {
        fields[fieldName] = {
          args: fieldArgs,
          fields: this.extractFields()
        }
      } else {
        fields[fieldName] = {
          args: fieldArgs,
          value: true
        }
      }

      if (this.peekNextToken().type === TokenType.COMMA) {
        this.consumeToken(TokenType.COMMA)
      }
    }

    this.consumeToken(TokenType.RIGHT_BRACE)
    return fields
  }

  /**
   * Extracts arguments from the token sequence.
   * @returns {{ [key: string]: string }} The extracted arguments
   * @private
   */
  private extractArguments (): { [key: string]: string } {
    const args: { [key: string]: string } = {}
    this.consumeToken(TokenType.LEFT_PAREN)

    while (this.peekNextToken().type !== TokenType.RIGHT_PAREN) {
      const argName = this.consumeToken(TokenType.IDENTIFIER).value
      this.consumeToken(TokenType.COLON)
      const argValue = this.extractValue()
      args[argName] = argValue

      if (this.peekNextToken().type === TokenType.COMMA) {
        this.consumeToken(TokenType.COMMA)
      }
    }

    this.consumeToken(TokenType.RIGHT_PAREN)
    return args
  }

  /**
   * Extracts a value from the token sequence.
   * @returns {string} The extracted value
   * @private
   */
  private extractValue (): string {
    const token = this.consumeToken(TokenType.IDENTIFIER, TokenType.STRING)
    return token.type === TokenType.IDENTIFIER && token.value.startsWith('$')
      ? token.value
      : token.value
  }

  /**
   * Consumes a token from the sequence, ensuring it matches the expected types.
   * @param {...TokenType} expectedTypes - The expected token types
   * @returns {Token} The consumed token
   * @throws {Error} If the token doesn't match the expected types or if the end of input is reached
   * @private
   */
  private consumeToken (...expectedTypes: TokenType[]): Token {
    if (this.currentPosition >= this.tokenSequence.length) {
      throw new Error('Unexpected end of input')
    }

    const token = this.tokenSequence[this.currentPosition]
    if (!expectedTypes.includes(token.type)) {
      const errorMessage = `Unexpected token: ${token.value} (${
        TokenType[token.type]
      }) at position ${token.pos}. Expected: ${expectedTypes
        .map((t) => TokenType[t])
        .join(' or ')}`
      this.error(errorMessage)
      throw new Error(errorMessage)
    }

    this.currentPosition++
    return token
  }

  /**
   * Peeks at the next token in the sequence without consuming it.
   * @returns {Token} The next token or an EOF token if the end is reached
   * @private
   */
  private peekNextToken (): Token {
    return (
      this.tokenSequence[this.currentPosition] || {
        type: TokenType.EOF,
        value: '',
        pos: -1
      }
    )
  }
}
