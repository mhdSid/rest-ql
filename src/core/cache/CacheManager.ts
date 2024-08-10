import { Logger } from "../utils/Logger";
import { CacheItem } from "../types";

/**
 * CacheManager class for managing in-memory cache with expiration.
 * @extends Logger
 */
export class CacheManager extends Logger {
  private cacheStorage: Map<string, CacheItem<any>>;
  private defaultTimeToLive: number;

  /**
   * Creates an instance of CacheManager.
   * @param {number} defaultTimeToLive - The default time-to-live for cache items in milliseconds
   */
  constructor(defaultTimeToLive: number) {
    super("CacheManager");
    this.cacheStorage = new Map();
    this.defaultTimeToLive = defaultTimeToLive;
  }

  /**
   * Stores a value in the cache with a specified or default time-to-live.
   * @template T
   * @param {string} key - The unique identifier for the cache item
   * @param {T} value - The data to be stored
   * @param {number} [timeToLive=this.defaultTimeToLive] - The time-to-live in milliseconds
   */
  set<T>(
    key: string,
    value: T,
    timeToLive: number = this.defaultTimeToLive
  ): void {
    const expirationTime = Date.now() + timeToLive;
    this.cacheStorage.set(key, { data: value, expiry: expirationTime });
    this.log(`Cached item: ${key}`);
  }

  /**
   * Retrieves a value from the cache if it exists and hasn't expired.
   * @template T
   * @param {string} key - The unique identifier for the cache item
   * @returns {T | null} The cached value or null if not found or expired
   */
  get<T>(key: string): T | null {
    const cachedItem = this.cacheStorage.get(key);
    if (!cachedItem) {
      this.log(`Cache miss: ${key}`);
      return null;
    }

    if (this.isExpired(cachedItem)) {
      this.removeCacheItem(key);
      return null;
    }

    this.log(`Cache hit: ${key}`);
    return cachedItem.data as T;
  }

  /**
   * Checks if a valid cache item exists for the given key.
   * @param {string} key - The unique identifier for the cache item
   * @returns {boolean} True if a valid cache item exists, false otherwise
   */
  has(key: string): boolean {
    const cachedItem = this.cacheStorage.get(key);
    if (!cachedItem) {
      this.log(`Cache check (not found): ${key}`);
      return false;
    }

    if (this.isExpired(cachedItem)) {
      this.removeCacheItem(key);
      return false;
    }

    this.log(`Cache check (found): ${key}`);
    return true;
  }

  /**
   * Removes a specific item from the cache.
   * @param {string} key - The unique identifier for the cache item to remove
   */
  invalidate(key: string): void {
    this.cacheStorage.delete(key);
    this.log(`Invalidated cache item: ${key}`);
  }

  /**
   * Removes all items from the cache.
   */
  clear(): void {
    this.cacheStorage.clear();
    this.log("Cache cleared");
  }

  /**
   * Returns the number of valid items in the cache.
   * @returns {number} The number of non-expired items in the cache
   */
  size(): number {
    this.removeExpiredItems();
    const cacheSize = this.cacheStorage.size;
    this.log(`Cache size: ${cacheSize}`);
    return cacheSize;
  }

  /**
   * Returns an array of keys for all valid items in the cache.
   * @returns {string[]} An array of cache keys
   */
  keys(): string[] {
    this.removeExpiredItems();
    const cacheKeys = Array.from(this.cacheStorage.keys());
    this.log(`Cache keys: ${cacheKeys.join(", ")}`);
    return cacheKeys;
  }

  /**
   * Removes all expired items from the cache.
   * @private
   */
  private removeExpiredItems(): void {
    const currentTime = Date.now();
    let expiredItemCount = 0;
    for (const [key, item] of this.cacheStorage.entries()) {
      if (currentTime > item.expiry) {
        this.cacheStorage.delete(key);
        expiredItemCount++;
      }
    }
    if (expiredItemCount > 0) {
      this.log(`Removed ${expiredItemCount} expired cache items`);
    }
  }

  /**
   * Checks if a cache item has expired.
   * @param {CacheItem<any>} item - The cache item to check
   * @returns {boolean} True if the item has expired, false otherwise
   * @private
   */
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() > item.expiry;
  }

  /**
   * Removes a specific item from the cache and logs the action.
   * @param {string} key - The unique identifier for the cache item to remove
   * @private
   */
  private removeCacheItem(key: string): void {
    this.cacheStorage.delete(key);
    this.log(`Expired cache item removed: ${key}`);
  }
}