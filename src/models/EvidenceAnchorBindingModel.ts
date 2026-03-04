// ============================================
// Court Access — Evidence Anchor Binding Model (Phase 20)
// Anchor-Coupled Evidence Packet Binding
//
// Binds an EvidencePacket to the anchor chain:
//   EvidencePacket.packetId
//     → Anchor Leaf (domain-separated)
//     → Merkle Tree
//     → Anchor Integration
//     → Signature Bind
//
// So that:
//   - Every EvidencePacket is independently anchorable
//   - Every packet can be cryptographically proven
//   - Every packet can be verified without the database
//   - Every packet becomes court-presentable
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from sibling models
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - No update
//   - Append-only discipline
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Evidence Anchor Binding Entity
// ---------------------------------------------------------------------------

/**
 * Binds an EvidencePacket to the anchor chain.
 *
 * Canonical field ordering (for hash computation):
 *   1. bindingId            — SHA-256 of canonical pre-ID form
 *   2. tenantId             — tenant scope
 *   3. packetId             — EvidencePacket.packetId
 *   4. packetSha256         — EvidencePacket.sha256
 *   5. anchorLeafHash       — SHA-256("00" + packetId) (domain-separated leaf)
 *   6. anchorRootHash       — Merkle root from anchor engine (caller-provided)
 *   7. anchorId             — Anchor identifier (caller-provided)
 *   8. integrationHash      — Anchor integration hash (caller-provided)
 *   9. signatureHash        — Signature binding hash (caller-provided)
 *  10. generatedTimestamp   — ISO 8601, caller-provided
 *  11. description          — human-readable, no interpretive language
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256                — SHA-256 of canonical JSON
 *   - sha3_256              — SHA3-256 of canonical JSON
 *
 * Two-pass derivation:
 *   Pass 1: pre-ID canonical (excludes bindingId, sha256, sha3_256) → bindingId
 *   Pass 2: full canonical (includes bindingId, excludes sha256, sha3_256) → dual-hash
 *
 * Domain separation:
 *   anchorLeafHash = SHA-256("00" + packetId)
 *   Reuses Phase 9 domain separation rules for leaves.
 */
export interface EvidenceAnchorBindingEntity {
  bindingId: string;                     // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  packetId: string;                      // EvidencePacket.packetId
  packetSha256: string;                  // EvidencePacket.sha256
  anchorLeafHash: string;                // SHA-256("00" + packetId) — domain-separated leaf
  anchorRootHash: string;                // Merkle root (caller-provided)
  anchorId: string;                      // Anchor identifier (caller-provided)
  integrationHash: string;               // Anchor integration hash (caller-provided)
  signatureHash: string;                 // Signature binding hash (caller-provided)
  generatedTimestamp: string;            // ISO 8601, caller-provided
  description: string;                   // No interpretive language
  sha256: string;                        // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                      // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Evidence Anchor Binding Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new evidence anchor binding.
 *
 * The caller provides all fields except:
 *   - bindingId (derived from canonical form)
 *   - anchorLeafHash (computed as SHA-256("00" + packetId))
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface EvidenceAnchorBindingInput {
  tenantId: string;
  packetId: string;                      // EvidencePacket.packetId
  packetSha256: string;                  // EvidencePacket.sha256
  anchorRootHash: string;                // Merkle root (caller-provided)
  anchorId: string;                      // Anchor identifier (caller-provided)
  integrationHash: string;               // Anchor integration hash (caller-provided)
  signatureHash: string;                 // Signature binding hash (caller-provided)
  generatedTimestamp: string;            // ISO 8601, caller-provided
  description: string;
}

// ---------------------------------------------------------------------------
// Evidence Anchor Binding Verification
// ---------------------------------------------------------------------------

/**
 * Result of verifying an evidence anchor binding.
 *
 * Recomputes:
 *   1. anchorLeafHash from packetId (SHA-256("00" + packetId))
 *   2. bindingId from pre-ID canonical
 *   3. sha256 from full canonical
 *   4. sha3_256 from full canonical
 *
 * Also validates:
 *   - integrationHash exists in caller-provided anchor record
 *   - signatureHash matches caller-provided signature record
 *
 * Binary only. No partial pass.
 */
export interface EvidenceAnchorBindingVerificationResult {
  anchorLeafHashMatch: 'PASS' | 'FAIL';
  bindingIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  integrationHashMatch: 'PASS' | 'FAIL';
  signatureHashMatch: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Anchor Binding Lookup Maps (caller-provided for verification)
// ---------------------------------------------------------------------------

/**
 * Lookup map for anchor integration records.
 * Key: integrationHash → value: anchorId
 * Caller provides this. Engine does not access stores.
 */
export type AnchorIntegrationLookup = Map<string, string>;

/**
 * Lookup map for signature records.
 * Key: signatureHash → value: anchorId
 * Caller provides this. Engine does not access stores.
 */
export type SignatureLookup = Map<string, string>;

// ---------------------------------------------------------------------------
// CI Evidence Anchor Binding Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement for evidence anchor binding integrity.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode.
 */
export interface CIEvidenceAnchorBindingEnforcementResult {
  result: 'PASS' | 'FAIL';
  bindingIdValid: boolean;
  anchorLeafHashValid: boolean;
  sha256Valid: boolean;
  sha3_256Valid: boolean;
  integrationHashValid: boolean;
  signatureHashValid: boolean;
}
