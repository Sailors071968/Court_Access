// ============================================
// Court Access — Canonical Document Model (Phase 1)
// All document-related domain types.
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

// ---------------------------------------------------------------------------
// Document Entity
// ---------------------------------------------------------------------------

/**
 * Canonical Document entity.
 * Represents a single legal document attached to a case.
 * Includes integrity and provenance fields for Phase 2+ immutable storage.
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
  contentHash: string | null;   // SHA-256 integrity hash (Phase 2+)
  uploadedBy: string | null;    // User ID of uploader
  uploadedAt: string | null;    // ISO 8601
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
