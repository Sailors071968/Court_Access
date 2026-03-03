// ============================================
// Court Access — Officer Structural Index Engine (Phase 5)
// Officer Cross-Case Structural Index Engine
//
// Aggregates structural data across cases for a given officer.
// No UI dependencies. No React imports.
//
// Constitutional boundaries (Phase 6 — Officer Cross-Case Index):
//   - No officer ranking
//   - No percentile assignment
//   - No probability assignment
//   - No anomaly detection
//   - No score production
//   - No risk labels
//   - No intent inference
//   - No strategy recommendations
//   - No cross-officer comparison
//   - No relative metrics
//   - Aggregation only. No evaluation.
// ============================================

import type {
  OfficerStructuralIndexEntity,
  OfficerIndexInput,
  OfficerDocumentReference,
  OfficerIndexVerificationResult,
} from '../models/OfficerIndexModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Officer identifier normalization — deterministic
// ---------------------------------------------------------------------------

/**
 * Normalize an officer identifier deterministically.
 *
 * Rules:
 *   1. Trim leading and trailing whitespace
 *   2. Collapse all consecutive whitespace (spaces, tabs) into single space
 *   3. Preserve case — no locale-dependent transforms
 *
 * This is a pure function — same input always produces same output.
 */
function normalizeOfficerIdentifier(raw: string): string {
  return raw.trim().replace(/[ \t]+/g, ' ');
}

// ---------------------------------------------------------------------------
// Phrase counting — exact substring match only
// ---------------------------------------------------------------------------

/**
 * Count exact substring occurrences of a phrase in text.
 *
 * Rules:
 *   - Case-sensitive exact substring match
 *   - No fuzzy matching. No NLP. No stemming.
 *   - No dynamic phrase discovery.
 *   - Counts all non-overlapping occurrences left-to-right.
 *
 * Case-sensitivity decision: CASE-SENSITIVE.
 * Documented per Phase 5 directive requirement.
 *
 * This is a pure function — same input always produces same output.
 */
function countExactSubstring(text: string, phrase: string): number {
  if (phrase.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while (pos <= text.length - phrase.length) {
    const idx = text.indexOf(phrase, pos);
    if (idx === -1) break;
    count++;
    pos = idx + phrase.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Canonical JSON construction — fixed key order
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for OfficerStructuralIndexEntity.
 * Key order is FIXED and DOCUMENTED:
 *   1. "tenantId"
 *   2. "officerIdentifier"
 *   3. "documentCount"
 *   4. "phraseFrequency" (keys sorted lexicographically)
 *   5. "firstSeen"
 *   6. "lastSeen"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 * Uses JSON.stringify on individual values for RFC 8259 escaping.
 * Phrase keys are sorted via deterministic ASCII comparator before serialization.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeOfficerIndex(
  tenantId: string,
  officerIdentifier: string,
  documentCount: number,
  phraseFrequency: { [phrase: string]: number },
  firstSeen: string,
  lastSeen: string
): string {
  // Sort phrase keys via deterministic ASCII comparator — no locale-sensitive operations
  const sortedPhraseKeys = Object.keys(phraseFrequency).sort(
    (a, b) => a < b ? -1 : a > b ? 1 : 0
  );

  // Build phraseFrequency JSON with sorted keys via explicit string construction
  const phraseEntries = sortedPhraseKeys.map(
    (key) => `${JSON.stringify(key)}:${JSON.stringify(phraseFrequency[key])}`
  );
  const phraseJson = `{${phraseEntries.join(',')}}`;

  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"officerIdentifier":${JSON.stringify(officerIdentifier)},` +
    `"documentCount":${JSON.stringify(documentCount)},` +
    `"phraseFrequency":${phraseJson},` +
    `"firstSeen":${JSON.stringify(firstSeen)},` +
    `"lastSeen":${JSON.stringify(lastSeen)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Identity derivation — deterministic from tenantId + officerIdentifier ONLY
// ---------------------------------------------------------------------------

/**
 * Canonical identity string for officer ID derivation.
 * Key order is FIXED: tenantId, officerIdentifier.
 *
 * Does NOT include:
 *   - documentCount
 *   - phraseFrequency
 *   - firstSeen / lastSeen timestamps
 *
 * Structural identity only — WHERE the officer exists, not WHAT is aggregated.
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeOfficerIdentity(
  tenantId: string,
  officerIdentifier: string
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"officerIdentifier":${JSON.stringify(officerIdentifier)}` +
    '}'
  );
}

/**
 * Derive a deterministic officer ID from identity fields.
 * Computes SHA-256 of canonical identity JSON, then extracts 16 hex chars.
 *
 * ID derived ONLY from: tenantId + officerIdentifier.
 * Not from: documentCount, phraseFrequency, timestamps.
 *
 * This is a pure function — same input always produces same output.
 */
async function deriveOfficerId(
  tenantId: string,
  officerIdentifier: string
): Promise<string> {
  const canonical = canonicalizeOfficerIdentity(tenantId, officerIdentifier);
  const hash = await computeTextSHA256(canonical);
  const prefixEnd = hash.indexOf(':');
  return hash.slice(prefixEnd + 1, prefixEnd + 17);
}

// ---------------------------------------------------------------------------
// Officer Structural Index Construction Pipeline
// ---------------------------------------------------------------------------

/**
 * Build an officer structural index from document references.
 *
 * Pipeline:
 *   1. Normalize officer identifier (trim, collapse whitespace, preserve case)
 *   2. Deduplicate documents by documentId (deterministic — first occurrence wins)
 *   3. Sort documents by documentDate ascending (lexicographic, deterministic)
 *   4. Compute documentCount (unique documents only)
 *   5. Compute phraseFrequency (exact substring match across all documents)
 *   6. Derive firstSeen from earliest document date
 *   7. Derive lastSeen from latest document date
 *   8. Canonicalize entity to JSON (fixed key order, sorted phrase keys)
 *   9. Dual-hash canonical JSON (SHA-256 + SHA3-256)
 *  10. Derive deterministic ID from identity fields only
 *  11. Return OfficerStructuralIndexEntity
 *
 * Constitutional constraints:
 *   - ID derived from tenantId + officerIdentifier ONLY
 *   - Phrase keys sorted lexicographically before hashing
 *   - Documents sorted by date before timestamp derivation
 *   - All arrays explicitly sorted. No unordered iteration.
 *   - No randomness. No Date.now(). No non-deterministic branching.
 *   - No officer ranking. No scoring. No relative metrics.
 */
export async function buildOfficerStructuralIndex(
  input: OfficerIndexInput
): Promise<OfficerStructuralIndexEntity> {
  // Step 1: Normalize officer identifier
  const officerIdentifier = normalizeOfficerIdentifier(input.officerIdentifier);

  // Step 2: Deduplicate documents by documentId
  // Deterministic: iterate in input order, first occurrence wins
  const seenDocumentIds = new Set<string>();
  const uniqueDocuments: OfficerDocumentReference[] = [];
  for (const doc of input.documentReferences) {
    if (!seenDocumentIds.has(doc.documentId)) {
      seenDocumentIds.add(doc.documentId);
      uniqueDocuments.push(doc);
    }
  }

  // Step 3: Sort documents by documentDate ascending (deterministic ASCII comparator)
  const sortedDocuments = [...uniqueDocuments].sort(
    (a, b) => a.documentDate < b.documentDate ? -1 : a.documentDate > b.documentDate ? 1 : 0
  );

  // Step 4: Compute documentCount
  const documentCount = sortedDocuments.length;

  // Step 5: Compute phraseFrequency
  // Sort phrase list via deterministic ASCII comparator before processing
  const sortedPhraseList = [...input.phraseList].sort(
    (a, b) => a < b ? -1 : a > b ? 1 : 0
  );
  const phraseFrequency: { [phrase: string]: number } = {};
  for (const phrase of sortedPhraseList) {
    let totalCount = 0;
    for (const doc of sortedDocuments) {
      totalCount += countExactSubstring(doc.documentText, phrase);
    }
    phraseFrequency[phrase] = totalCount;
  }

  // Step 6: Derive firstSeen (earliest document date)
  // sortedDocuments is already sorted ascending by date
  const firstSeen = sortedDocuments.length > 0 ? sortedDocuments[0].documentDate : '';

  // Step 7: Derive lastSeen (latest document date)
  const lastSeen = sortedDocuments.length > 0
    ? sortedDocuments[sortedDocuments.length - 1].documentDate
    : '';

  // Step 8: Canonicalize entity to JSON
  const canonical = canonicalizeOfficerIndex(
    input.tenantId,
    officerIdentifier,
    documentCount,
    phraseFrequency,
    firstSeen,
    lastSeen
  );

  // Step 9: Dual-hash canonical JSON
  const contentHash = await computeTextSHA256(canonical);
  const sha3Hash = computeTextSHA3_256(canonical);

  // Step 10: Derive deterministic ID from identity fields ONLY
  const id = await deriveOfficerId(input.tenantId, officerIdentifier);

  // Step 11: Return entity
  return {
    id,
    tenantId: input.tenantId,
    officerIdentifier,
    documentCount,
    phraseFrequency,
    firstSeen,
    lastSeen,
    contentHash,
    sha3Hash,
  };
}

// ---------------------------------------------------------------------------
// Integrity verification — deterministic re-hash and compare
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of an OfficerStructuralIndexEntity.
 *
 * Re-computes the canonical JSON serialization from the entity,
 * then re-hashes and compares to stored hashes.
 *
 * Returns verified: true ONLY if BOTH hashes match.
 * Does NOT auto-correct hashes. Never modifies the entity.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyOfficerStructuralIndexIntegrity(
  entity: OfficerStructuralIndexEntity
): Promise<OfficerIndexVerificationResult> {
  // Rebuild canonical JSON from entity fields
  const canonical = canonicalizeOfficerIndex(
    entity.tenantId,
    entity.officerIdentifier,
    entity.documentCount,
    entity.phraseFrequency,
    entity.firstSeen,
    entity.lastSeen
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
