// ============================================
// Court Access — Audit Trace Model (Phase 15)
// Deterministic Audit Trace Layer (Reproducibility Spine)
//
// Defines the AuditTraceEntity schema, operation event structures,
// cross-phase linkage references, and validation types.
//
// This layer creates full lifecycle reproducibility from
// ingestion to purge. Every operation is hash-chained,
// dual-hashed, and cross-referenced to its source phase.
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
//   - No re-hashing of historical entries
//   - Append-only discipline
//   - Forward-only hash chain
//   - Deterministic reconstruction possible from trace alone
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
// ============================================

// ---------------------------------------------------------------------------
// Operation Type — all auditable operations
// ---------------------------------------------------------------------------

/**
 * All auditable operation types across the system lifecycle.
 * Additive-only — new types may be added, none removed.
 *
 * Phase mapping:
 *   DOCUMENT_INGEST       — Phase 2 (Document Ingestion)
 *   POLICY_INGEST         — Phase 3 (Policy Ingestion)
 *   ISSUE_INDEX            — Phase 4 (Issue Index)
 *   OFFICER_INDEX          — Phase 5 (Officer Index)
 *   EXPORT_BUILD           — Phase 6 (Export Engine)
 *   CAPS_BIND              — Phase 8 (CAPS Binding)
 *   ANCHOR_BUILD           — Phase 7 (Daily Anchor)
 *   MERKLE_PROOF           — Phase 9 (Merkle Proofs)
 *   SIGNATURE_BIND         — Phase 10 (Hybrid Signatures)
 *   ANCHOR_INTEGRATION     — Phase 11 (Anchor Integration)
 *   ARCHIVE_CREATE         — Phase 12 (Archive)
 *   ARCHIVE_RESTORE        — Phase 12 (Restore)
 *   ARCHIVE_PURGE          — Phase 12 (Purge)
 *   CREDIT_PURCHASE        — Phase 12 (Credit Ledger)
 *   CREDIT_CONSUME         — Phase 12 (Credit Ledger)
 *   GUARD_VALIDATE         — Phase 13 (Interpretation Guard)
 *   DRIFT_SCAN             — Phase 14 (Drift Detector)
 */
export type AuditOperationType =
  | 'DOCUMENT_INGEST'
  | 'POLICY_INGEST'
  | 'ISSUE_INDEX'
  | 'OFFICER_INDEX'
  | 'EXPORT_BUILD'
  | 'CAPS_BIND'
  | 'ANCHOR_BUILD'
  | 'MERKLE_PROOF'
  | 'SIGNATURE_BIND'
  | 'ANCHOR_INTEGRATION'
  | 'ARCHIVE_CREATE'
  | 'ARCHIVE_RESTORE'
  | 'ARCHIVE_PURGE'
  | 'CREDIT_PURCHASE'
  | 'CREDIT_CONSUME'
  | 'GUARD_VALIDATE'
  | 'DRIFT_SCAN';

// ---------------------------------------------------------------------------
// Cross-Phase Linkage Reference
// ---------------------------------------------------------------------------

/**
 * Cross-phase linkage reference.
 *
 * Links an audit trace entry to its source artifact(s) across phases.
 * Each reference identifies:
 *   - phase: which phase produced the artifact
 *   - artifactType: what kind of artifact (document, export, anchor, etc.)
 *   - artifactId: the deterministic ID of the artifact
 *   - artifactHash: the SHA-256 hash of the artifact (for verification)
 *
 * This creates the cross-phase chain:
 *   document → export → CAPS → anchor → archive
 *
 * References are append-only and immutable once created.
 */
export interface CrossPhaseReference {
  phase: number;                       // Phase number (2-14)
  artifactType: string;                // e.g., 'document', 'export', 'caps', 'anchor', 'archive'
  artifactId: string;                  // Deterministic artifact ID
  artifactHash: string;                // SHA-256 hash of the artifact (raw hex, 64 chars)
}

// ---------------------------------------------------------------------------
// Audit Trace Entry — single operation record
// ---------------------------------------------------------------------------

/**
 * A single audit trace entry.
 *
 * Each entry records one atomic operation in the system lifecycle.
 *
 * Fields (canonical ordering for hash computation):
 *   1. traceId         — deterministic ID (SHA-256 of canonical pre-ID form)
 *   2. sequenceNumber  — monotonically increasing (1-indexed, no gaps)
 *   3. tenantId        — tenant scope
 *   4. operationType   — what operation was performed
 *   5. operationTimestamp — when the operation occurred (ISO 8601, caller-provided)
 *   6. previousTraceHash — SHA-256 of the previous entry (forward-only chain)
 *                          First entry uses genesis hash: 64 zeros
 *   7. crossPhaseRefs  — linkage to source artifacts (sorted by phase ASC, ASCII)
 *   8. operationPayloadHash — SHA-256 of the operation-specific payload
 *   9. description     — human-readable description (no interpretive language)
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256           — SHA-256 of canonical JSON
 *   - sha3_256         — SHA3-256 of canonical JSON
 *
 * Chain rule:
 *   entry[N].previousTraceHash === entry[N-1].sha256
 *   entry[0].previousTraceHash === '0'.repeat(64) (genesis)
 *
 * This ensures:
 *   - Forward-only hash chain (no retroactive modification)
 *   - Deterministic reconstruction from trace alone
 *   - Any tampering breaks the chain
 */
export interface AuditTraceEntry {
  traceId: string;                     // SHA-256 of canonical pre-ID form (64 hex chars)
  sequenceNumber: number;              // Monotonically increasing, 1-indexed, integer
  tenantId: string;
  operationType: AuditOperationType;
  operationTimestamp: string;          // ISO 8601, caller-provided, deterministic
  previousTraceHash: string;           // SHA-256 of previous entry (64 hex chars)
  crossPhaseRefs: CrossPhaseReference[];  // Sorted by phase ASC (ASCII comparator)
  operationPayloadHash: string;        // SHA-256 of operation payload (64 hex chars)
  description: string;                 // No interpretive language
  sha256: string;                      // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                    // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Audit Trace Input — for creating new entries
// ---------------------------------------------------------------------------

/**
 * Input for creating a new audit trace entry.
 *
 * The caller provides all fields except:
 *   - traceId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 *
 * previousTraceHash is required — the caller must provide the SHA-256
 * of the previous entry (or genesis hash for the first entry).
 */
export interface AuditTraceInput {
  sequenceNumber: number;
  tenantId: string;
  operationType: AuditOperationType;
  operationTimestamp: string;
  previousTraceHash: string;
  crossPhaseRefs: CrossPhaseReference[];
  operationPayloadHash: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Chain Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying a single link in the trace chain.
 *
 * verifiedLink: PASS if entry[N].previousTraceHash === entry[N-1].sha256
 * verifiedHash: PASS if entry dual-hash matches recomputed hash
 * verifiedSequence: PASS if sequenceNumber === expectedSequence
 */
export interface ChainLinkVerification {
  traceId: string;
  sequenceNumber: number;
  verifiedLink: 'PASS' | 'FAIL';
  verifiedHash: 'PASS' | 'FAIL';
  verifiedSequence: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Full Chain Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying an entire audit trace chain.
 *
 * overallResult: PASS only if ALL links pass ALL checks.
 * Binary only. No partial pass.
 */
export interface ChainVerificationResult {
  links: ChainLinkVerification[];
  overallResult: 'PASS' | 'FAIL';
  totalEntries: number;
  brokenLinks: number;
  hashMismatches: number;
  sequenceGaps: number;
}

// ---------------------------------------------------------------------------
// Trace Field Validation
// ---------------------------------------------------------------------------

/**
 * Single field validation for trace entry structural checks.
 * Binary only: PASS or FAIL.
 */
export interface TraceFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Trace Validation Matrix
// ---------------------------------------------------------------------------

/**
 * Validation matrix for trace entry structural checks.
 * Overall: PASS only if ALL fields pass.
 */
export interface TraceValidationMatrix {
  fields: TraceFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// CI Trace Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement for trace integrity.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode.
 */
export interface CITraceEnforcementResult {
  result: 'PASS' | 'FAIL';
  brokenLinks: number;
  hashMismatches: number;
  sequenceGaps: number;
  totalEntries: number;
}

// ---------------------------------------------------------------------------
// Genesis Hash Constant
// ---------------------------------------------------------------------------

/**
 * Genesis hash — the previousTraceHash for the first entry in a chain.
 * 64 zero characters (SHA-256 of nothing / chain origin).
 * This is a structural constant, not a computed hash.
 */
export const GENESIS_TRACE_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
