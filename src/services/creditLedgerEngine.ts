// ============================================
// Court Access — Credit Ledger Engine (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Append-only ledger engine.
// No UPDATE. No DELETE. Dual-hashed entries.
// Canonical JSON serialization with fixed key order.
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
//   - Canonical JSON with fixed key order
//   - ASCII comparator only
// ============================================

import type {
  LedgerEntry,
  LedgerEntryInput,
  LedgerVerificationResult,
  LedgerFieldValidation,
  LedgerValidationMatrix,
} from '../models/CreditLedgerModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — fixed key order
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for a ledger entry (pre-hash).
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "tenantId"
 *   2. "eventType"
 *   3. "eventTimestamp"
 *   4. "creditAmount"
 *   5. "balanceAfter"
 *   6. "referenceId"
 *   7. "referenceType"
 *   8. "description"
 *
 * This is the canonical form used for ID derivation and dual-hash computation.
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeLedgerEntry(
  tenantId: string,
  eventType: string,
  eventTimestamp: string,
  creditAmount: number,
  balanceAfter: number,
  referenceId: string,
  referenceType: string,
  description: string
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"eventType":${JSON.stringify(eventType)},` +
    `"eventTimestamp":${JSON.stringify(eventTimestamp)},` +
    `"creditAmount":${JSON.stringify(creditAmount)},` +
    `"balanceAfter":${JSON.stringify(balanceAfter)},` +
    `"referenceId":${JSON.stringify(referenceId)},` +
    `"referenceType":${JSON.stringify(referenceType)},` +
    `"description":${JSON.stringify(description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Ledger Entry Construction
// ---------------------------------------------------------------------------

/**
 * Build a ledger entry from input.
 *
 * Pipeline:
 *   1. Build canonical JSON from input fields
 *   2. Compute SHA-256 of canonical JSON → sha256
 *   3. Compute SHA3-256 of canonical JSON → sha3_256
 *   4. Derive deterministic ID from canonical JSON (first 16 hex chars of sha256)
 *   5. Return LedgerEntry with all fields populated
 *
 * No Date.now(). No runtime timestamps. Timestamp is provided by caller.
 * No mutation. Returns a new entry.
 *
 * This is a pure function — same input always produces same output.
 */
export async function buildLedgerEntry(
  input: LedgerEntryInput
): Promise<LedgerEntry> {
  const canonical = canonicalizeLedgerEntry(
    input.tenantId,
    input.eventType,
    input.eventTimestamp,
    input.creditAmount,
    input.balanceAfter,
    input.referenceId,
    input.referenceType,
    input.description
  );

  const sha256 = await computeTextSHA256(canonical);
  const sha3_256 = computeTextSHA3_256(canonical);
  const id = sha256.slice(0, 16);

  return {
    id,
    tenantId: input.tenantId,
    eventType: input.eventType,
    eventTimestamp: input.eventTimestamp,
    creditAmount: input.creditAmount,
    balanceAfter: input.balanceAfter,
    referenceId: input.referenceId,
    referenceType: input.referenceType,
    description: input.description,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Ledger Entry Verification
// ---------------------------------------------------------------------------

/**
 * Verify a ledger entry's integrity via dual-hash.
 *
 * Recomputes canonical JSON from the entry's fields,
 * then computes SHA-256 and SHA3-256 on demand.
 * Compares against stored hashes.
 *
 * verified = true ONLY if BOTH hashes match.
 * No auto-correction. No mutation.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyLedgerEntry(
  entry: LedgerEntry
): Promise<LedgerVerificationResult> {
  const canonical = canonicalizeLedgerEntry(
    entry.tenantId,
    entry.eventType,
    entry.eventTimestamp,
    entry.creditAmount,
    entry.balanceAfter,
    entry.referenceId,
    entry.referenceType,
    entry.description
  );

  const computedSha256 = await computeTextSHA256(canonical);
  const computedSha3_256 = computeTextSHA3_256(canonical);

  return {
    verified: computedSha256 === entry.sha256 && computedSha3_256 === entry.sha3_256,
    computedSha256,
    computedSha3_256,
  };
}

// ---------------------------------------------------------------------------
// Append-Only Ledger Store
// ---------------------------------------------------------------------------

/**
 * Append-only ledger store.
 *
 * Rules:
 *   - appendEntry(): appends a new ledger entry. Throws if ID already exists.
 *   - getEntryById(): retrieves an entry by ID. Returns null if not found.
 *   - getEntriesByTenant(): retrieves all entries for a tenant, sorted by eventTimestamp (ASCII).
 *   - No update method. No delete method. No mutation.
 *
 * In-memory implementation for Phase 12.
 * Will be replaced with persistent storage in later phases.
 */
export class LedgerStore {
  private readonly entries: Map<string, LedgerEntry> = new Map();

  /**
   * Append a new ledger entry.
   * Throws if an entry with the same ID already exists.
   * No update. No overwrite. Append-only.
   */
  appendEntry(entry: LedgerEntry): void {
    if (this.entries.has(entry.id)) {
      throw new Error(
        `Ledger entry with ID "${entry.id}" already exists. ` +
        'Append-only: entries cannot be updated or overwritten.'
      );
    }
    this.entries.set(entry.id, entry);
  }

  /**
   * Retrieve a ledger entry by ID.
   * Returns null if no entry exists with the given ID.
   */
  getEntryById(id: string): LedgerEntry | null {
    return this.entries.get(id) ?? null;
  }

  /**
   * Get all entries for a tenant, sorted by eventTimestamp (ASCII comparator).
   * Returns a new array — the internal store is not exposed.
   */
  getEntriesByTenant(tenantId: string): LedgerEntry[] {
    const tenantEntries: LedgerEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.tenantId === tenantId) {
        tenantEntries.push(entry);
      }
    }
    return tenantEntries.sort(
      (a, b) =>
        a.eventTimestamp < b.eventTimestamp ? -1 :
        a.eventTimestamp > b.eventTimestamp ? 1 : 0
    );
  }

  /**
   * Get all entries, sorted by eventTimestamp (ASCII comparator).
   * Returns a new array — the internal store is not exposed.
   */
  getAllEntries(): LedgerEntry[] {
    const all = Array.from(this.entries.values());
    return all.sort(
      (a, b) =>
        a.eventTimestamp < b.eventTimestamp ? -1 :
        a.eventTimestamp > b.eventTimestamp ? 1 : 0
    );
  }
}

// ---------------------------------------------------------------------------
// Ledger Entry Validation Matrix — PASS/FAIL only
// ---------------------------------------------------------------------------

/**
 * Validate a ledger entry structure.
 *
 * Each required field is validated independently:
 *   - id: must be 16 lowercase hex characters
 *   - tenantId: must be non-empty string
 *   - eventType: must be a valid LedgerEventType
 *   - eventTimestamp: must match ISO 8601 pattern
 *   - creditAmount: must be integer
 *   - balanceAfter: must be non-negative integer
 *   - referenceId: must be non-empty string
 *   - referenceType: must be non-empty string
 *   - sha256: must be 64 lowercase hex characters
 *   - sha3_256: must be 64 lowercase hex characters
 *
 * Overall: PASS only if ALL fields pass.
 * No partial pass. Binary only.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateLedgerEntry(
  entry: LedgerEntry
): LedgerValidationMatrix {
  const fields: LedgerFieldValidation[] = [];

  const isValidHex = (value: string, length: number): boolean =>
    typeof value === 'string' &&
    value.length === length &&
    new RegExp(`^[0-9a-f]{${length}}$`).test(value);

  const VALID_EVENT_TYPES = [
    'CREDIT_PURCHASE_EVENT',
    'CREDIT_CONSUMPTION_EVENT',
    'ARCHIVE_EVENT',
    'RESTORE_EVENT',
    'PURGE_EVENT',
    'EXPIRATION_NOTICE_EVENT',
  ];

  fields.push({
    field: 'id',
    result: isValidHex(entry.id, 16) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'tenantId',
    result:
      typeof entry.tenantId === 'string' && entry.tenantId.length > 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'eventType',
    result: VALID_EVENT_TYPES.indexOf(entry.eventType) !== -1 ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'eventTimestamp',
    result:
      typeof entry.eventTimestamp === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry.eventTimestamp)
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'creditAmount',
    result: Number.isInteger(entry.creditAmount) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'balanceAfter',
    result:
      Number.isInteger(entry.balanceAfter) && entry.balanceAfter >= 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'referenceId',
    result:
      typeof entry.referenceId === 'string' && entry.referenceId.length > 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'referenceType',
    result:
      typeof entry.referenceType === 'string' && entry.referenceType.length > 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'sha256',
    result: isValidHex(entry.sha256, 64) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'sha3_256',
    result: isValidHex(entry.sha3_256, 64) ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
