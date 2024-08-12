/**
 * Logger class for handling contextual logging with debug mode support.
 */
export class Logger {
  private loggerContext: string;
  private isDebugModeEnabled: boolean;
  private logMethod: (...args: any[]) => void;
  private warnMethod: (...args: any[]) => void;
  private errorMethod: (...args: any[]) => void;
  private debugMethod: (...args: any[]) => void;
  private infoMethod: (...args: any[]) => void;

  /**
   * Creates an instance of Logger.
   * @param {string} context - The context identifier for the logger
   * @param {boolean} debugMode - Whether debug mode is enabled
   */
  constructor(context: string, debugMode: boolean) {
    this.loggerContext = context;
    this.isDebugModeEnabled = debugMode;

    if (this.isDebugModeEnabled) {
      this.logMethod = console.log.bind(console, `[${this.loggerContext}]`);
      this.warnMethod = console.warn.bind(console, `[${this.loggerContext}]`);
      this.errorMethod = console.error.bind(console, `[${this.loggerContext}]`);
      this.debugMethod = console.debug.bind(console, `[${this.loggerContext}]`);
      this.infoMethod = console.info.bind(console, `[${this.loggerContext}]`);
    } else {
      const noOp = () => {};
      this.logMethod = this.warnMethod = this.errorMethod = this.debugMethod = this.infoMethod = noOp;
    }
  }

  /**
   * Logs general information messages.
   * @param {...any} messageParts - The parts of the message to log
   */
  log(...messageParts: any[]): void {
    this.logMethod(...messageParts);
  }

  /**
   * Logs warning messages.
   * @param {...any} messageParts - The parts of the warning message to log
   */
  warn(...messageParts: any[]): void {
    this.warnMethod(...messageParts);
  }

  /**
   * Logs error messages.
   * @param {...any} messageParts - The parts of the error message to log
   */
  error(...messageParts: any[]): void {
    this.errorMethod(...messageParts);
  }

  /**
   * Logs debug messages.
   * @param {...any} messageParts - The parts of the debug message to log
   */
  debug(...messageParts: any[]): void {
    this.debugMethod(...messageParts);
  }

  /**
   * Logs informational messages.
   * @param {...any} messageParts - The parts of the info message to log
   */
  info(...messageParts: any[]): void {
    this.infoMethod(...messageParts);
  }
}