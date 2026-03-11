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

      try {
        const embeddings = await this.fetchEmbeddings(texts);

        for (let i = 0; i < batch.length; i++) {
          const rule = batch[i];
          this.embeddings.set(rule.doctrineId, {
            doctrineId: rule.doctrineId,
            embedding: embeddings[i],
            model: this.config.model,
            dimensions: embeddings[i].length,
            createdAt: new Date(),
          });
          generated++;
        }
      } catch (err) {
        console.error(`Embedding batch error (offset ${start}):`, err);
        // Fall back to demo embeddings for this batch
        generated += this.generateDemoEmbeddings(batch);
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
    if (!this.config.apiKey) {
      return this.deterministicEmbedding(text);
    }

    try {
      const embeddings = await this.fetchEmbeddings([text]);
      return embeddings[0];
    } catch {
      return this.deterministicEmbedding(text);
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

  /** Clear all embeddings */
  clear(): void {
    this.embeddings.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Build the text to embed for a doctrine rule.
   * Combines rule text, explanation, topic, and legal implication
   * for richer semantic representation.
   */
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
