import { Logger } from "../utils/Logger";
import { CacheItem } from "../types";

export class CacheManager extends Logger {
  private cache: Map<string, CacheItem<any>>;
  private defaultTTL: number;

  constructor(defaultTTL: number) {
    super("CacheManager");
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data: value, expiry });
    this.log(`Set cache item: ${key}`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.log(`Cache miss: ${key}`);
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.log(`Expired cache item removed: ${key}`);
      return null;
    }

    this.log(`Cache hit: ${key}`);
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      this.log(`Cache check (not found): ${key}`);
      return false;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.log(`Cache check (expired, removed): ${key}`);
      return false;
    }

    this.log(`Cache check (found): ${key}`);
    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.log(`Invalidated cache item: ${key}`);
  }

  clear(): void {
    this.cache.clear();
    this.log("Cache cleared");
  }

  size(): number {
    this.removeExpired();
    const size = this.cache.size;
    this.log(`Cache size: ${size}`);
    return size;
  }

  keys(): string[] {
    this.removeExpired();
    const keys = Array.from(this.cache.keys());
    this.log(`Cache keys: ${keys.join(", ")}`);
    return keys;
  }

  private removeExpired(): void {
    const now = Date.now();
    let removedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      this.log(`Removed ${removedCount} expired cache items`);
    }
  }
}
