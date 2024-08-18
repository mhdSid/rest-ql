import { Logger } from '../utils/Logger'
import { BatchManagerOptions } from '../types'

/**
 * BatchManager class for managing batched asynchronous operations.
 * @extends Logger
 */
export class BatchManager extends Logger {
  private batchIntervalMs: number
  private operationsByKey: { [key: string]: Array<{ operation: () => Promise<any>, reject: (reason?: any) => void }> }
  private batchTimer: number | null
  private maxOperationsPerBatch: number

  /**
   * Creates an instance of BatchManager.
   * @param {BatchManagerOptions} options - Configuration options for the batch manager
   * @param {number} options.batchInterval - The interval in milliseconds between batch executions
   * @param {number} [options.maxBatchSize=Infinity] - The maximum number of operations per batch
   */
  constructor ({ batchInterval, maxBatchSize = Infinity }: BatchManagerOptions) {
    super('BatchManager')
    this.batchIntervalMs = batchInterval
    this.operationsByKey = {}
    this.batchTimer = null
    this.maxOperationsPerBatch = maxBatchSize
  }

  /**
   * Adds an operation to the batch queue for a specific key.
   * @template T
   * @param {string} key - The identifier for the batch group
   * @param {() => Promise<T>} operation - The asynchronous operation to be executed
   * @returns {Promise<T>} A promise that resolves with the operation's result
   */
  add<T>(key: string, operation: () => Promise<T>): Promise<T> {
    this.ensureKeyExists(key)

    return new Promise<T>((resolve, reject) => {
      const wrappedOperation = this.wrapOperation(operation, resolve, reject)
      this.operationsByKey[key].push({ operation: wrappedOperation, reject })

      this.handleBatchExecution(key)
    })
  }

  /**
   * Executes all pending operations for the specified key or all keys if not specified.
   * @param {string} [specificKey] - Optional key to execute operations for a specific batch
   * @returns {Promise<void>}
   * @private
   */
  private async executeBatch (specificKey?: string): Promise<void> {
    this.clearBatchTimer()

    const keysToProcess = specificKey
      ? [specificKey]
      : Object.keys(this.operationsByKey)

    for (const key of keysToProcess) {
      await this.processBatchForKey(key)
    }

    this.scheduleNextBatchIfNeeded()
  }

  /**
   * Cancels all pending operations for the specified key.
   * @param {string} key - The identifier for the batch group to cancel
   */
  cancel (key: string): void {
    const operations = this.operationsByKey[key] || [];

    delete this.operationsByKey[key]

    operations.forEach(({ reject }) => {
      reject(new Error('Operation canceled'))
    })

    if (this.isQueueEmpty() && this.batchTimer) {
      this.clearBatchTimer()
    }
  }

  /**
   * Ensures that a key exists in the operationsByKey object.
   * @param {string} key - The key to check and initialize if necessary
   * @private
   */
  private ensureKeyExists (key: string): void {
    if (!this.operationsByKey[key]) {
      this.operationsByKey[key] = []
    }
  }

  /**
   * Wraps an operation with error handling and resolution logic.
   * @template T
   * @param {() => Promise<T>} operation - The operation to wrap
   * @param {(value: T | PromiseLike<T>) => void} resolve - The resolve function
   * @param {(reason?: any) => void} reject - The reject function
   * @returns {() => Promise<void>} The wrapped operation
   * @private
   */
  private wrapOperation<T> (
    operation: () => Promise<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void
  ): () => Promise<void> {
    return async () => {
      try {
        const result = await operation()
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }
  }

  /**
   * Handles the execution of a batch based on its size and timer status.
   * @param {string} key - The key of the batch to handle
   * @private
   */
  private handleBatchExecution (key: string): void {
    if (this.isBatchFull(key)) {
      this.executeBatch(key)
    } else if (!this.batchTimer) {
      this.scheduleBatchExecution()
    }
  }

  /**
   * Checks if a batch for a given key is full.
   * @param {string} key - The key of the batch to check
   * @returns {boolean} True if the batch is full, false otherwise
   * @private
   */
  private isBatchFull (key: string): boolean {
    return this.operationsByKey[key].length >= this.maxOperationsPerBatch
  }

  /**
   * Schedules the next batch execution.
   * @private
   */
  private scheduleBatchExecution (): void {
    this.batchTimer = setTimeout(
      () => this.executeBatch(),
      this.batchIntervalMs
    )
  }

  /**
   * Clears the current batch timer if it exists.
   * @private
   */
  private clearBatchTimer (): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  /**
   * Processes all operations for a given key.
   * @param {string} key - The key of the batch to process
   * @returns {Promise<void>}
   * @private
   */
  private async processBatchForKey(key: string): Promise<void> {
    const operations = this.operationsByKey[key] || [];
    delete this.operationsByKey[key];

    try {
      await Promise.all(operations.map(({ operation }) => operation()));
    } catch (error) {
      this.error(`Batch execution error for key ${key}:`, error);
    }
  }

  /**
   * Schedules the next batch execution if there are pending operations.
   * @private
   */
  private scheduleNextBatchIfNeeded (): void {
    if (!this.isQueueEmpty()) {
      this.scheduleBatchExecution()
    }
  }

  /**
   * Checks if the operation queue is empty.
   * @returns {boolean} True if the queue is empty, false otherwise
   * @private
   */
  private isQueueEmpty (): boolean {
    return Object.keys(this.operationsByKey).length === 0
  }
}
