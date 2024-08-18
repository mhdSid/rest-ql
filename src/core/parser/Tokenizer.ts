import { Logger } from '../utils/Logger'
import { ValidationError } from '../validation/errors'
import { Token, TokenType } from '../types'

/**
 * Tokenizer class for breaking down input strings into tokens.
 * @extends Logger
 */
export class Tokenizer extends Logger {
  private currentPosition = 0
  private inputString = ''

  /**
   * Creates an instance of Tokenizer.
   */
  constructor () {
    super('Tokenizer')
  }

  /**
   * Tokenizes the input string into an array of tokens.
   * @param {string} input - The input string to tokenize
   * @returns {Token[]} An array of tokens
   * @throws {ValidationError} If an unexpected character is encountered
   */
  tokenize (input: string): Token[] {
    this.currentPosition = 0
    this.inputString = input
    const tokenList: Token[] = []

    while (this.currentPosition < this.inputString.length) {
      const currentChar = this.inputString[this.currentPosition]
      switch (currentChar) {
        case '(':
          tokenList.push(this.createToken(TokenType.LEFT_PAREN, '('))
          break
        case ')':
          tokenList.push(this.createToken(TokenType.RIGHT_PAREN, ')'))
          break
        case '{':
          tokenList.push(this.createToken(TokenType.LEFT_BRACE, '{'))
          break
        case '}':
          tokenList.push(this.createToken(TokenType.RIGHT_BRACE, '}'))
          break
        case ':':
          tokenList.push(this.createToken(TokenType.COLON, ':'))
          break
        case ',':
          tokenList.push(this.createToken(TokenType.COMMA, ','))
          break
        case '"':
          tokenList.push(this.extractStringToken())
          break
        case '!':
          tokenList.push(this.createToken(TokenType.EXCLAMATION, '!'))
          break
        default:
          if (this.isAlphanumericOrSpecial(currentChar)) {
            tokenList.push(this.extractIdentifierToken())
          } else if (this.isWhitespace(currentChar)) {
            this.currentPosition++
          } else {
            const errorMsg = `Unexpected character: ${currentChar} at position ${this.currentPosition}`
            this.error(errorMsg)
            throw new ValidationError(errorMsg)
          }
      }
    }

    tokenList.push(this.createToken(TokenType.EOF, ''))
    this.log(`Tokenization complete. Total tokens: ${tokenList.length}`)
    return tokenList
  }

  /**
   * Creates a token with the given type and value.
   * @param {TokenType} type - The type of the token
   * @param {string} value - The value of the token
   * @returns {Token} The created token
   * @private
   */
  private createToken (type: TokenType, value: string): Token {
    const token: Token = { type, value, pos: this.currentPosition }
    this.currentPosition += value.length
    this.log(`Created token: ${TokenType[type]} at position ${token.pos}`)
    return token
  }

  /**
   * Extracts a string token from the input.
   * @returns {Token} The extracted string token
   * @throws {ValidationError} If the string is unterminated
   * @private
   */
  private extractStringToken (): Token {
    const startPosition = this.currentPosition++
    while (
      this.currentPosition < this.inputString.length &&
      this.inputString[this.currentPosition] !== '"'
    ) {
      if (this.inputString[this.currentPosition] === '\\') { this.currentPosition++ }
      this.currentPosition++
    }
    if (this.currentPosition >= this.inputString.length) {
      const errorMsg = `Unterminated string starting at position ${startPosition}`
      this.error(errorMsg)
      throw new ValidationError(errorMsg)
    }
    this.currentPosition++
    const value = this.inputString.slice(startPosition, this.currentPosition)
    this.log(`Extracted string token: ${value} at position ${startPosition}`)
    return { type: TokenType.STRING, value, pos: startPosition }
  }

  /**
   * Extracts an identifier token from the input.
   * @returns {Token} The extracted identifier token
   * @private
   */
  private extractIdentifierToken (): Token {
    const startPosition = this.currentPosition
    while (
      this.currentPosition < this.inputString.length &&
      this.isAlphanumericOrSpecial(this.inputString[this.currentPosition])
    ) {
      this.currentPosition++
    }
    const value = this.inputString.slice(startPosition, this.currentPosition)
    this.log(
      `Extracted identifier token: ${value} at position ${startPosition}`
    )
    return { type: TokenType.IDENTIFIER, value, pos: startPosition }
  }

  /**
   * Checks if a character is alphanumeric or a special character ($, _).
   * @param {string} char - The character to check
   * @returns {boolean} True if the character is alphanumeric or special, false otherwise
   * @private
   */
  private isAlphanumericOrSpecial (char: string): boolean {
    return /[a-zA-Z0-9_$]/.test(char)
  }

  /**
   * Checks if a character is whitespace.
   * @param {string} char - The character to check
   * @returns {boolean} True if the character is whitespace, false otherwise
   * @private
   */
  private isWhitespace (char: string): boolean {
    return /\s/.test(char)
  }
}
