// ============================================================================
// PR 3 — Mandatory Evidence Chunking Service
// Breaks large evidence text into overlapping, semantically-aware chunks
// before sending to AI/NLP pipelines. Prevents OOM on large documents and
// ensures consistent processing regardless of file size.
//
// Design:
//   - Fixed-size chunks with configurable overlap (for context continuity)
//   - Paragraph-aware splitting (avoids mid-sentence breaks where possible)
//   - SHA-256 checksum per chunk for integrity verification
//   - Chunk metadata stored in EvidenceChunk table for audit/replay
// ============================================================================

import { createHash } from 'crypto';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Configuration — Tuneable via environment variables
// ---------------------------------------------------------------------------

export interface ChunkingConfig {
  /** Maximum characters per chunk (default: 8000 — fits most LLM context windows) */
  maxChunkChars: number;
  /** Overlap characters between adjacent chunks (default: 500 — preserves cross-boundary context) */
  overlapChars: number;
  /** Minimum characters for a chunk to be stored (default: 50 — skip empty/tiny fragments) */
  minChunkChars: number;
  /** Maximum total characters to process from a single evidence (default: 10M) */
  maxTotalChars: number;
}

const DEFAULT_CONFIG: ChunkingConfig = {
  maxChunkChars: parseInt(process.env.CHUNK_MAX_CHARS || '8000', 10),
  overlapChars: parseInt(process.env.CHUNK_OVERLAP_CHARS || '500', 10),
  minChunkChars: parseInt(process.env.CHUNK_MIN_CHARS || '50', 10),
  maxTotalChars: parseInt(process.env.CHUNK_MAX_TOTAL_CHARS || '10000000', 10),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceChunk {
  /** Zero-based chunk index */
  index: number;
  /** The chunk text */
  text: string;
  /** Character offset in the original document */
  startOffset: number;
  /** Character end offset in the original document */
  endOffset: number;
  /** SHA-256 checksum of the chunk text */
  checksum: string;
  /** Character count */
  charCount: number;
}

export interface ChunkingResult {
  evidenceId: string;
  totalChars: number;
  chunkCount: number;
  chunks: EvidenceChunk[];
  config: ChunkingConfig;
  truncated: boolean;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Core Chunking Logic
// ---------------------------------------------------------------------------

/**
 * Split text into overlapping, paragraph-aware chunks.
 *
 * Algorithm:
 * 1. If text fits in one chunk, return it as-is.
 * 2. Otherwise, advance through the text in maxChunkChars steps.
 * 3. At each step, try to break at a paragraph boundary (double newline).
 * 4. If no paragraph boundary found, try a sentence boundary (. ! ?).
 * 5. If no sentence boundary, break at maxChunkChars (hard break).
 * 6. Each chunk overlaps the previous by overlapChars characters.
 */
export function chunkText(
  text: string,
  config: ChunkingConfig = DEFAULT_CONFIG,
): EvidenceChunk[] {
  if (!text || text.length === 0) {
    return [];
  }

  // Enforce total character limit
  let processText = text;
  if (processText.length > config.maxTotalChars) {
    processText = processText.slice(0, config.maxTotalChars);
  }

  // If text fits in one chunk, return as single chunk
  if (processText.length <= config.maxChunkChars) {
    return [{
      index: 0,
      text: processText,
      startOffset: 0,
      endOffset: processText.length,
      checksum: computeChecksum(processText),
      charCount: processText.length,
    }];
  }

  const chunks: EvidenceChunk[] = [];
  let position = 0;
  let chunkIndex = 0;

  while (position < processText.length) {
    // Determine chunk end position
    let endPos = Math.min(position + config.maxChunkChars, processText.length);

    // If we're not at the end, try to find a good break point
    if (endPos < processText.length) {
      endPos = findBreakPoint(processText, position, endPos, config);
    }

    const chunkText = processText.slice(position, endPos);

    // Only store chunks that meet the minimum size
    if (chunkText.trim().length >= config.minChunkChars) {
      chunks.push({
        index: chunkIndex,
        text: chunkText,
        startOffset: position,
        endOffset: endPos,
        checksum: computeChecksum(chunkText),
        charCount: chunkText.length,
      });
      chunkIndex++;
    }

    // Advance position with overlap
    const advance = endPos - position - config.overlapChars;
    if (advance <= 0) {
      // Prevent infinite loop: if overlap >= chunk size, force advance
      position = endPos;
    } else {
      position += advance;
    }
  }

  return chunks;
}

/**
 * Find the best break point near the target end position.
 * Prefers paragraph breaks > sentence breaks > word breaks > hard break.
 */
function findBreakPoint(
  text: string,
  startPos: number,
  targetEnd: number,
  config: ChunkingConfig,
): number {
  // Search window: look back up to 20% of chunk size for a good break
  const searchStart = Math.max(startPos, targetEnd - Math.floor(config.maxChunkChars * 0.2));

  // 1. Try paragraph boundary (double newline)
  const paragraphBreak = text.lastIndexOf('\n\n', targetEnd);
  if (paragraphBreak > searchStart) {
    return paragraphBreak + 2; // Include the double newline in the current chunk
  }

  // 2. Try single newline
  const lineBreak = text.lastIndexOf('\n', targetEnd);
  if (lineBreak > searchStart) {
    return lineBreak + 1;
  }

  // 3. Try sentence boundary (. ! ?)
  const sentenceRegex = /[.!?]\s/g;
  let lastSentenceEnd = -1;
  sentenceRegex.lastIndex = searchStart;
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(text)) !== null) {
    if (match.index > targetEnd) break;
    lastSentenceEnd = match.index + match[0].length;
  }
  if (lastSentenceEnd > searchStart) {
    return lastSentenceEnd;
  }

  // 4. Try word boundary (space)
  const spaceBreak = text.lastIndexOf(' ', targetEnd);
  if (spaceBreak > searchStart) {
    return spaceBreak + 1;
  }

  // 5. Hard break at target position
  return targetEnd;
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

function computeChecksum(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// High-Level API: Chunk and Persist
// ---------------------------------------------------------------------------

/**
 * Chunk evidence text and persist chunks to the database.
 *
 * @param evidenceId - The evidence record ID
 * @param tenantId - Tenant ID for isolation
 * @param text - The full extracted text to chunk
 * @param config - Optional chunking configuration overrides
 * @returns ChunkingResult with all chunk metadata
 */
export async function chunkAndPersistEvidence(
  evidenceId: string,
  tenantId: string,
  text: string,
  config: ChunkingConfig = DEFAULT_CONFIG,
): Promise<ChunkingResult> {
  const start = Date.now();

  // Step 1: Chunk the text
  const chunks = chunkText(text, config);
  const truncated = text.length > config.maxTotalChars;

  console.log(
    `[EvidenceChunking] Evidence ${evidenceId}: ${text.length} chars → ${chunks.length} chunks`,
  );

  // Step 2: Delete any existing chunks for this evidence (idempotent re-processing)
  await prisma.evidenceChunk.deleteMany({
    where: { evidenceId },
  });

  // Step 3: Persist chunks in batch
  if (chunks.length > 0) {
    await prisma.evidenceChunk.createMany({
      data: chunks.map((chunk) => ({
        evidenceId,
        tenantId,
        chunkIndex: chunk.index,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        checksum: chunk.checksum,
        charCount: chunk.charCount,
      })),
    });
  }

  const result: ChunkingResult = {
    evidenceId,
    totalChars: text.length,
    chunkCount: chunks.length,
    chunks,
    config,
    truncated,
    durationMs: Date.now() - start,
  };

  console.log(
    `[EvidenceChunking] Evidence ${evidenceId} chunked: ${result.chunkCount} chunks in ${result.durationMs}ms` +
    (truncated ? ' (TRUNCATED)' : ''),
  );

  return result;
}

/**
 * Retrieve chunks for an evidence record, ordered by index.
 */
export async function getEvidenceChunks(
  evidenceId: string,
): Promise<Array<{ chunkIndex: number; text: string; checksum: string; charCount: number }>> {
  return prisma.evidenceChunk.findMany({
    where: { evidenceId },
    orderBy: { chunkIndex: 'asc' },
    select: {
      chunkIndex: true,
      text: true,
      checksum: true,
      charCount: true,
    },
  });
}

/**
 * Verify chunk integrity by recomputing checksums.
 * Returns any chunks whose stored checksum doesn't match the recomputed one.
 */
export async function verifyChunkIntegrity(
  evidenceId: string,
): Promise<{ valid: boolean; corrupted: number[] }> {
  const chunks = await prisma.evidenceChunk.findMany({
    where: { evidenceId },
    orderBy: { chunkIndex: 'asc' },
    select: { chunkIndex: true, text: true, checksum: true },
  });

  const corrupted: number[] = [];
  for (const chunk of chunks) {
    const expected = computeChecksum(chunk.text);
    if (chunk.checksum !== expected) {
      corrupted.push(chunk.chunkIndex);
    }
  }

  return {
    valid: corrupted.length === 0,
    corrupted,
  };
}
