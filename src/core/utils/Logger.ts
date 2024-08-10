/**
 * Logger class for handling contextual logging with debug mode support.
 */
export class Logger {
  private loggerContext: string;
  private isDebugModeEnabled: boolean;

  /**
   * Creates an instance of Logger.
   * @param {string} context - The context identifier for the logger
   * @param {boolean} debugMode - Whether debug mode is enabled
   */
  constructor(context: string, debugMode: boolean) {
    this.loggerContext = context;
    this.isDebugModeEnabled = this.isDebugModeEnabled ? true : debugMode;
  }

  /**
   * Logs general information messages.
   * @param {...any} messageParts - The parts of the message to log
   */
  log(...messageParts: any[]): void {
    if (!this.isDebugModeEnabled) return;
    console.log(`[${this.loggerContext}]`, ...messageParts);
  }

  /**
   * Logs warning messages.
   * @param {...any} messageParts - The parts of the warning message to log
   */
  warn(...messageParts: any[]): void {
    if (!this.isDebugModeEnabled) return;
    console.warn(`[${this.loggerContext}]`, ...messageParts);
  }

  /**
   * Logs error messages.
   * @param {...any} messageParts - The parts of the error message to log
   */
  error(...messageParts: any[]): void {
    if (!this.isDebugModeEnabled) return;
    console.error(`[${this.loggerContext}]`, ...messageParts);
  }

  /**
   * Logs debug messages.
   * @param {...any} messageParts - The parts of the debug message to log
   */
  debug(...messageParts: any[]): void {
    if (!this.isDebugModeEnabled) return;
    console.debug(`[${this.loggerContext}]`, ...messageParts);
  }

  /**
   * Logs informational messages.
   * @param {...any} messageParts - The parts of the info message to log
   */
  info(...messageParts: any[]): void {
    if (!this.isDebugModeEnabled) return;
    console.info(`[${this.loggerContext}]`, ...messageParts);
  }
}
