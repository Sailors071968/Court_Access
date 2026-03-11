// ============================================================================
// Phase 300 — CourtListener API Cache
// Caches query results with 24-hour TTL to avoid excessive API calls.
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  query: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class CourtListenerCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Generate a cache key from endpoint + query params
   */
  private buildKey(endpoint: string, params: Record<string, string>): string {
    const sorted = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${endpoint}?${sorted}`;
  }

  /**
   * Get a cached result if it exists and has not expired.
   */
  get<T>(endpoint: string, params: Record<string, string>): T | null {
    const key = this.buildKey(endpoint, params);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store a result in the cache.
   */
  set<T>(endpoint: string, params: Record<string, string>, data: T): void {
    const key = this.buildKey(endpoint, params);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      query: key,
    });
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(endpoint: string, params: Record<string, string>): void {
    const key = this.buildKey(endpoint, params);
    this.cache.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for monitoring.
   */
  stats(): { entries: number; oldestMs: number | null } {
    let oldest: number | null = null;
    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }
    return {
      entries: this.cache.size,
      oldestMs: oldest ? Date.now() - oldest : null,
    };
  }
}

// Singleton instance
export const courtListenerCache = new CourtListenerCache();
