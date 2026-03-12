// ============================================
// Court Access — Doctrine Embedding Pipeline
// Generates and stores embeddings for doctrine
// rules using OpenAI text-embedding-3-large.
// ============================================

import { createHash } from 'node:crypto';
import type { DoctrineRule } from './types.ts';

// ---------------------------------------------------------------------------
// Embedding Store — in-memory vector storage
// ---------------------------------------------------------------------------

interface DoctrineEmbeddingEntry {
  doctrineId: string;
  embedding: number[];
  model: string;
  dimensions: number;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// OpenAI Embedding API response shape
// ---------------------------------------------------------------------------

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

// ---------------------------------------------------------------------------
// Pipeline Configuration
// ---------------------------------------------------------------------------

interface EmbeddingPipelineConfig {
  apiKey: string;
  model: string;
  dimensions: number;
  batchSize: number;
}

const DEFAULT_CONFIG: EmbeddingPipelineConfig = {
  apiKey: '',
  model: 'text-embedding-3-large',
  dimensions: 1536,
  batchSize: 50,
};

// ---------------------------------------------------------------------------
// Doctrine Embedding Pipeline
// ---------------------------------------------------------------------------

export class DoctrineEmbeddingPipeline {
  private readonly config: EmbeddingPipelineConfig;
  private readonly embeddings: Map<string, DoctrineEmbeddingEntry> = new Map();

  // Embedding cache — keyed by text content hash for deduplication.
  // Rule embeddings persist permanently; query embeddings are evicted
  // when the cache exceeds MAX_QUERY_CACHE_SIZE to prevent unbounded growth.
  private static readonly MAX_QUERY_CACHE_SIZE = 2000;
  private readonly embeddingCache: Map<string, number[]> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config?: Partial<EmbeddingPipelineConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Generate embeddings for a batch of doctrine rules.
   * Returns the number of embeddings generated.
   */
  async generateEmbeddings(rules: DoctrineRule[]): Promise<number> {
    if (!this.config.apiKey) {
      // Generate deterministic pseudo-embeddings for demo/offline mode
      return this.generateDemoEmbeddings(rules);
    }

    let generated = 0;

    for (let start = 0; start < rules.length; start += this.config.batchSize) {
      const batch = rules.slice(start, start + this.config.batchSize);
      const texts = batch.map((r) => this.buildEmbeddingText(r));

      // Check cache first — separate cached from uncached
      const uncachedIndices: number[] = [];
      const uncachedTexts: string[] = [];

      for (let i = 0; i < texts.length; i++) {
        const cacheKey = this.getCacheKey(texts[i]);
        const cached = this.embeddingCache.get(cacheKey);
        if (cached) {
          // Use cached embedding
          this.cacheHits++;
          const rule = batch[i];
          this.embeddings.set(rule.doctrineId, {
            doctrineId: rule.doctrineId,
            embedding: cached,
            model: this.config.model,
            dimensions: cached.length,
            createdAt: new Date(),
          });
          generated++;
        } else {
          this.cacheMisses++;
          uncachedIndices.push(i);
          uncachedTexts.push(texts[i]);
        }
      }

      // Fetch embeddings only for uncached texts
      if (uncachedTexts.length === 0) continue;

      try {
        const embeddings = await this.fetchEmbeddings(uncachedTexts);

        for (let j = 0; j < uncachedIndices.length; j++) {
          const originalIdx = uncachedIndices[j];
          const rule = batch[originalIdx];
          const embedding = embeddings[j];

          // Store in cache (permanent TTL)
          this.embeddingCache.set(this.getCacheKey(texts[originalIdx]), embedding);

          this.embeddings.set(rule.doctrineId, {
            doctrineId: rule.doctrineId,
            embedding,
            model: this.config.model,
            dimensions: embedding.length,
            createdAt: new Date(),
          });
          generated++;
        }
      } catch (err) {
        console.error(`Embedding batch error (offset ${start}):`, err);
        // Fall back to demo embeddings for this batch
        for (const idx of uncachedIndices) {
          const rule = batch[idx];
          if (!this.embeddings.has(rule.doctrineId)) {
            this.embeddings.set(rule.doctrineId, {
              doctrineId: rule.doctrineId,
              embedding: this.deterministicEmbedding(texts[idx]),
              model: 'demo-deterministic',
              dimensions: this.config.dimensions,
              createdAt: new Date(),
            });
            generated++;
          }
        }
      }
    }

    return generated;
  }

  /**
   * Get the embedding for a doctrine rule.
   */
  getEmbedding(doctrineId: string): number[] | undefined {
    return this.embeddings.get(doctrineId)?.embedding;
  }

  /**
   * Generate an embedding for arbitrary text (for search queries).
   */
  async embedText(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }
    this.cacheMisses++;

    if (!this.config.apiKey) {
      const embedding = this.deterministicEmbedding(text);
      this.evictIfNeeded();
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    }

    try {
      const embeddings = await this.fetchEmbeddings([text]);
      this.evictIfNeeded();
      this.embeddingCache.set(cacheKey, embeddings[0]);
      return embeddings[0];
    } catch {
      const embedding = this.deterministicEmbedding(text);
      this.evictIfNeeded();
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    }
  }

  /**
   * Evict oldest cache entries if cache exceeds max size.
   * Keeps rule embeddings (which are finite) and evicts query embeddings.
   */
  private evictIfNeeded(): void {
    if (this.embeddingCache.size <= DoctrineEmbeddingPipeline.MAX_QUERY_CACHE_SIZE) return;
    // Evict oldest entry (first inserted key in Map iteration order)
    const firstKey = this.embeddingCache.keys().next().value;
    if (firstKey !== undefined) {
      this.embeddingCache.delete(firstKey);
    }
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

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

  /**
   * Find the most similar doctrine rules to a query embedding.
   */
  findSimilar(
    queryEmbedding: number[],
    topK: number = 10,
    minSimilarity: number = 0.3,
  ): Array<{ doctrineId: string; similarity: number }> {
    const results: Array<{ doctrineId: string; similarity: number }> = [];

    for (const [doctrineId, entry] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= minSimilarity) {
        results.push({ doctrineId, similarity });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /** Total embeddings stored */
  get size(): number {
    return this.embeddings.size;
  }

  /** Clear all embeddings and cache */
  clear(): void {
    this.embeddings.clear();
    this.clearCache();
  }

  /** Clear only the embedding cache (call when rules are re-ingested) */
  clearCache(): void {
    this.embeddingCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /** Get cache statistics */
  get cacheStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? `${Math.round((this.cacheHits / total) * 100)}%` : 'N/A';
    return {
      size: this.embeddingCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
    };
  }

  /** Check if using real OpenAI embeddings */
  get isRealEmbeddings(): boolean {
    return !!this.config.apiKey;
  }

  /** Get the model name being used */
  get modelName(): string {
    return this.config.apiKey ? this.config.model : 'demo-deterministic';
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Build the text to embed for a doctrine rule.
   * Combines rule text, explanation, topic, and legal implication
   * for richer semantic representation.
   */
  /**
   * Generate a cache key from text using SHA-256 hash.
   */
  private getCacheKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  private buildEmbeddingText(rule: DoctrineRule): string {
    const parts = [
      `${rule.chapter}: ${rule.topic}`,
      rule.ruleText,
    ];
    if (rule.explanation) parts.push(rule.explanation);
    if (rule.legalImplication) parts.push(rule.legalImplication);
    return parts.join('. ');
  }

  /**
   * Generate deterministic pseudo-embeddings for demo/offline mode.
   * Uses content hashing to produce consistent but non-random vectors.
   */
  private generateDemoEmbeddings(rules: DoctrineRule[]): number {
    let count = 0;
    for (const rule of rules) {
      if (this.embeddings.has(rule.doctrineId)) continue;

      this.embeddings.set(rule.doctrineId, {
        doctrineId: rule.doctrineId,
        embedding: this.deterministicEmbedding(this.buildEmbeddingText(rule)),
        model: 'demo-deterministic',
        dimensions: this.config.dimensions,
        createdAt: new Date(),
      });
      count++;
    }
    return count;
  }

  /**
   * Create a deterministic pseudo-embedding from text.
   * Uses chained SHA-256 hashes to produce unique values across all dimensions.
   */
  private deterministicEmbedding(text: string): number[] {
    const dims = this.config.dimensions;
    const embedding = new Array<number>(dims);

    // Pre-allocate buffer for all bytes needed (2 bytes per dimension)
    const bytesNeeded = dims * 2;
    const chunksNeeded = Math.ceil(bytesNeeded / 32); // SHA-256 = 32 bytes
    const allBytes = Buffer.allocUnsafe(chunksNeeded * 32);

    // Chain SHA-256 hashes to fill the buffer efficiently
    let prevHash = createHash('sha256').update(text).digest();
    prevHash.copy(allBytes, 0);

    for (let c = 1; c < chunksNeeded; c++) {
      prevHash = createHash('sha256')
        .update(prevHash)
        .update(Buffer.from([c & 0xff, (c >> 8) & 0xff]))
        .digest();
      prevHash.copy(allBytes, c * 32);
    }

    // Each dimension gets two unique bytes
    for (let i = 0; i < dims; i++) {
      const byte1 = allBytes[i * 2];
      const byte2 = allBytes[i * 2 + 1];
      // Normalize to roughly [-0.1, 0.1] range like real embeddings
      embedding[i] = ((byte1 * 256 + byte2) / 65535 - 0.5) * 0.2;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dims; i++) norm += embedding[i] * embedding[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dims; i++) embedding[i] /= norm;
    }

    return embedding;
  }

  private async fetchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI embeddings API error (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as OpenAIEmbeddingResponse;
    const sorted = json.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const doctrineEmbeddingPipeline = new DoctrineEmbeddingPipeline();
