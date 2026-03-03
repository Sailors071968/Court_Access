// ============================================
// Court Access — Daily Anchor Engine (Phase 7)
// Time Anchored Trust Layer (TATL)
//
// Binds export artifacts into daily Merkle roots.
// Append-only anchor chain with gap detection.
// No UI dependencies. No React imports.
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

import type {
  DailyAnchorEntity,
  DailyAnchorInput,
  AnchorVerificationResult,
  AnchorGapDetectionResult,
} from '../models/AnchorModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Merkle Tree Construction — deterministic
// ---------------------------------------------------------------------------

/**
 * Build a deterministic Merkle root from an array of hashes.
 *
 * Algorithm:
 *   1. Sort input hashes using deterministic ASCII comparator (no localeCompare)
 *   2. If empty input → return SHA-256 of empty string
 *   3. If odd number of leaves → duplicate last leaf
 *   4. Pair leaves left/right deterministically (index 0+1, 2+3, ...)
 *   5. Concatenate left + right as literal string (no separator)
 *   6. Hash pair with SHA-256
 *   7. Repeat until single root remains
 *
 * No random padding. No timestamp mixing. No salt.
 * No localeCompare — uses ASCII comparator only.
 *
 * This is a pure function — same input always produces same output.
 */
export async function buildMerkleRoot(hashes: string[]): Promise<string> {
  // Step 1: Sort using deterministic ASCII comparator
  const sorted = [...hashes].sort(
    (a, b) => a < b ? -1 : a > b ? 1 : 0
  );

  // Step 2: Empty input → hash of empty string
  if (sorted.length === 0) {
    return computeTextSHA256('');
  }

  // Initialize leaves
  let currentLevel = sorted;

  // Step 7: Repeat until single root
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    // Step 3: If odd number → duplicate last leaf
    if (currentLevel.length % 2 !== 0) {
      currentLevel = [...currentLevel, currentLevel[currentLevel.length - 1]];
    }

    // Step 4-6: Pair and hash
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1];
      // Step 5: Concatenate as literal string (no separator)
      const combined = left + right;
      // Step 6: Hash pair with SHA-256
      const pairHash = await computeTextSHA256(combined);
      nextLevel.push(pairHash);
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

// ---------------------------------------------------------------------------
// Canonical JSON construction — fixed key order
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for DailyAnchorEntity.
 * Key order is FIXED and DOCUMENTED:
 *   1. "date"
 *   2. "merkleRoot"
 *   3. "scopeHash"
 *   4. "immutableCoreHash"
 *   5. "epoch"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 * Uses JSON.stringify on individual values for RFC 8259 escaping.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeAnchor(
  date: string,
  merkleRoot: string,
  scopeHash: string,
  immutableCoreHash: string,
  epoch: number
): string {
  return (
    '{' +
    `"date":${JSON.stringify(date)},` +
    `"merkleRoot":${JSON.stringify(merkleRoot)},` +
    `"scopeHash":${JSON.stringify(scopeHash)},` +
    `"immutableCoreHash":${JSON.stringify(immutableCoreHash)},` +
    `"epoch":${JSON.stringify(epoch)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Identity derivation — deterministic from date ONLY
// ---------------------------------------------------------------------------

/**
 * Canonical identity string for anchor ID derivation.
 * Derived from date ONLY.
 *
 * Does NOT include:
 *   - merkleRoot
 *   - scopeHash
 *   - immutableCoreHash
 *   - epoch
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeAnchorIdentity(date: string): string {
  return `{"date":${JSON.stringify(date)}}`;
}

/**
 * Derive a deterministic anchor ID from date.
 * Computes SHA-256 of canonical identity JSON, then extracts 16 hex chars.
 *
 * ID derived ONLY from: date.
 * Not from: merkleRoot, scopeHash, immutableCoreHash, epoch.
 *
 * This is a pure function — same input always produces same output.
 */
async function deriveAnchorId(date: string): Promise<string> {
  const canonical = canonicalizeAnchorIdentity(date);
  const hash = await computeTextSHA256(canonical);
  const prefixEnd = hash.indexOf(':');
  return hash.slice(prefixEnd + 1, prefixEnd + 17);
}

// ---------------------------------------------------------------------------
// Daily Anchor Construction Pipeline
// ---------------------------------------------------------------------------

/**
 * Build a daily anchor record from export CAPS hashes.
 *
 * Pipeline:
 *   1. Build Merkle root from sorted export CAPS hashes
 *   2. Canonicalize anchor to JSON (fixed key order)
 *   3. Dual-hash canonical JSON (SHA-256 + SHA3-256)
 *   4. Derive deterministic ID from date ONLY
 *   5. Return DailyAnchorEntity
 *
 * Constitutional constraints:
 *   - ID derived from date ONLY
 *   - Hashes sorted via deterministic ASCII comparator before Merkle construction
 *   - No Date.now(). No runtime timestamps.
 *   - No mutation. Append-only.
 */
export async function buildDailyAnchor(
  input: DailyAnchorInput
): Promise<DailyAnchorEntity> {
  // Step 1: Build Merkle root
  const merkleRoot = await buildMerkleRoot(input.exportCapsHashes);

  // Step 2: Canonicalize anchor
  const canonical = canonicalizeAnchor(
    input.date,
    merkleRoot,
    input.scopeHash,
    input.immutableCoreHash,
    input.epoch
  );

  // Step 3: Dual-hash canonical JSON
  const contentHash = await computeTextSHA256(canonical);
  const sha3Hash = computeTextSHA3_256(canonical);

  // Step 4: Derive deterministic ID from date ONLY
  const id = await deriveAnchorId(input.date);

  // Step 5: Return entity
  return {
    id,
    date: input.date,
    merkleRoot,
    scopeHash: input.scopeHash,
    immutableCoreHash: input.immutableCoreHash,
    epoch: input.epoch,
    contentHash,
    sha3Hash,
  };
}

// ---------------------------------------------------------------------------
// Anchor Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of a DailyAnchorEntity.
 *
 * Re-computes the canonical JSON serialization from the entity,
 * then re-hashes and compares to stored hashes.
 *
 * Returns verified: true ONLY if BOTH hashes match.
 * Does NOT auto-correct hashes. Never modifies the entity.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyAnchorIntegrity(
  entity: DailyAnchorEntity
): Promise<AnchorVerificationResult> {
  // Rebuild canonical JSON from entity fields
  const canonical = canonicalizeAnchor(
    entity.date,
    entity.merkleRoot,
    entity.scopeHash,
    entity.immutableCoreHash,
    entity.epoch
  );

  // Re-hash
  const computedSha256 = await computeTextSHA256(canonical);
  const computedSha3 = computeTextSHA3_256(canonical);

  return {
    verified: computedSha256 === entity.contentHash && computedSha3 === entity.sha3Hash,
    computedSha256,
    computedSha3,
  };
}

// ---------------------------------------------------------------------------
// Append-Only Anchor Store
// ---------------------------------------------------------------------------

/**
 * Append-only anchor store.
 *
 * Rules:
 *   - addAnchor(): appends a new anchor record. Throws if date already exists.
 *   - getAnchorByDate(): retrieves an anchor by date. Returns null if not found.
 *   - No update method. No delete method. No mutation.
 *
 * In-memory implementation for Phase 7.
 * Will be replaced with persistent storage in later phases.
 */
export class AnchorStore {
  private readonly anchors: Map<string, DailyAnchorEntity> = new Map();

  /**
   * Append a new anchor record.
   * Throws if an anchor for the given date already exists.
   * No update. No overwrite. Append-only.
   */
  addAnchor(anchor: DailyAnchorEntity): void {
    if (this.anchors.has(anchor.date)) {
      throw new Error(
        `Anchor for date "${anchor.date}" already exists. ` +
        'Append-only: anchors cannot be updated or overwritten.'
      );
    }
    this.anchors.set(anchor.date, anchor);
  }

  /**
   * Retrieve an anchor by date.
   * Returns null if no anchor exists for the given date.
   */
  getAnchorByDate(date: string): DailyAnchorEntity | null {
    return this.anchors.get(date) ?? null;
  }

  /**
   * Get all anchors sorted by date (deterministic ASCII comparator).
   * Returns a new array — the internal store is not exposed.
   */
  getAllAnchors(): DailyAnchorEntity[] {
    const all = Array.from(this.anchors.values());
    return all.sort(
      (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
  }
}

// ---------------------------------------------------------------------------
// Gap Detection — binary PASS/FAIL
// ---------------------------------------------------------------------------

/**
 * Parse a YYYY-MM-DD date string into year, month, day components.
 * No Date object construction — pure arithmetic parsing.
 *
 * This is a pure function — same input always produces same output.
 */
function parseDateComponents(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
  };
}

/**
 * Get the number of days in a given month/year.
 * Accounts for leap years deterministically.
 *
 * This is a pure function — same input always produces same output.
 */
function daysInMonth(year: number, month: number): number {
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2) {
    // Leap year: divisible by 4, except centuries unless divisible by 400
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  return days[month];
}

/**
 * Compute the next calendar day from a YYYY-MM-DD string.
 * Pure arithmetic — no Date object, no timezone ambiguity.
 *
 * This is a pure function — same input always produces same output.
 */
function nextDay(dateStr: string): string {
  const { year, month, day } = parseDateComponents(dateStr);
  const maxDay = daysInMonth(year, month);

  let nextYear = year;
  let nextMonth = month;
  let nextDayNum = day + 1;

  if (nextDayNum > maxDay) {
    nextDayNum = 1;
    nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
  }

  const yStr = String(nextYear).padStart(4, '0');
  const mStr = String(nextMonth).padStart(2, '0');
  const dStr = String(nextDayNum).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Detect gaps in a list of anchor records.
 *
 * Rules:
 *   - Dates must be consecutive (YYYY-MM-DD, no gaps)
 *   - Returns PASS if all dates are consecutive (or list has 0-1 entries)
 *   - Returns FAIL if any gap exists
 *   - No explanation text. No scoring. Binary output only.
 *
 * Anchors are sorted by date using deterministic ASCII comparator before checking.
 *
 * This is a pure function — same input always produces same output.
 */
export function detectAnchorGap(
  anchorList: DailyAnchorEntity[]
): AnchorGapDetectionResult {
  // 0 or 1 anchors → no gap possible
  if (anchorList.length <= 1) {
    return { result: 'PASS' };
  }

  // Sort by date using deterministic ASCII comparator
  const sorted = [...anchorList].sort(
    (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  // Check consecutive dates
  for (let i = 0; i < sorted.length - 1; i++) {
    const expectedNext = nextDay(sorted[i].date);
    if (sorted[i + 1].date !== expectedNext) {
      return { result: 'FAIL' };
    }
  }

  return { result: 'PASS' };
}
