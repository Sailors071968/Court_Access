// ============================================
// Court Access — Evidence Packet Model (Phase 19)
// Deterministic Evidence Packet Builder
//
// Defines the EvidencePacketEntity schema, section types,
// packet verification, and CI enforcement types.
//
// An evidence packet is the litigation-ready export:
//   - Communication chain (outbound send records)
//   - Response chain (inbound response records)
//   - Audit trace entries (operation history)
//   - Archive manifests (cold storage proofs)
//   - Anchor proofs (daily Merkle roots)
//   - CAPS proofs (cryptographic audit proof envelopes)
//
// All sections are deterministically ordered, dual-hashed,
// and replay-verifiable from the packet alone.
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
// Evidence Section Type — which domain a section represents
// ---------------------------------------------------------------------------

/**
 * Section types in an evidence packet.
 * Additive-only — new types may be added, none removed.
 *
 * Sections are always ordered in this fixed canonical sequence:
 *   1. COMMUNICATION_CHAIN
 *   2. RESPONSE_CHAIN
 *   3. AUDIT_TRACE
 *   4. ARCHIVE_MANIFEST
 *   5. ANCHOR_PROOF
 *   6. CAPS_PROOF
 *
 * This ordering is deterministic and non-configurable.
 */
export type EvidenceSectionType =
  | 'COMMUNICATION_CHAIN'
  | 'RESPONSE_CHAIN'
  | 'AUDIT_TRACE'
  | 'ARCHIVE_MANIFEST'
  | 'ANCHOR_PROOF'
  | 'CAPS_PROOF';

/**
 * Fixed canonical section ordering.
 * Sections MUST appear in this order within the packet.
 * This constant defines the deterministic sequence.
 */
export const EVIDENCE_SECTION_ORDER: readonly EvidenceSectionType[] = [
  'COMMUNICATION_CHAIN',
  'RESPONSE_CHAIN',
  'AUDIT_TRACE',
  'ARCHIVE_MANIFEST',
  'ANCHOR_PROOF',
  'CAPS_PROOF',
] as const;

// ---------------------------------------------------------------------------
// Evidence Section — a single section within the packet
// ---------------------------------------------------------------------------

/**
 * A single section within an evidence packet.
 *
 * Each section contains:
 *   - sectionType: which domain this section represents
 *   - sectionIndex: position in the fixed canonical order (0-based)
 *   - entryCount: number of entries in this section
 *   - entryHashes: array of SHA-256 hashes of each entry (sorted ASC by ASCII)
 *   - sectionHash: SHA-256 of canonical section JSON (entryHashes sorted + concatenated)
 *
 * entryHashes are always sorted ASC (ASCII comparator) for deterministic ordering.
 * sectionHash is derived from the sorted entryHashes, not from the raw entries.
 */
export interface EvidenceSection {
  sectionType: EvidenceSectionType;
  sectionIndex: number;                  // Position in canonical order (0-based)
  entryCount: number;                    // Number of entries in this section
  entryHashes: string[];                 // SHA-256 hashes of each entry, sorted ASC (ASCII)
  sectionHash: string;                   // SHA-256 of canonical section (derived from sorted entryHashes)
}

// ---------------------------------------------------------------------------
// Evidence Packet Entity — the complete litigation-ready export
// ---------------------------------------------------------------------------

/**
 * A complete evidence packet — the attorney-ready, litigation-grade export.
 *
 * Fields (canonical ordering for hash computation):
 *   1. packetId           — deterministic ID (SHA-256 of canonical pre-ID form)
 *   2. tenantId           — tenant scope
 *   3. caseId             — associated case
 *   4. agencyId           — target agency (if agency-scoped, empty string if case-wide)
 *   5. generatedTimestamp — when packet was generated (ISO 8601, caller-provided)
 *   6. sections           — array of EvidenceSection in fixed canonical order
 *   7. sectionHashes      — array of sectionHash values in fixed canonical order
 *   8. description        — human-readable description (no interpretive language)
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256              — SHA-256 of canonical JSON
 *   - sha3_256            — SHA3-256 of canonical JSON
 *
 * The packet is:
 *   - Deterministic (same inputs -> same packet)
 *   - Dual-hashed (SHA-256 + SHA3-256)
 *   - Replay-verifiable (recompute all hashes from entries alone)
 *   - Anchor-eligible (packetHash can be included in daily anchor)
 */
export interface EvidencePacketEntity {
  packetId: string;                      // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  caseId: string;
  agencyId: string;                      // Target agency (empty string if case-wide)
  generatedTimestamp: string;            // ISO 8601, caller-provided, deterministic
  sections: EvidenceSection[];           // Fixed canonical order
  sectionHashes: string[];              // sectionHash values in canonical order
  description: string;                   // No interpretive language
  sha256: string;                        // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                      // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Evidence Packet Input — for creating new packets
// ---------------------------------------------------------------------------

/**
 * Input for creating a new evidence packet.
 *
 * The caller provides all fields except:
 *   - packetId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 *   - sections[].sectionHash (computed by engine)
 *   - sectionHashes (computed by engine)
 *
 * The caller provides raw entry hashes per section.
 * The engine sorts, computes section hashes, and assembles the packet.
 */
export interface EvidencePacketInput {
  tenantId: string;
  caseId: string;
  agencyId: string;
  generatedTimestamp: string;            // ISO 8601, caller-provided
  communicationHashes: string[];         // SHA-256 hashes of communication entries
  responseHashes: string[];              // SHA-256 hashes of response entries
  auditTraceHashes: string[];           // SHA-256 hashes of audit trace entries
  archiveManifestHashes: string[];      // SHA-256 hashes of archive manifest entries
  anchorProofHashes: string[];          // SHA-256 hashes of anchor proof entries
  capsProofHashes: string[];            // SHA-256 hashes of CAPS proof entries
  description: string;
}

// ---------------------------------------------------------------------------
// Evidence Packet Verification — replay verification
// ---------------------------------------------------------------------------

/**
 * Result of verifying a single evidence packet link in the section chain.
 */
export interface EvidenceSectionVerification {
  sectionType: EvidenceSectionType;
  sectionIndex: number;
  verifiedSectionHash: 'PASS' | 'FAIL';
  verifiedEntryCount: 'PASS' | 'FAIL';
  verifiedSorting: 'PASS' | 'FAIL';
}

/**
 * Result of verifying an entire evidence packet.
 *
 * Recomputes:
 *   1. packetId from pre-ID canonical
 *   2. sha256 from full canonical
 *   3. sha3_256 from full canonical
 *   4. Each section's sectionHash from sorted entryHashes
 *   5. sectionHashes array matches sections[].sectionHash
 *
 * Binary only. No partial pass.
 */
export interface EvidencePacketVerificationResult {
  packetIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  sectionVerifications: EvidenceSectionVerification[];
  sectionHashesMatch: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Evidence Packet Field Validation
// ---------------------------------------------------------------------------

/**
 * Single field validation for evidence packet structural checks.
 * Binary only: PASS or FAIL.
 */
export interface EvidencePacketFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

/**
 * Validation matrix for evidence packet structural checks.
 * Overall: PASS only if ALL fields pass.
 */
export interface EvidencePacketValidationMatrix {
  fields: EvidencePacketFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// CI Evidence Packet Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement for evidence packet integrity.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode.
 */
export interface CIEvidencePacketEnforcementResult {
  result: 'PASS' | 'FAIL';
  packetIdValid: boolean;
  sha256Valid: boolean;
  sha3_256Valid: boolean;
  sectionHashesValid: boolean;
  totalSections: number;
  failedSections: number;
}
