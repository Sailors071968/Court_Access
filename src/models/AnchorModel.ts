// ============================================
// Court Access — Daily Anchor Model (Phase 7)
// Time Anchored Trust Layer (TATL)
//
// All anchor-related domain types.
// Deterministic. Dual-hashed. Append-only.
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No ranking
//   - No anomaly detection
//   - No likelihood
//   - No confidence
//   - No prediction
//   - No intent inference
//   - Append-only. No mutation. No deletion.
// ============================================

// ---------------------------------------------------------------------------
// Daily Anchor Entity
// ---------------------------------------------------------------------------

/**
 * A daily anchor record binding all export artifacts for a given day
 * into a deterministic Merkle root.
 *
 * Append-only:
 *   - Once created, an anchor record is NEVER updated or deleted.
 *   - There is no update method. There is no delete method.
 *
 * Binary state rule:
 *   - contentHash and sha3Hash are REQUIRED (non-null).
 *   - A DailyAnchorEntity only exists after full construction.
 *
 * Immutability contract:
 *   - All fields are IMMUTABLE once set.
 *   - contentHash (SHA-256) is REQUIRED and IMMUTABLE.
 *   - sha3Hash (SHA3-256) is REQUIRED and IMMUTABLE.
 *
 * ID derivation:
 *   - Derived from date ONLY.
 *   - Not from merkleRoot, scopeHash, or any other field.
 */
export interface DailyAnchorEntity {
  id: string;                    // Deterministic — derived from date only
  date: string;                  // YYYY-MM-DD (UTC only)
  merkleRoot: string;            // SHA-256 Merkle root of day's export CAPS hashes
  scopeHash: string;             // Scope hash for the day's anchor
  immutableCoreHash: string;     // System-wide immutable core hash reference
  epoch: number;                 // Anchor epoch number
  contentHash: string;           // SHA-256 of canonical anchor JSON — REQUIRED, immutable
  sha3Hash: string;              // SHA3-256 of canonical anchor JSON — REQUIRED, immutable
}

// ---------------------------------------------------------------------------
// Anchor Construction Input
// ---------------------------------------------------------------------------

/**
 * Input for constructing a daily anchor record.
 * The caller provides the date, export hashes, and metadata.
 * The engine computes the Merkle root and anchor hashes.
 */
export interface DailyAnchorInput {
  date: string;                  // YYYY-MM-DD (UTC only) — no Date.now()
  exportCapsHashes: string[];    // Array of CAPS sha256 hashes for the day
  scopeHash: string;             // Scope hash for this anchor
  immutableCoreHash: string;     // System-wide immutable core hash reference
  epoch: number;                 // Anchor epoch number
}

// ---------------------------------------------------------------------------
// Anchor Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying a daily anchor entity's integrity.
 */
export interface AnchorVerificationResult {
  verified: boolean;             // True ONLY if BOTH hashes match
  computedSha256: string;
  computedSha3: string;
}

// ---------------------------------------------------------------------------
// Gap Detection Result
// ---------------------------------------------------------------------------

/**
 * Result of anchor gap detection.
 * Binary output only: PASS or FAIL.
 * No explanation text. No scoring.
 */
export interface AnchorGapDetectionResult {
  result: 'PASS' | 'FAIL';
}
