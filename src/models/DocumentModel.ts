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
 * pending  — file uploaded, extraction not yet started
 * extracting — extraction in progress
 * extracted — text successfully extracted
 * failed — extraction failed (corrupt file, unsupported format, etc.)
 */
export type ExtractionStatus = 'pending' | 'extracting' | 'extracted' | 'failed';

// ---------------------------------------------------------------------------
// Document Entity
// ---------------------------------------------------------------------------

/**
 * Canonical Document entity.
 * Represents a single legal document attached to a case.
 * Includes integrity, provenance, and ingestion fields.
 *
 * Immutability contract:
 *   - Once `contentHash` is set, it MUST NOT be mutated.
 *   - `integrityVerified` may only transition false → true, never true → false.
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
  fileSize: string | null;
  fileType: string | null;
  contentHash: string | null;   // SHA-256 integrity hash — immutable once set
  uploadedBy: string | null;    // User ID of uploader
  uploadedAt: string | null;    // ISO 8601

  // --- Phase 2: Ingestion & Integrity ---
  storagePath: string | null;         // Path/key in storage (local or S3)
  extractedText: string | null;       // Raw extracted text content
  extractionStatus: ExtractionStatus;  // Text extraction pipeline status
  integrityVerified: boolean;          // True once contentHash has been verified post-upload
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
