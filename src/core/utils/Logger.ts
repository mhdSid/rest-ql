export class Logger {
  private context: string;
  private debugMode: boolean;

  constructor(context: string, debugMode: boolean) {
    this.context = context;
    this.debugMode = this.debugMode ? true : debugMode;
  }

  log(...args: any[]): void {
    if (!this.debugMode) return;
    console.log(`[${this.context}]`, ...args);
  }

  warn(...args: any[]): void {
    if (!this.debugMode) return;
    console.warn(`[${this.context}]`, ...args);
  }

  error(...args: any[]): void {
    if (!this.debugMode) return;
    console.error(`[${this.context}]`, ...args);
  }

  debug(...args: any[]): void {
    if (!this.debugMode) return;
    console.debug(`[${this.context}]`, ...args);
  }

  info(...args: any[]): void {
    if (!this.debugMode) return;
    console.info(`[${this.context}]`, ...args);
  }
}
