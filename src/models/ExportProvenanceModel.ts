// ============================================
// Court Access — Export Provenance Model (Phase 22)
// Immutable Export Provenance Layer
//
// Embeds provenance metadata inside every export.
// Ensures every export is traceable to its source snapshot,
// model version, and constitutional validation.
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
// Provenance Block — embedded in every export
// ---------------------------------------------------------------------------

/**
 * Provenance metadata embedded in every export.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> provenanceId
 *   Pass 2: full canonical -> dual-hash
 */
export interface ProvenanceBlock {
  provenanceId: string;            // SHA-256 of canonical pre-ID form
  snapshotId: string;
  modelVersion: string;
  exportTimestamp: string;         // ISO 8601, caller-provided
  outputConstitutionHash: string;
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Provenance Block Input
// ---------------------------------------------------------------------------

export interface ProvenanceBlockInput {
  snapshotId: string;
  modelVersion: string;
  exportTimestamp: string;
  outputConstitutionHash: string;
}

// ---------------------------------------------------------------------------
// Export Verification Page — embedded in PDF exports
// ---------------------------------------------------------------------------

/**
 * Verification metadata for the embedded verification page in PDF exports.
 *
 * Contains all hashes needed for independent verification.
 * Deterministic formatting only.
 */
export interface ExportVerificationPage {
  snapshotHash: string;
  sha256: string;
  sha3_256: string;
  versionNumber: number;
  modelVersion: string;
  exportTimestamp: string;
  provenanceId: string;
}
