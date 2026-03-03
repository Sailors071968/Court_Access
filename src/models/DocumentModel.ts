// ============================================
// Court Access — Canonical Document Model (Phase 2)
// All document-related domain types.
// Includes ingestion & integrity fields.
// ============================================

// ---------------------------------------------------------------------------
// Document classification
// ---------------------------------------------------------------------------

export type DocumentType =
  | 'defense_motion'
  | 'charging_document'
  | 'transcript'
  | 'prosecution_motion'
  | 'court_order'
  | 'defense_filing'
  | 'other';

/** Analysis pipeline status for a document. */
export type DocumentAnalysisStatus = 'pending' | 'analyzing' | 'analyzed' | 'failed';

/**
 * Text extraction pipeline status.
 * pending    — file uploaded, extraction not yet started
 * processing — extraction in progress
 * complete   — text successfully extracted
 * failed     — extraction failed (corrupt file, unsupported format, etc.)
 */
export type ExtractionStatus = 'pending' | 'processing' | 'complete' | 'failed';

// ---------------------------------------------------------------------------
// Pre-Ingest Document Input
// ---------------------------------------------------------------------------

/**
 * Pre-ingestion document input.
 * Represents metadata known BEFORE a file is ingested into the system.
 * Hashes do not exist yet — they are computed during ingestion.
 *
 * This type exists to enforce the Phase 4 + Phase 35 binary state rule:
 *   - A document is either PRE-INGEST (no hashes, not yet a DocumentEntity)
 *   - Or FULLY INGESTED (dual-hashed, persisted as DocumentEntity)
 *   - There is no intermediate "partially hashed" state.
 */
export interface PreIngestDocumentInput {
  tenantId: string;
  caseId: string;
  name: string;
  type: DocumentType;
  filedDate: string;
  pages: number;
  fileSize: number;
  fileType: string | null;
  uploadedBy: string | null;
}

// ---------------------------------------------------------------------------
// Document Entity
// ---------------------------------------------------------------------------

/**
 * Canonical Document entity.
 * Represents a single legal document attached to a case.
 * Includes integrity, provenance, and ingestion fields.
 *
 * Binary state rule (Phase 4 + Phase 35):
 *   - A DocumentEntity ALWAYS has both hashes. No null hashes allowed.
 *   - Documents without hashes are PreIngestDocumentInput, not DocumentEntity.
 *   - There is no "partially hashed" persisted state.
 *
 * Immutability contract:
 *   - `contentHash` (SHA-256) is REQUIRED and IMMUTABLE once set.
 *   - `sha3Hash` (SHA3-256) is REQUIRED and IMMUTABLE once set.
 *   - `integrityVerified` may only transition false → true, never true → false.
 *
 * Dual-hash doctrine (Phase 24 — Crypto Survivability Horizon):
 *   - Both SHA-256 and SHA3-256 are computed at ingest time.
 *   - Both are immutable once set.
 *   - Both must match on verification for integrityVerified = true.
 *   - Protects against future collision vulnerability and algorithmic obsolescence.
 */
export interface DocumentEntity {
  id: string;
  tenantId: string;
  caseId: string;
  name: string;
  type: DocumentType;
  filedDate: string;            // Display date string (will become ISO 8601 in Phase 6)
  pages: number;
  analysisStatus: DocumentAnalysisStatus;
  fileSize: number;              // File size in bytes — always known at upload time
  fileType: string | null;
  contentHash: string;           // SHA-256 integrity hash — REQUIRED, immutable (primary)
  sha3Hash: string;              // SHA3-256 integrity hash — REQUIRED, immutable (secondary)
  uploadedBy: string | null;    // User ID of uploader
  uploadedAt: string | null;    // ISO 8601

  // --- Phase 2: Ingestion & Integrity ---
  storagePath: string | null;         // Path/key in storage (local or S3)
  extractedText: string | null;       // Raw extracted text content
  extractionStatus: ExtractionStatus;  // Text extraction pipeline status
  integrityVerified: boolean;          // True once dual-hash has been verified post-upload
}

// ---------------------------------------------------------------------------
// Document Type Labels (deterministic mapping)
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  defense_motion: 'Defense Motion',
  charging_document: 'Charging Document',
  transcript: 'Transcript',
  prosecution_motion: 'Prosecution Motion',
  court_order: 'Court Order',
  defense_filing: 'Defense Filing',
  other: 'Other',
} as const;

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use DocumentAnalysisStatus */
export type AIAnalysisStatus = DocumentAnalysisStatus;

/** @deprecated Use DocumentEntity */
export type CaseDocument = DocumentEntity;
