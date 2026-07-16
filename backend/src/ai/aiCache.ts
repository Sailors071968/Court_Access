// ============================================================================
// Program 135 — Intelligent AI Cache
// Deterministic, in-process LRU+TTL cache used to eliminate duplicate AI
// requests: response cache, prompt cache, and a semantic (normalized-content)
// cache. Keys are SHA-256 hashes of normalized content so identical requests
// resolve to a single upstream call. Hit/miss counters feed cost accounting.
// (When a Redis URL is available this same interface can be backed by Redis;
// the in-process store is the deterministic default and is never fabricated.)
// ============================================================================

import { createHash } from 'node:crypto';

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export function hashKey(...parts: Array<string | number | undefined | null>): string {
  const normalized = parts
    .filter((p) => p !== undefined && p !== null)
    .map((p) => String(p).replace(/\s+/g, ' ').trim().toLowerCase())
    .join('\u0000');
  return createHash('sha256').update(normalized).digest('hex');
}

export class AiCache<V = unknown> {
  private store = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxEntries = 5000,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    // LRU touch: re-insert to mark most-recently-used.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: V, ttlMs = this.ttlMs): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    return !!entry && entry.expiresAt >= Date.now();
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      hitRate: total === 0 ? 0 : +(this.hits / total).toFixed(4),
    };
  }
}

// Named caches used across the orchestration layer.
export const responseCache = new AiCache<{ text: string; usage: { promptTokens: number; completionTokens: number } }>();
export const promptCache = new AiCache<string>();
export const semanticCache = new AiCache<{ text: string; usage: { promptTokens: number; completionTokens: number } }>();

export function aggregateCacheStats(): Record<string, CacheStats> {
  return {
    response: responseCache.stats(),
    prompt: promptCache.stats(),
    semantic: semanticCache.stats(),
  };
}
