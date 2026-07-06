// ============================================
// Court Access — Archive Manifest Model (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Canonical archive manifest structure.
// Fixed key order. Dual-hashed.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation
//   - Dual-hash enforcement
//   - Canonical JSON with fixed key order
//   - ASCII comparator only for sorted arrays
// ============================================

// ---------------------------------------------------------------------------
// Archive Manifest Entity
// ---------------------------------------------------------------------------

/**
 * Archive manifest — the canonical record of an archive operation.
 *
 * All array fields (caseIds, documentIds, documentHashes) are
 * sorted via deterministic ASCII comparator at construction time.
 * No insertion-order reliance.
 *
 * Dual-hashed:
 *   - sha256 and sha3_256 are computed from canonical JSON at creation.
 *   - Both are immutable once set.
 *
 * Canonical JSON key order (FIXED and DOCUMENTED):
 *   1. "tenantId"
 *   2. "archiveId"
 *   3. "caseIds"
 *   4. "documentIds"
 *   5. "documentHashes"
 *   6. "totalSizeBytes"
 *   7. "archiveCreatedAt"
 *   8. "sha256"
 *   9. "sha3_256"
 *
 * All fields are REQUIRED. No optional fields. No null fields.
 */
export interface ArchiveManifestEntity {
  tenantId: string;
  archiveId: string;                   // Deterministic — derived from canonical fields
  caseIds: string[];                   // ASCII sorted
  documentIds: string[];               // ASCII sorted
  documentHashes: string[];            // ASCII sorted (raw 64-char lowercase hex)
  totalSizeBytes: number;              // Integer — total archive size in bytes
  archiveCreatedAt: string;            // ISO 8601 UTC — input parameter, NOT Date.now()
  sha256: string;                      // SHA-256 of canonical manifest JSON (raw 64-char hex)
  sha3_256: string;                    // SHA3-256 of canonical manifest JSON (raw 64-char hex)
}

// ---------------------------------------------------------------------------
// Archive Manifest Input
// ---------------------------------------------------------------------------

/**
 * Input for creating an archive manifest.
 * Arrays will be ASCII-sorted by the engine.
 * The engine computes archiveId and dual-hash from canonical JSON.
 */
export interface ArchiveManifestInput {
  tenantId: string;
  caseIds: string[];
  documentIds: string[];
  documentHashes: string[];
  totalSizeBytes: number;
  archiveCreatedAt: string;            // ISO 8601 UTC — caller provides, NOT Date.now()
}

// ---------------------------------------------------------------------------
// Archive Manifest Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying an archive manifest's integrity.
 * Dual-hash verification — both must match.
 * Binary only: verified = true ONLY if BOTH hashes match.
 */
export interface ArchiveManifestVerificationResult {
  verified: boolean;
  computedSha256: string;
  computedSha3_256: string;
}

// ---------------------------------------------------------------------------
// Archive Bundle Entity
// ---------------------------------------------------------------------------

/**
 * An archive bundle — the manifest plus the cold storage reference.
 *
 * The bundle is the complete archive artifact:
 *   - manifest: the canonical archive manifest
 *   - bundleSha256: SHA-256 of the entire archive bundle (zip + manifest)
 *   - bundleSha3_256: SHA3-256 of the entire archive bundle
 *   - storagePath: cold storage path/key
 */
export interface ArchiveBundleEntity {
  manifest: ArchiveManifestEntity;
  bundleSha256: string;                // SHA-256 of archive bundle (raw 64-char hex)
  bundleSha3_256: string;              // SHA3-256 of archive bundle (raw 64-char hex)
  storagePath: string;                 // Cold storage path/key
}

// ---------------------------------------------------------------------------
// Archive Manifest Field Validation
// ---------------------------------------------------------------------------

/**
 * Single field validation for an archive manifest.
 * Binary only: PASS or FAIL.
 */
export interface ArchiveManifestFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Archive Manifest Validation Matrix
// ---------------------------------------------------------------------------

/**
 * Validation matrix for an archive manifest.
 * Overall: PASS only if ALL fields pass.
 * No partial pass. Binary only.
 */
export interface ArchiveManifestValidationMatrix {
  fields: ArchiveManifestFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}
