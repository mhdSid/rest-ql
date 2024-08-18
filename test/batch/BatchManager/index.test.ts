import { expect, test, describe, beforeEach, vi, afterEach, it, beforeAll, afterAll } from 'vitest'
import { BatchManager } from '../../../src/core/batch/BatchManager'

describe('BatchManager', () => {
  let batchManager: BatchManager

  beforeAll(() => {
    batchManager = new BatchManager({ batchInterval: 100, maxBatchSize: 3 })
    vi.useFakeTimers()
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('should execute operations in batches', async () => {
    const mockOperation = vi.fn().mockResolvedValue('result')
    const promises = []

    for (let i = 0; i < 5; i++) {
      promises.push(batchManager.add('key1', mockOperation))
    }

    // First batch should execute immediately (maxBatchSize: 3)
    expect(mockOperation).toHaveBeenCalledTimes(3)

    // Advance timer to trigger second batch
    vi.advanceTimersByTime(100)
    await Promise.all(promises)

    expect(mockOperation).toHaveBeenCalledTimes(5)
  })

  it('should handle multiple keys', async () => {
    const mockOperation1 = vi.fn().mockResolvedValue('result1')
    const mockOperation2 = vi.fn().mockResolvedValue('result2')

    const promise1 = batchManager.add('key1', mockOperation1)
    const promise2 = batchManager.add('key2', mockOperation2)

    vi.advanceTimersByTime(100)
    await Promise.all([promise1, promise2])

    expect(mockOperation1).toHaveBeenCalledTimes(1)
    expect(mockOperation2).toHaveBeenCalledTimes(1)
  })

  it('should cancel operations for a specific key', async () => {
    const mockOperation = vi.fn().mockResolvedValue('result')
    const promise = batchManager.add('key1', mockOperation)

    batchManager.cancel('key1')
    vi.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow()
    expect(mockOperation).not.toHaveBeenCalled()
  })

  it('should handle errors in operations', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'))
    const promise = batchManager.add('key1', mockOperation)

    vi.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow('Test error')
    expect(mockOperation).toHaveBeenCalledTimes(1)
  })

  it('should respect maxBatchSize', async () => {
    const mockOperation = vi.fn().mockResolvedValue('result')
    const promises = []

    for (let i = 0; i < 5; i++) {
      promises.push(batchManager.add('key1', mockOperation))
    }

    // First batch should execute immediately (maxBatchSize: 3)
    expect(mockOperation).toHaveBeenCalledTimes(3)

    // Second batch should wait for the timer
    expect(mockOperation).not.toHaveBeenCalledTimes(5)

    vi.advanceTimersByTime(100)
    await Promise.all(promises)

    expect(mockOperation).toHaveBeenCalledTimes(5)
  })
})
