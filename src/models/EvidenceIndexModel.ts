// ============================================
// Court Access — Evidence Index Model (AI Evidence Intelligence Phase 5)
// Unified searchable index for all processed evidence content.
//
// Indexes extracted text from:
//   - Documents (extracted text)
//   - Images (OCR text)
//   - Audio transcripts
//   - Video transcripts
//
// Supports semantic search via embeddings.
// ============================================

// ---------------------------------------------------------------------------
// Evidence Index Entry
// ---------------------------------------------------------------------------

/**
 * A single indexed text chunk from any evidence source.
 * Used for full-text search and semantic search.
 */
export interface EvidenceIndexEntry {
  indexId: string;
  evidenceId: string;
  caseId: string;
  tenantId: string;
  textChunk: string;                    // Extracted text content
  embeddingVector: number[] | null;     // Embedding vector for semantic search
  sourceType: 'document' | 'image_ocr' | 'audio_transcript' | 'video_transcript' | 'video_frame_ocr';
  sourceTimestamp: number | null;       // Timestamp in source media (seconds) if applicable
  chunkIndex: number;                   // Order within the evidence item
  indexedTimestamp: string;             // ISO 8601 — when this was indexed
}

// ---------------------------------------------------------------------------
// Search Query
// ---------------------------------------------------------------------------

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export interface EvidenceSearchQuery {
  queryText: string;
  caseId?: string;
  tenantId: string;
  mode: SearchMode;
  sourceTypes?: EvidenceIndexEntry['sourceType'][];
  maxResults: number;
}

// ---------------------------------------------------------------------------
// Search Result
// ---------------------------------------------------------------------------

export interface EvidenceSearchResult {
  indexEntry: EvidenceIndexEntry;
  relevanceScore: number;              // 0–1 relevance score
  highlightedText: string;             // Text with search terms highlighted
}

export interface EvidenceSearchResponse {
  results: EvidenceSearchResult[];
  totalMatches: number;
  queryTime: number;                   // Milliseconds
}

// ---------------------------------------------------------------------------
// Indexing Input/Result
// ---------------------------------------------------------------------------

export interface EvidenceIndexInput {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  textContent: string;
  sourceType: EvidenceIndexEntry['sourceType'];
  sourceTimestamp?: number;
}

export interface EvidenceIndexResult {
  success: boolean;
  entriesCreated: number;
  error: string | null;
}
