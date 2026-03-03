// ============================================
// Court Access — Extraction Engine (Phase 2)
// Stub for document text extraction pipeline.
// No OCR yet — placeholder for Phase 3+ integration.
// No UI dependencies. No React imports.
// ============================================

import type { DocumentEntity } from '../models/DocumentModel';
import type { ExtractionStatus } from '../models/DocumentModel';

// ---------------------------------------------------------------------------
// Extraction result
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  success: boolean;
  documentId: string;
  extractedText: string | null;
  extractionStatus: ExtractionStatus;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Extraction engine
// ---------------------------------------------------------------------------

/**
 * Request text extraction for a document.
 *
 * Phase 2: This is a stub. It transitions extractionStatus to 'pending'
 * and returns immediately. No actual OCR or text extraction occurs.
 *
 * Phase 3+ will implement:
 *   - PDF text layer extraction
 *   - OCR for scanned documents
 *   - Media transcription
 *   - Structured text normalization
 *
 * The extraction pipeline is intentionally separated from ingestion:
 *   1. Ingestion: hash, store, create entity (sync)
 *   2. Extraction: parse text from stored file (async, deferred)
 *   3. Analysis: intelligence engine processes extracted text (async, deferred)
 */
export async function requestExtraction(
  document: DocumentEntity
): Promise<ExtractionResult> {
  // Phase 2 stub — no actual extraction
  // In Phase 3+ this will dispatch to the extraction worker/queue

  void document; // Acknowledge parameter to satisfy lint

  return {
    success: true,
    documentId: document.id,
    extractedText: null,
    extractionStatus: 'pending',
    error: null,
  };
}

/**
 * Check extraction status for a document.
 * Phase 2: Always returns current status from the entity.
 * Phase 3+ will poll the extraction worker/queue for real status.
 */
export function getExtractionStatus(document: DocumentEntity): ExtractionStatus {
  return document.extractionStatus;
}

/**
 * Determine if a document is eligible for extraction.
 * Currently supports: pdf, txt, doc, docx
 * Phase 3+ will add: images (OCR), audio/video (transcription)
 */
export function isExtractable(document: DocumentEntity): boolean {
  const extractableTypes = ['pdf', 'txt', 'doc', 'docx'];
  return document.fileType !== null && extractableTypes.includes(document.fileType);
}

/**
 * Determine if extraction is complete for a document.
 * Returns true only when extractionStatus is 'extracted' and extractedText is non-null.
 */
export function isExtractionComplete(document: DocumentEntity): boolean {
  return document.extractionStatus === 'extracted' && document.extractedText !== null;
}
