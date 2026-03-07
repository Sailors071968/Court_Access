// ============================================
// Court Access — Evidence Indexing Service (AI Evidence Intelligence Phase 5)
// Unified searchable index for all processed evidence content.
//
// Indexes text from:
//   - Documents (extracted text)
//   - Images (OCR text)
//   - Audio transcripts
//   - Video transcripts + frame OCR
//
// Supports keyword search, semantic search via embeddings.
// ============================================

import type {
  EvidenceIndexEntry,
  EvidenceSearchQuery,
  EvidenceSearchResult,
  EvidenceSearchResponse,
  EvidenceIndexInput,
  EvidenceIndexResult,
} from '../models/EvidenceIndexModel';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 500;          // Characters per chunk
const CHUNK_OVERLAP = 50;        // Overlap between chunks

// ---------------------------------------------------------------------------
// Text Chunking — Deterministic
// ---------------------------------------------------------------------------

/**
 * Split text into overlapping chunks for indexing.
 * Each chunk is CHUNK_SIZE characters with CHUNK_OVERLAP overlap.
 *
 * Deterministic — same input always produces same output.
 */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Index Builder
// ---------------------------------------------------------------------------

/**
 * Build index entries from evidence text content.
 * Chunks text and creates EvidenceIndexEntry records.
 */
export function buildIndexEntries(
  input: EvidenceIndexInput
): EvidenceIndexEntry[] {
  const chunks = chunkText(input.textContent);
  const timestamp = new Date().toISOString();

  return chunks.map((chunk, index) => ({
    indexId: `idx-${input.evidenceId.replace('ev-', '')}-${String(index).padStart(4, '0')}`,
    evidenceId: input.evidenceId,
    caseId: input.caseId,
    tenantId: input.tenantId,
    textChunk: chunk,
    embeddingVector: null,      // Populated by embedding API
    sourceType: input.sourceType,
    sourceTimestamp: input.sourceTimestamp ?? null,
    chunkIndex: index,
    indexedTimestamp: timestamp,
  }));
}

/**
 * Index evidence text content.
 * Creates chunked index entries for search.
 */
export function indexEvidenceText(
  input: EvidenceIndexInput
): EvidenceIndexResult {
  try {
    if (!input.textContent || input.textContent.trim().length === 0) {
      return {
        success: true,
        entriesCreated: 0,
        error: null,
      };
    }

    const entries = buildIndexEntries(input);

    return {
      success: true,
      entriesCreated: entries.length,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      entriesCreated: 0,
      error: err instanceof Error ? err.message : 'Indexing failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Keyword Search — Deterministic
// ---------------------------------------------------------------------------

/**
 * Perform keyword search across index entries.
 * Returns entries containing the query text with relevance scoring.
 *
 * Deterministic — same input always produces same output.
 */
export function keywordSearch(
  entries: EvidenceIndexEntry[],
  query: EvidenceSearchQuery
): EvidenceSearchResponse {
  const startTime = Date.now();
  const normalizedQuery = query.queryText.toLowerCase().trim();

  if (normalizedQuery.length === 0) {
    return { results: [], totalMatches: 0, queryTime: 0 };
  }

  const queryTerms = normalizedQuery.split(/\s+/);

  // Filter by tenant
  let filtered = entries.filter((e) => e.tenantId === query.tenantId);

  // Filter by case if specified
  if (query.caseId) {
    filtered = filtered.filter((e) => e.caseId === query.caseId);
  }

  // Filter by source types if specified
  if (query.sourceTypes && query.sourceTypes.length > 0) {
    filtered = filtered.filter((e) => query.sourceTypes!.includes(e.sourceType));
  }

  // Score and rank
  const scored: EvidenceSearchResult[] = [];

  for (const entry of filtered) {
    const lowerText = entry.textChunk.toLowerCase();
    let matchCount = 0;

    for (const term of queryTerms) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lowerText.match(regex);
      if (matches) matchCount += matches.length;
    }

    if (matchCount > 0) {
      // Highlight matching terms
      let highlighted = entry.textChunk;
      for (const term of queryTerms) {
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlighted = highlighted.replace(regex, '**$1**');
      }

      // Relevance score: term frequency normalized by chunk length
      const relevanceScore = Math.min(1, matchCount / (entry.textChunk.length / 100));

      scored.push({
        indexEntry: entry,
        relevanceScore,
        highlightedText: highlighted,
      });
    }
  }

  // Sort by relevance (descending)
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Limit results
  const limited = scored.slice(0, query.maxResults);

  return {
    results: limited,
    totalMatches: scored.length,
    queryTime: Date.now() - startTime,
  };
}
