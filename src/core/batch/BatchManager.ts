import { Logger } from "../utils/Logger";
import { BatchManagerOptions } from "../types";

export class BatchManager extends Logger {
  private batchInterval: number;
  private queue: { [key: string]: (() => Promise<any>)[] };
  private timer: NodeJS.Timeout | null;
  private maxBatchSize: number;

  constructor({ batchInterval, maxBatchSize = Infinity }: BatchManagerOptions) {
    super("BatchManager");
    this.batchInterval = batchInterval;
    this.queue = {};
    this.timer = null;
    this.maxBatchSize = maxBatchSize;
  }

  add<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (!this.queue[key]) {
      this.queue[key] = [];
    }

    return new Promise<T>((resolve, reject) => {
      this.queue[key].push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (this.queue[key].length >= this.maxBatchSize) {
        this.executeBatch(key);
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.executeBatch(), this.batchInterval);
      }
    });
  }

  private async executeBatch(specificKey?: string): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const keys = specificKey ? [specificKey] : Object.keys(this.queue);

    for (const key of keys) {
      const operations = this.queue[key] || [];
      delete this.queue[key];

      try {
        await Promise.all(operations.map((op) => op()));
      } catch (error) {
        this.error(`Batch execution error for key ${key}:`, error);
      }
    }

    if (Object.keys(this.queue).length > 0) {
      this.timer = setTimeout(() => this.executeBatch(), this.batchInterval);
    }
  }

  cancel(key: string): void {
    delete this.queue[key];
    if (Object.keys(this.queue).length === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
