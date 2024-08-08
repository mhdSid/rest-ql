export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  log(...args: any[]): void {
    console.log(`[${this.context}]`, ...args);
  }

  warn(...args: any[]): void {
    console.warn(`[${this.context}]`, ...args);
  }

  error(...args: any[]): void {
    console.error(`[${this.context}]`, ...args);
  }

  debug(...args: any[]): void {
    console.debug(`[${this.context}]`, ...args);
  }

  info(...args: any[]): void {
    console.info(`[${this.context}]`, ...args);
  }
}
