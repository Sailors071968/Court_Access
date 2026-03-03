// ============================================
// Court Access — Merkle Inclusion Proof Model (Phase 9)
// Deterministic Merkle Inclusion Proofs
//
// All proof-related domain types.
// Deterministic. Canonical. Binary verification only.
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
//   - No interpretive language
//   - No mutation
//   - No randomness
//   - No optional security downgrade paths
//   - Additive-only cryptographic posture
//   - Raw lowercase hex only (no prefix encoding)
//   - ASCII comparator only (no localeCompare)
//   - No Date object usage
// ============================================

// ---------------------------------------------------------------------------
// Proof Path Step — single sibling in the Merkle path
// ---------------------------------------------------------------------------

/**
 * A single step in a Merkle inclusion proof path.
 *
 * Each step provides:
 *   - hash: the sibling hash at this tree level (raw 64-char lowercase hex)
 *   - position: 'left' or 'right' — the sibling's position relative to the
 *     node being proven. If position is 'left', the sibling is concatenated
 *     BEFORE the current hash. If 'right', AFTER.
 *
 * Position encoding is deterministic:
 *   - If the node being proven is at an even index (0, 2, 4, ...),
 *     its sibling is to the right → position = 'right'
 *   - If the node being proven is at an odd index (1, 3, 5, ...),
 *     its sibling is to the left → position = 'left'
 *
 * No ambiguity. No optional fields. No interpretive metadata.
 */
export interface MerkleProofStep {
  hash: string;                    // Sibling hash (raw 64-char lowercase hex)
  position: 'left' | 'right';     // Sibling position relative to proven node
}

// ---------------------------------------------------------------------------
// Merkle Inclusion Proof — full proof for a single leaf
// ---------------------------------------------------------------------------

/**
 * A complete Merkle inclusion proof for a single leaf.
 *
 * Contains:
 *   - leafHash: the leaf being proven (raw 64-char lowercase hex)
 *   - merkleRoot: the expected root (raw 64-char lowercase hex)
 *   - path: ordered array of MerkleProofStep from leaf to root
 *   - leafIndex: the leaf's position in the sorted leaf array (0-based)
 *   - totalLeaves: total number of leaves in the tree
 *
 * The proof is verified by:
 *   1. Starting with leafHash
 *   2. For each step in path:
 *      a. If step.position === 'left': hash = SHA-256(step.hash + currentHash)
 *      b. If step.position === 'right': hash = SHA-256(currentHash + step.hash)
 *   3. Final hash must equal merkleRoot
 *
 * No stored intermediate hashes. Verification recomputes from leaf to root.
 */
export interface MerkleInclusionProof {
  leafHash: string;                // The leaf being proven (raw 64-char lowercase hex)
  merkleRoot: string;              // Expected Merkle root (raw 64-char lowercase hex)
  path: MerkleProofStep[];         // Ordered proof path from leaf to root
  leafIndex: number;               // Leaf position in sorted array (0-based)
  totalLeaves: number;             // Total leaves in the tree
}

// ---------------------------------------------------------------------------
// Merkle Inclusion Verification Result — binary only
// ---------------------------------------------------------------------------

/**
 * Result of verifying a Merkle inclusion proof.
 *
 * Binary output only:
 *   - verified: true ONLY if recomputed root matches expected merkleRoot
 *   - computedRoot: the root recomputed from leafHash + path
 *
 * No partial verification. No percentage. No scoring.
 * No auto-correction. No mutation.
 */
export interface MerkleInclusionVerificationResult {
  verified: boolean;               // true ONLY if computedRoot === merkleRoot
  computedRoot: string;            // Root recomputed from proof path (raw hex)
}

// ---------------------------------------------------------------------------
// Merkle Proof Field Validation — binary per-field
// ---------------------------------------------------------------------------

/**
 * Single field validation entry for a Merkle proof.
 * Binary only: PASS or FAIL. No scoring. No narrative.
 */
export interface MerkleProofFieldValidation {
  field: string;                   // Field name being validated
  result: 'PASS' | 'FAIL';        // Binary result only
}

// ---------------------------------------------------------------------------
// Merkle Proof Validation Matrix — overall binary
// ---------------------------------------------------------------------------

/**
 * Validation matrix for a Merkle inclusion proof.
 *
 * Each required field is validated independently.
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 */
export interface MerkleProofValidationMatrix {
  fields: MerkleProofFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Merkle Tree with Proof Paths — construction output
// ---------------------------------------------------------------------------

/**
 * Output of Merkle tree construction with proof extraction capability.
 *
 * Contains the root and the sorted leaves used to build the tree.
 * Proof paths are extracted on demand via the engine, not stored.
 *
 * No stored intermediate tree nodes. Proofs are recomputed per request.
 */
export interface MerkleTreeResult {
  merkleRoot: string;              // Computed Merkle root (raw 64-char lowercase hex)
  sortedLeaves: string[];          // Leaves sorted via ASCII comparator (raw hex)
  leafCount: number;               // Total number of leaves
}
