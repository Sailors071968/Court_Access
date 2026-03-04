// ============================================
// Court Access — Document Integrity Model (Phase 20)
// Document Integrity & Anti-Tamper Verification Layer
//
// Ensures uploaded documents remain immutable.
// Recomputes hashes on retrieval. Binary PASS/FAIL.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Document Integrity Record — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of document integrity verification.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> recordId
 *   Pass 2: full canonical -> dual-hash
 *
 * integrityStatus: binary PASS/FAIL
 *   PASS = originalHash === currentHash
 *   FAIL = originalHash !== currentHash (tampering detected)
 */
export interface DocumentIntegrityRecord {
  recordId: string;                // SHA-256 of canonical pre-ID form
  documentId: string;
  tenantId: string;
  originalHash: string;
  currentHash: string;
  integrityStatus: 'PASS' | 'FAIL';
  verifiedTimestamp: string;       // ISO 8601, caller-provided
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Document Integrity Input
// ---------------------------------------------------------------------------

export interface DocumentIntegrityInput {
  documentId: string;
  tenantId: string;
  originalHash: string;
  currentHash: string;
  verifiedTimestamp: string;
}

// ---------------------------------------------------------------------------
// Page Density Analysis Result
// ---------------------------------------------------------------------------

/**
 * Deterministic page density analysis for multiplex abuse detection.
 *
 * Binary PASS/FAIL based on character-per-page threshold.
 * No probabilistic scoring.
 */
export interface PageDensityResult {
  documentId: string;
  totalCharacters: number;
  totalPages: number;
  charactersPerPage: number;
  densityThreshold: number;
  densityStatus: 'PASS' | 'FAIL';
}
