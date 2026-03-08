// ============================================
// Court Access — Embedding Service
// OpenAI embeddings with LRU in-memory cache.
// ============================================

import { createHash } from 'node:crypto';
import type {
  EmbeddingCacheEntry,
  EmbeddingServiceConfig,
} from './types.ts';
import { DEFAULT_EMBEDDING_CONFIG } from './types.ts';

// ---------------------------------------------------------------------------
// OpenAI Embedding API response shape (minimal subset)
// ---------------------------------------------------------------------------

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

// ---------------------------------------------------------------------------
// EmbeddingService
// ---------------------------------------------------------------------------

export class EmbeddingService {
  private readonly config: EmbeddingServiceConfig;

  /**
   * LRU cache keyed by `${tenantId}:${contentHash}`.
   * Map iteration order is insertion-order in V8, so we delete+re-insert
   * on access to maintain LRU semantics.
   */
  private readonly cache: Map<string, EmbeddingCacheEntry> = new Map();

  /** Optional injectable fetch for testing */
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(
    config?: Partial<EmbeddingServiceConfig>,
    fetchFn?: typeof globalThis.fetch,
  ) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Get the embedding vector for a text string.
   * Returns from cache when available; otherwise calls OpenAI.
   */
  async getEmbedding(text: string, tenantId: string): Promise<number[]> {
    const hash = this.contentHash(text);
    const cacheKey = `${tenantId}:${hash}`;

    const cached = this.cacheGet(cacheKey);
    if (cached) return cached.embedding;

    const embeddings = await this.fetchEmbeddings([text]);
    const embedding = embeddings[0];

    this.cachePut(cacheKey, {
      contentHash: hash,
      embedding,
      dimensions: embedding.length,
      model: this.config.model,
      tenantId,
      createdAt: new Date(),
    });

    return embedding;
  }

  /**
   * Get embeddings for multiple texts in batches.
   * Checks cache first for each text; only calls OpenAI for misses.
   */
  async getEmbeddings(
    texts: string[],
    tenantId: string,
  ): Promise<number[][]> {
    const results: Array<number[] | null> = new Array(texts.length).fill(null);
    const misses: Array<{ index: number; text: string; hash: string }> = [];

    for (let i = 0; i < texts.length; i++) {
      const hash = this.contentHash(texts[i]);
      const cacheKey = `${tenantId}:${hash}`;
      const cached = this.cacheGet(cacheKey);
      if (cached) {
        results[i] = cached.embedding;
      } else {
        misses.push({ index: i, text: texts[i], hash });
      }
    }

    // Batch fetch misses
    if (misses.length > 0) {
      const batchSize = this.config.batchSize;
      for (let start = 0; start < misses.length; start += batchSize) {
        const batch = misses.slice(start, start + batchSize);
        const embeddings = await this.fetchEmbeddings(batch.map((m) => m.text));

        for (let j = 0; j < batch.length; j++) {
          const miss = batch[j];
          const embedding = embeddings[j];
          results[miss.index] = embedding;

          const cacheKey = `${tenantId}:${miss.hash}`;
          this.cachePut(cacheKey, {
            contentHash: miss.hash,
            embedding,
            dimensions: embedding.length,
            model: this.config.model,
            tenantId,
            createdAt: new Date(),
          });
        }
      }
    }

    return results as number[][];
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   * Returns a value in [-1, 1]; typically [0, 1] for normalized embeddings.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(
        `Embedding dimension mismatch: ${a.length} vs ${b.length}`,
      );
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
  }

  /** Current cache size */
  get cacheSize(): number {
    return this.cache.size;
  }

  /** Clear the entire cache */
  clearCache(): void {
    this.cache.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private contentHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  private cacheGet(key: string): EmbeddingCacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  private cachePut(key: string, entry: EmbeddingCacheEntry): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, entry);
    // Evict oldest entries if over capacity
    while (this.cache.size > this.config.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  private async fetchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.fetchFn(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
          dimensions: this.config.dimensions,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI embeddings API error (${response.status}): ${errorText}`,
      );
    }

    const json = (await response.json()) as OpenAIEmbeddingResponse;
    // Sort by index to preserve input order
    const sorted = json.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}
