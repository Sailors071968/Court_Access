// ============================================
// Court Access — Deviation Detection Engine (Phase 3)
// Deterministic text comparison for policy deviation detection.
//
// No UI dependencies. No React imports.
//
// Constitutional boundaries (Phase 35 — Binary PASS/FAIL):
//   - Output is BINARY: deviationDetected = true | false
//   - No adjectives. No narrative. No interpretation.
//   - No scoring. No ranking. No probability.
//   - No fuzzy matching. No ML similarity. No embeddings.
//   - Pure structural comparison only.
//
// Comparison doctrine:
//   - Normalize whitespace
//   - Canonicalize line endings
//   - Sort arrays before diff
//   - Produce deterministic diff output
//   - Dual-hash the comparison itself
// ============================================

import type {
  PolicyChunkEntity,
  DeviationRecord,
  DeviationComparisonInput,
  DeviationComparisonResult,
} from '../models/PolicyModel';
import { normalizeText, computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Deterministic text comparison
// ---------------------------------------------------------------------------

/**
 * Compare two normalized text strings for structural deviation.
 *
 * Comparison rules (deterministic):
 *   1. Both texts are normalized (whitespace, line endings)
 *   2. Comparison is EXACT after normalization
 *   3. If normalized texts differ in ANY way, deviation is detected
 *   4. No fuzzy matching. No similarity threshold.
 *   5. Result is binary: texts match (false) or deviate (true)
 *
 * This is a pure function — same input always produces same output.
 */
export function detectDeviation(
  normalizedPolicyText: string,
  normalizedReportText: string
): boolean {
  return normalizedPolicyText !== normalizedReportText;
}

// ---------------------------------------------------------------------------
// Comparison hash generation
// ---------------------------------------------------------------------------

/**
 * Canonical comparison payload structure.
 * Key order is FIXED and DOCUMENTED:
 *   1. "policy" — normalized policy text (always first)
 *   2. "report" — normalized report text (always second)
 *
 * This structure is serialized via explicit key-ordered JSON construction
 * (NOT via JSON.stringify on an object, which has implementation-defined key order).
 *
 * The canonical serialization format is:
 *   {"policy":"<normalizedPolicyText>","report":"<normalizedReportText>"}
 *
 * This ensures:
 *   - Deterministic ordering across all JavaScript engines
 *   - No ambiguous concatenation boundaries
 *   - Self-documenting structure
 *   - UTF-8 encoding via TextEncoder before hashing
 */
interface ComparisonPayload {
  policy: string;
  report: string;
}

/**
 * Serialize a ComparisonPayload to canonical JSON.
 * Key order is enforced explicitly — NOT relying on object key insertion order.
 *
 * Canonical format:
 *   {"policy":"<escaped>","report":"<escaped>"}
 *
 * Uses JSON.stringify on individual values for proper escaping of special
 * characters (quotes, backslashes, control characters) per RFC 8259.
 * Then assembles the final string with explicit key ordering.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeComparisonPayload(payload: ComparisonPayload): string {
  // Explicit key order: "policy" first, "report" second
  // JSON.stringify on individual string values handles RFC 8259 escaping
  return `{"policy":${JSON.stringify(payload.policy)},"report":${JSON.stringify(payload.report)}}`;
}

/**
 * Generate a deterministic comparison hash.
 * Serializes both texts into canonical JSON with fixed key order,
 * then dual-hashes the serialization.
 *
 * Canonical JSON format (key order fixed and documented):
 *   {"policy":"<normalizedPolicyText>","report":"<normalizedReportText>"}
 *
 * Both SHA-256 and SHA3-256 are computed from the UTF-8 bytes of the
 * canonical JSON string. No ambiguous concatenation. No separator heuristics.
 */
export async function computeComparisonHashes(
  normalizedPolicyText: string,
  normalizedReportText: string
): Promise<{ sha256: string; sha3: string }> {
  const payload: ComparisonPayload = {
    policy: normalizedPolicyText,
    report: normalizedReportText,
  };
  const canonical = canonicalizeComparisonPayload(payload);
  const sha256 = await computeTextSHA256(canonical);
  const sha3 = computeTextSHA3_256(canonical);
  return { sha256, sha3 };
}

// ---------------------------------------------------------------------------
// ID generation — deterministic from hash
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic ID from a content hash.
 * Extracts first 16 hex characters from raw hex hash.
 */
function idFromHash(contentHash: string): string {
  return contentHash.slice(0, 16);
}

// ---------------------------------------------------------------------------
// Deviation Comparison Pipeline
// ---------------------------------------------------------------------------

/**
 * Compare a report text segment against a policy chunk.
 *
 * Pipeline:
 *   1. Normalize the report text
 *   2. Use the already-normalized policy chunk text
 *   3. Detect deviation (binary: match or deviate)
 *   4. Compute dual-hash of the comparison itself
 *   5. Build DeviationRecord
 *
 * Constitutional constraints:
 *   - Output is binary (Phase 35)
 *   - No interpretation, scoring, or ranking
 *   - Comparison hash makes the comparison cryptographically reproducible
 *   - All IDs derived deterministically from content hashes
 */
export async function compareForDeviation(
  input: DeviationComparisonInput
): Promise<DeviationComparisonResult> {
  try {
    // Step 1: Normalize the report text
    const normalizedReportText = normalizeText(input.reportText);

    // Step 2: Use the already-normalized policy chunk text
    const normalizedPolicyText = input.policyChunk.normalizedText;

    // Step 3: Detect deviation (binary)
    const deviationDetected = detectDeviation(normalizedPolicyText, normalizedReportText);

    // Step 4: Compute dual-hash of the comparison
    const comparisonHashes = await computeComparisonHashes(
      normalizedPolicyText,
      normalizedReportText
    );

    // Step 5: Build DeviationRecord
    const record: DeviationRecord = {
      id: idFromHash(comparisonHashes.sha256),
      tenantId: input.tenantId,
      caseId: input.caseId,
      documentId: input.documentId,
      policyChunkId: input.policyChunk.id,
      policyReference: `Section ${input.policyChunk.sectionId}, Chunk ${input.policyChunk.chunkIndex}`,
      reportReference: input.reportReference,
      deviationDetected,
      comparisonHash: comparisonHashes.sha256,
      comparisonSha3Hash: comparisonHashes.sha3,
      normalizedPolicyText,
      normalizedReportText,
      comparedAt: input.caseId, // Deterministic — server timestamp in Phase 6+
      integrityVerified: false,
    };

    return {
      success: true,
      record,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      record: null,
      error: err instanceof Error ? err.message : 'Unknown comparison error',
    };
  }
}

// ---------------------------------------------------------------------------
// Batch Deviation Comparison
// ---------------------------------------------------------------------------

/**
 * Compare a report text segment against multiple policy chunks.
 * Returns a DeviationRecord for each chunk comparison.
 *
 * Chunks are processed in deterministic order (sorted by chunkIndex).
 * Results are returned in the same order.
 *
 * This is a pure function — same inputs always produce same outputs.
 */
export async function batchCompareForDeviation(
  tenantId: string,
  caseId: string,
  documentId: string,
  reportText: string,
  reportReference: string,
  policyChunks: PolicyChunkEntity[]
): Promise<DeviationComparisonResult[]> {
  // Sort chunks by chunkIndex for deterministic processing
  const sortedChunks = [...policyChunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

  const results: DeviationComparisonResult[] = [];

  for (const chunk of sortedChunks) {
    const result = await compareForDeviation({
      tenantId,
      caseId,
      documentId,
      reportText,
      reportReference,
      policyChunk: chunk,
    });
    results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Policy Index — Deterministic chunk lookup
// ---------------------------------------------------------------------------

/**
 * A deterministic index mapping policy chunk content hashes to chunks.
 * Enables O(1) lookup by content hash for comparison operations.
 *
 * The index is built from a flat array of chunks and is immutable once created.
 * Sorted by (manualId, sectionId, chunkIndex) for deterministic traversal.
 */
export interface PolicyChunkIndex {
  /** Total chunks in the index */
  totalChunks: number;
  /** Chunks indexed by contentHash */
  byContentHash: ReadonlyMap<string, PolicyChunkEntity>;
  /** Chunks indexed by sectionId, sorted by chunkIndex */
  bySectionId: ReadonlyMap<string, readonly PolicyChunkEntity[]>;
  /** All chunks in deterministic order */
  allChunks: readonly PolicyChunkEntity[];
}

/**
 * Build a deterministic policy chunk index.
 *
 * Index construction rules:
 *   1. Chunks are sorted by (manualId, sectionId, chunkIndex)
 *   2. Index maps are built from sorted order
 *   3. Duplicate content hashes are detected (should not exist — indicates bug)
 *
 * This is a pure function — same input always produces same output.
 */
export function buildPolicyChunkIndex(chunks: PolicyChunkEntity[]): PolicyChunkIndex {
  // Sort deterministically
  const sorted = [...chunks].sort((a, b) => {
    if (a.manualId !== b.manualId) return a.manualId.localeCompare(b.manualId);
    if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
    return a.chunkIndex - b.chunkIndex;
  });

  // Build content hash index
  const byContentHash = new Map<string, PolicyChunkEntity>();
  for (const chunk of sorted) {
    if (byContentHash.has(chunk.contentHash)) {
      throw new Error(
        `Duplicate contentHash detected in policy chunk index: "${chunk.contentHash}". ` +
        'This indicates a data integrity issue — two chunks should not have identical content hashes ' +
        'unless they contain identical normalized text.'
      );
    }
    byContentHash.set(chunk.contentHash, chunk);
  }

  // Build section index
  const bySectionIdMutable = new Map<string, PolicyChunkEntity[]>();
  for (const chunk of sorted) {
    const existing = bySectionIdMutable.get(chunk.sectionId);
    if (existing) {
      existing.push(chunk);
    } else {
      bySectionIdMutable.set(chunk.sectionId, [chunk]);
    }
  }

  // Freeze section arrays
  const bySectionId = new Map<string, readonly PolicyChunkEntity[]>();
  for (const [key, value] of bySectionIdMutable) {
    bySectionId.set(key, Object.freeze(value));
  }

  return {
    totalChunks: sorted.length,
    byContentHash,
    bySectionId,
    allChunks: Object.freeze(sorted),
  };
}
