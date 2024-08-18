import { Logger } from '../utils/Logger'
import {
  Schema,
  SchemaResource,
  ValueType,
  SchemaField,
  HttpMethod
} from '../types'

/**
 * SDLParser class for parsing Schema Definition Language (SDL) input.
 * @extends Logger
 */
export class SDLParser extends Logger {
  private sdlInput: string
  private currentPosition: number
  private parsedSchema: Schema
  private currentTypeDefinition: SchemaResource | ValueType | null

  /**
   * Creates an instance of SDLParser.
   * @param {string} input - The SDL input string to parse
   */
  constructor (input: string) {
    super('SDLParser')
    this.sdlInput = input
    this.currentPosition = 0
    this.parsedSchema = { _types: {} }
    this.currentTypeDefinition = null
  }

  /**
   * Parses the SDL input and returns the resulting schema.
   * @returns {Schema} The parsed schema
   * @throws {Error} If parsing fails
   */
  public parseSDL (): Schema {
    try {
      while (this.currentPosition < this.sdlInput.length) {
        this.skipWhitespace()
        this.log('Current position:', this.currentPosition)
        this.log(
          'Next 10 characters:',
          this.sdlInput.slice(this.currentPosition, this.currentPosition + 10)
        )
        if (
          this.sdlInput.slice(
            this.currentPosition,
            this.currentPosition + 4
          ) === 'type'
        ) {
          this.log('Parsing type')
          this.parseTypeDefinition()
        } else if (this.currentPosition < this.sdlInput.length) {
          const errorMsg = `Unexpected character at position ${
            this.currentPosition
          }: ${this.sdlInput[this.currentPosition]}`
          this.error(errorMsg)
          throw new Error(errorMsg)
        }
      }
      return this.parsedSchema
    } catch (error) {
      this.error('Error parsing SDL:', error)
      this.error('Current position:', this.currentPosition)
      this.error('Context:', this.getErrorContext())
      throw error
    }
  }

  /**
   * Parses a type definition in the SDL.
   * @private
   */
  private parseTypeDefinition (): void {
    this.expectToken('type')
    this.skipWhitespace()
    const typeName = this.parseIdentifier()
    this.skipWhitespace()
    this.expectToken('{')

    this.currentTypeDefinition = {
      fields: {},
      endpoints: {},
      transform: undefined
    }

    this.parseTypeBody()
    this.expectToken('}')

    if (
      'endpoints' in this.currentTypeDefinition &&
      Object.keys(this.currentTypeDefinition.endpoints).length > 0
    ) {
      this.parsedSchema[typeName.toLowerCase()] = this
        .currentTypeDefinition as SchemaResource
    } else {
      if ('endpoints' in this.currentTypeDefinition) {
        delete (this.currentTypeDefinition as any).endpoints
      }
      this.parsedSchema._types[typeName] = this
        .currentTypeDefinition as ValueType
    }

    this.currentTypeDefinition = null
  }

  /**
   * Parses the body of a type definition.
   * @private
   */
  private parseTypeBody (): void {
    while (this.currentPosition < this.sdlInput.length) {
      this.skipWhitespace()

      if (this.peekNextChar() === '}') {
        break
      } else if (this.peekNextChar() === '@') {
        const directive = this.parseDirective()
        if (directive.type === 'transform' && this.currentTypeDefinition) {
          this.currentTypeDefinition.transform = directive.value
        }
      } else {
        this.parseField()
      }
    }
  }

  /**
   * Parses a field definition within a type.
   * @private
   */
  private parseField (): void {
    const fieldName = this.parseIdentifier()

    this.skipWhitespace()
    this.expectToken(':')
    this.skipWhitespace()
    const { fieldType, isNullable } = this.parseFieldType()

    const field: SchemaField = { type: fieldType, isNullable }

    this.skipWhitespace()
    while (this.peekNextChar() === '@') {
      const directive = this.parseDirective()
      if (directive.type === 'from') {
        field.from = directive.value
      } else if (directive.type === 'transform') {
        field.transform = directive.value
      }
    }

    if (this.currentTypeDefinition) {
      this.currentTypeDefinition.fields[fieldName] = field
    }
  }

  /**
   * Parses a field type, including array notations and nullability.
   * @returns {{ fieldType: string; isNullable: boolean }} The parsed field type and nullability
   * @private
   */
  private parseFieldType (): { fieldType: string; isNullable: boolean } {
    let fieldType = ''
    let isNullable = true

    while (this.peekNextChar() === '[') {
      this.expectToken('[')
      fieldType += '['
      this.skipWhitespace()
    }

    fieldType += this.parseIdentifier()

    while (this.peekNextChar() === ']') {
      this.expectToken(']')
      fieldType += ']'
      this.skipWhitespace()
    }

    if (this.peekNextChar() === '!') {
      this.expectToken('!')
      isNullable = false
      fieldType += '!'
    }

    return { fieldType, isNullable }
  }

  /**
   * Parses an identifier.
   * @returns {string} The parsed identifier
   * @private
   */
  private parseIdentifier (): string {
    this.skipWhitespace()
    const start = this.currentPosition
    while (
      this.currentPosition < this.sdlInput.length &&
      /[a-zA-Z0-9_]/.test(this.sdlInput[this.currentPosition])
    ) {
      this.currentPosition++
    }
    if (start === this.currentPosition) {
      const errorMsg = `Expected identifier at position ${
        this.currentPosition
      }. Context: ${this.getErrorContext()}`
      this.error(errorMsg)
      throw new Error(errorMsg)
    }
    return this.sdlInput.slice(start, this.currentPosition)
  }

  /**
   * Parses a directive in the SDL.
   * @returns {{ type: string; value: string }} The parsed directive
   * @private
   */
  private parseDirective (): { type: string; value: string } {
    this.expectToken('@')
    const directiveName = this.parseIdentifier()
    this.skipWhitespace()
    this.expectToken('(')

    if (directiveName === 'from' || directiveName === 'transform') {
      const value = this.parseString()
      this.expectToken(')')
      return { type: directiveName, value }
    } else if (directiveName === 'endpoint') {
      const method = this.parseIdentifier() as HttpMethod
      this.skipWhitespace()
      this.expectToken(',')
      this.skipWhitespace()
      const path = this.parseString()
      this.skipWhitespace()
      this.expectToken(',')
      this.skipWhitespace()
      const dataPath = this.parseString()
      this.expectToken(')')

      if (
        this.currentTypeDefinition &&
        'endpoints' in this.currentTypeDefinition
      ) {
        this.currentTypeDefinition.endpoints[method] = { method, path }
        this.currentTypeDefinition.dataPath = dataPath
      } else {
        this.warn('No current resource to add endpoint to')
      }

      return { type: 'endpoint', value: '' }
    }

    const errorMsg = `Unknown directive: @${directiveName}`
    this.error(errorMsg)
    throw new Error(errorMsg)
  }

  /**
   * Parses a string literal.
   * @returns {string} The parsed string
   * @private
   */
  private parseString (): string {
    this.expectToken('"')
    const start = this.currentPosition
    while (this.sdlInput[this.currentPosition] !== '"') {
      if (this.currentPosition >= this.sdlInput.length) {
        throw new Error('Unterminated string')
      }
      this.currentPosition++
    }
    const value = this.sdlInput.slice(start, this.currentPosition)
    this.expectToken('"')
    return value
  }

  /**
   * Consumes an expected token from the input.
   * @param {string} expected - The expected token
   * @throws {Error} If the expected token is not found
   * @private
   */
  private expectToken (expected: string): void {
    this.skipWhitespace()
    if (
      this.sdlInput.slice(
        this.currentPosition,
        this.currentPosition + expected.length
      ) !== expected
    ) {
      const errorMsg = `Expected "${expected}" but found "${this.sdlInput.slice(
        this.currentPosition,
        this.currentPosition + expected.length || 1
      )}" at position ${
        this.currentPosition
      }. Context: ${this.getErrorContext()}`
      this.error(errorMsg)
      throw new Error(errorMsg)
    }
    this.currentPosition += expected.length
  }

  /**
   * Skips whitespace characters in the input.
   * @private
   */
  private skipWhitespace (): void {
    while (
      this.currentPosition < this.sdlInput.length &&
      /\s/.test(this.sdlInput[this.currentPosition])
    ) {
      this.currentPosition++
    }
  }

  /**
   * Peeks at the next character in the input without consuming it.
   * @returns {string} The next character or an empty string if at the end of input
   * @private
   */
  private peekNextChar (): string {
    return this.currentPosition < this.sdlInput.length
      ? this.sdlInput[this.currentPosition]
      : ''
  }

  /**
   * Gets the context around the current position for error reporting.
   * @returns {string} The context string
   * @private
   */
  private getErrorContext (): string {
    const start = Math.max(0, this.currentPosition - 20)
    const end = Math.min(this.sdlInput.length, this.currentPosition + 20)
    return `...${this.sdlInput.slice(
      start,
      this.currentPosition
    )}[HERE>${this.sdlInput.slice(this.currentPosition, end)}...`
  }
}
