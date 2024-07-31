import { CacheEntry } from './types';

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private cacheTimeout: number;

  constructor(cacheTimeout: number) {
    this.cache = new Map();
    this.cacheTimeout = cacheTimeout;
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTimeout) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
