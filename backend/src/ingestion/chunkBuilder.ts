// ============================================
// Court Access — Chunk Builder
// Groups streamed records into fixed-size batches for bulk insertion.
// Memory-safe: only holds one batch in memory at a time.
// ============================================

import { Transform, type Readable } from 'node:stream';
import type { NormalizedDocument } from './types.ts';

// ---------------------------------------------------------------------------
// Chunk Builder Transform Stream
// ---------------------------------------------------------------------------

export interface Chunk {
  batchNumber: number;
  documents: NormalizedDocument[];
  startOffset: number;
  endOffset: number;
}

/**
 * Creates a Transform stream that groups normalized documents into
 * fixed-size batches (chunks). Each chunk is emitted as a single object.
 *
 * @param batchSize - Number of documents per batch (200–500 recommended)
 * @returns Transform stream that emits Chunk objects
 */
export function createChunkBuilder(batchSize: number): Transform {
  let currentBatch: NormalizedDocument[] = [];
  let batchNumber = 0;
  let startOffset = 0;
  let currentOffset = 0;

  return new Transform({
    objectMode: true,

    transform(doc: NormalizedDocument, _encoding, callback) {
      if (currentBatch.length === 0) {
        startOffset = currentOffset;
      }
      currentBatch.push(doc);
      currentOffset++;

      if (currentBatch.length >= batchSize) {
        batchNumber++;
        const chunk: Chunk = {
          batchNumber,
          documents: currentBatch,
          startOffset,
          endOffset: currentOffset,
        };
        currentBatch = [];
        this.push(chunk);
      }

      callback();
    },

    flush(callback) {
      // Emit any remaining documents as a final partial batch
      if (currentBatch.length > 0) {
        batchNumber++;
        const chunk: Chunk = {
          batchNumber,
          documents: currentBatch,
          startOffset,
          endOffset: currentOffset,
        };
        this.push(chunk);
        currentBatch = [];
      }
      callback();
    },
  });
}

/**
 * Collect all chunks from a readable stream into an array.
 * Used for testing and small datasets only.
 */
export async function collectChunks(stream: Readable): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Chunk);
  }
  return chunks;
}
