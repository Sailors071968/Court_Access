// ============================================
// Court Access — Credit Ledger Model (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Append-only ledger for all lifecycle and credit events.
// No UPDATE. No DELETE. Dual-hashed.
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
//   - No mutation of existing entries
//   - Append-only discipline
//   - Dual-hash enforcement
// ============================================

// ---------------------------------------------------------------------------
// Ledger Event Types — additive-only
// ---------------------------------------------------------------------------

/**
 * Ledger event type identifiers.
 * Additive-only — new event types may be added, none removed.
 *
 * Credit events:
 *   - CREDIT_PURCHASE_EVENT: credits purchased
 *   - CREDIT_CONSUMPTION_EVENT: credits consumed
 *
 * Archive lifecycle events:
 *   - ARCHIVE_EVENT: tenant/case archived
 *   - RESTORE_EVENT: tenant/case restored from archive
 *   - PURGE_EVENT: data purged (after retention expiry)
 *   - EXPIRATION_NOTICE_EVENT: notice before purge (grace period)
 */
export type LedgerEventType =
  | 'CREDIT_PURCHASE_EVENT'
  | 'CREDIT_CONSUMPTION_EVENT'
  | 'ARCHIVE_EVENT'
  | 'RESTORE_EVENT'
  | 'PURGE_EVENT'
  | 'EXPIRATION_NOTICE_EVENT';

// ---------------------------------------------------------------------------
// Ledger Entry Entity — append-only, dual-hashed
// ---------------------------------------------------------------------------

/**
 * A single ledger entry.
 *
 * Append-only:
 *   - Once created, a ledger entry is NEVER updated or deleted.
 *   - There is no update method. There is no delete method.
 *
 * Dual-hash:
 *   - SHA-256 and SHA3-256 are computed from canonical JSON at creation.
 *   - Both hashes are immutable once set.
 *
 * All fields are REQUIRED. No optional fields. No null fields.
 */
export interface LedgerEntry {
  id: string;                          // Deterministic — derived from canonical fields
  tenantId: string;
  eventType: LedgerEventType;
  eventTimestamp: string;              // ISO 8601 UTC — deterministic input, not Date.now()
  creditAmount: number;                // Integer — positive for purchase, negative for consumption, 0 for lifecycle
  balanceAfter: number;                // Integer — credit balance after this event
  referenceId: string;                 // ID of related entity (archiveId, documentId, transactionId, etc.)
  referenceType: string;               // Type of reference ("archive", "document", "transaction", etc.)
  description: string;                 // Human-readable, deterministic description
  sha256: string;                      // SHA-256 of canonical entry JSON (raw 64-char lowercase hex)
  sha3_256: string;                    // SHA3-256 of canonical entry JSON (raw 64-char lowercase hex)
}

// ---------------------------------------------------------------------------
// Ledger Entry Input — pre-hash
// ---------------------------------------------------------------------------

/**
 * Input for creating a ledger entry.
 * The engine computes ID and dual-hash from canonical JSON.
 */
export interface LedgerEntryInput {
  tenantId: string;
  eventType: LedgerEventType;
  eventTimestamp: string;              // ISO 8601 UTC — caller provides, not Date.now()
  creditAmount: number;                // Integer
  balanceAfter: number;                // Integer
  referenceId: string;
  referenceType: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Ledger Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying a ledger entry's integrity.
 * Dual-hash verification — both must match.
 * Binary only: verified = true ONLY if BOTH hashes match.
 */
export interface LedgerVerificationResult {
  verified: boolean;
  computedSha256: string;
  computedSha3_256: string;
}

// ---------------------------------------------------------------------------
// Ledger Validation Field
// ---------------------------------------------------------------------------

/**
 * Single field validation for a ledger entry.
 * Binary only: PASS or FAIL.
 */
export interface LedgerFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Ledger Validation Matrix
// ---------------------------------------------------------------------------

/**
 * Validation matrix for a ledger entry.
 * Overall: PASS only if ALL fields pass.
 * No partial pass. Binary only.
 */
export interface LedgerValidationMatrix {
  fields: LedgerFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}
