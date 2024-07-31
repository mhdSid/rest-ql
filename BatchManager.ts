export class BatchManager {
  private batchInterval: number;
  private queue: { [key: string]: (() => Promise<any>)[] };
  private timer: number | null;

  constructor(batchInterval: number) {
    this.batchInterval = batchInterval;
    this.queue = {};
    this.timer = null;
  }

  add<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (!this.queue[key]) {
      this.queue[key] = [];
    }

    return new Promise((resolve, reject) => {
      this.queue[key].push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.timer) {
        this.timer = window.setTimeout(() => this.executeBatch(), this.batchInterval);
      }
    });
  }

  private async executeBatch(): Promise<void> {
    const batchedOperations = this.queue;
    this.queue = {};
    this.timer = null;

    for (const key in batchedOperations) {
      const operations = batchedOperations[key];
      await Promise.all(operations.map(op => op()));
    }
  }
}
