// ============================================
// Court Access — Audit Trace Engine (Phase 15)
// Deterministic Audit Trace Layer (Reproducibility Spine)
//
// Operation hash chaining, dual-hash trace entries,
// chain verification, deterministic reconstruction,
// and CI enforcement hook.
//
// This engine creates full lifecycle reproducibility:
//   document → export → CAPS → anchor → archive
//   Every operation is hash-chained, dual-hashed, and
//   cross-referenced to its source phase.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import signatureEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - No circular dependencies
//   - Consumes only: AuditTraceModel, policyIngestionService (hash functions)
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
//   - Deterministic reconstruction from trace alone
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
//   - No interpretive output
// ============================================

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  AuditTraceEntry,
  AuditTraceInput,
  CrossPhaseReference,
  ChainLinkVerification,
  ChainVerificationResult,
  TraceFieldValidation,
  TraceValidationMatrix,
  CITraceEnforcementResult,
} from '../models/AuditTraceModel';

import { GENESIS_TRACE_HASH } from '../models/AuditTraceModel';

// ---------------------------------------------------------------------------
// ASCII Comparator — deterministic sorting
// ---------------------------------------------------------------------------

/**
 * ASCII comparator for deterministic sorting.
 * No localeCompare. No locale sensitivity.
 */
function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Cross-Phase Reference Sorting
// ---------------------------------------------------------------------------

/**
 * Sort cross-phase references deterministically.
 *
 * Sort order:
 *   1. By phase (ascending numeric)
 *   2. By artifactType (ASCII comparator)
 *   3. By artifactId (ASCII comparator)
 *
 * Returns a new sorted array — does NOT mutate input.
 */
function sortCrossPhaseRefs(refs: CrossPhaseReference[]): CrossPhaseReference[] {
  return [...refs].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase < b.phase ? -1 : 1;
    const typeCompare = asciiCompare(a.artifactType, b.artifactType);
    if (typeCompare !== 0) return typeCompare;
    return asciiCompare(a.artifactId, b.artifactId);
  });
}

// ---------------------------------------------------------------------------
// Canonical JSON — Pre-ID Form (excludes traceId and hashes)
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for trace ID derivation.
 *
 * Includes:
 *   sequenceNumber, tenantId, operationType, operationTimestamp,
 *   previousTraceHash, crossPhaseRefs, operationPayloadHash, description
 *
 * Excludes:
 *   traceId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Fixed key order. Explicit string concatenation.
 * No reliance on JSON.stringify key insertion order.
 */
function canonicalizeTracePreId(input: AuditTraceInput): string {
  const sortedRefs = sortCrossPhaseRefs(input.crossPhaseRefs);

  // Serialize crossPhaseRefs with fixed key order
  const refsJson = '[' + sortedRefs.map((ref) =>
    '{' +
    `"phase":${JSON.stringify(ref.phase)},` +
    `"artifactType":${JSON.stringify(ref.artifactType)},` +
    `"artifactId":${JSON.stringify(ref.artifactId)},` +
    `"artifactHash":${JSON.stringify(ref.artifactHash)}` +
    '}'
  ).join(',') + ']';

  return (
    '{' +
    `"sequenceNumber":${JSON.stringify(input.sequenceNumber)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"operationType":${JSON.stringify(input.operationType)},` +
    `"operationTimestamp":${JSON.stringify(input.operationTimestamp)},` +
    `"previousTraceHash":${JSON.stringify(input.previousTraceHash)},` +
    `"crossPhaseRefs":${refsJson},` +
    `"operationPayloadHash":${JSON.stringify(input.operationPayloadHash)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Full Form (includes traceId, excludes hashes)
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes:
 *   traceId, sequenceNumber, tenantId, operationType, operationTimestamp,
 *   previousTraceHash, crossPhaseRefs, operationPayloadHash, description
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * Fixed key order. Explicit string concatenation.
 * No circular hash binding — hashes derived FROM this form, appended AFTER.
 */
function canonicalizeTraceFull(
  traceId: string,
  input: AuditTraceInput
): string {
  const sortedRefs = sortCrossPhaseRefs(input.crossPhaseRefs);

  // Serialize crossPhaseRefs with fixed key order
  const refsJson = '[' + sortedRefs.map((ref) =>
    '{' +
    `"phase":${JSON.stringify(ref.phase)},` +
    `"artifactType":${JSON.stringify(ref.artifactType)},` +
    `"artifactId":${JSON.stringify(ref.artifactId)},` +
    `"artifactHash":${JSON.stringify(ref.artifactHash)}` +
    '}'
  ).join(',') + ']';

  return (
    '{' +
    `"traceId":${JSON.stringify(traceId)},` +
    `"sequenceNumber":${JSON.stringify(input.sequenceNumber)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"operationType":${JSON.stringify(input.operationType)},` +
    `"operationTimestamp":${JSON.stringify(input.operationTimestamp)},` +
    `"previousTraceHash":${JSON.stringify(input.previousTraceHash)},` +
    `"crossPhaseRefs":${refsJson},` +
    `"operationPayloadHash":${JSON.stringify(input.operationPayloadHash)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Audit Trace Entry
// ---------------------------------------------------------------------------

/**
 * Build a new audit trace entry from input.
 *
 * Pipeline:
 *   1. Sort crossPhaseRefs (phase ASC, artifactType ASC, artifactId ASC)
 *   2. Canonicalize pre-ID form (excludes traceId and hashes)
 *   3. Derive traceId = SHA-256(preIdCanonical)
 *   4. Canonicalize full form (includes traceId, excludes hashes)
 *   5. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   6. Return complete AuditTraceEntry
 *
 * No circular hash binding:
 *   - traceId derived from pre-ID canonical (which excludes traceId)
 *   - sha256/sha3_256 derived from full canonical (which excludes hashes)
 *   - Hashes appended AFTER computation
 *
 * Async because SHA-256 uses crypto.subtle.digest (Web Crypto API).
 * Deterministic — same input always produces same output.
 */
export async function buildAuditTraceEntry(input: AuditTraceInput): Promise<AuditTraceEntry> {
  const sortedRefs = sortCrossPhaseRefs(input.crossPhaseRefs);

  // Step 1: Pre-ID canonical → derive traceId
  const preIdCanonical = canonicalizeTracePreId(input);
  const traceId = await computeTextSHA256(preIdCanonical);

  // Step 2: Full canonical (with traceId, without hashes) → dual-hash
  const fullCanonical = canonicalizeTraceFull(traceId, input);
  const entrySha256 = await computeTextSHA256(fullCanonical);
  const entrySha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 3: Assemble complete entry — hashes appended AFTER computation
  return {
    traceId,
    sequenceNumber: input.sequenceNumber,
    tenantId: input.tenantId,
    operationType: input.operationType,
    operationTimestamp: input.operationTimestamp,
    previousTraceHash: input.previousTraceHash,
    crossPhaseRefs: sortedRefs,
    operationPayloadHash: input.operationPayloadHash,
    description: input.description,
    sha256: entrySha256,
    sha3_256: entrySha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Audit Trace Entry — recompute and compare hashes
// ---------------------------------------------------------------------------

/**
 * Verify a single audit trace entry by recomputing its hashes.
 *
 * Recomputes:
 *   1. traceId from pre-ID canonical
 *   2. sha256 from full canonical
 *   3. sha3_256 from full canonical
 *
 * Returns PASS if all recomputed values match stored values.
 * Returns FAIL if any mismatch detected.
 *
 * Binary only. No partial pass.
 *
 * Async because SHA-256 uses crypto.subtle.digest (Web Crypto API).
 * Deterministic — same input always produces same output.
 */
export async function verifyAuditTraceEntry(entry: AuditTraceEntry): Promise<TraceValidationMatrix> {
  const fields: TraceFieldValidation[] = [];

  // Reconstruct input from entry
  const input: AuditTraceInput = {
    sequenceNumber: entry.sequenceNumber,
    tenantId: entry.tenantId,
    operationType: entry.operationType,
    operationTimestamp: entry.operationTimestamp,
    previousTraceHash: entry.previousTraceHash,
    crossPhaseRefs: entry.crossPhaseRefs,
    operationPayloadHash: entry.operationPayloadHash,
    description: entry.description,
  };

  // Recompute traceId
  const preIdCanonical = canonicalizeTracePreId(input);
  const recomputedTraceId = await computeTextSHA256(preIdCanonical);
  fields.push({
    field: 'traceIdMatch',
    result: entry.traceId === recomputedTraceId ? 'PASS' : 'FAIL',
  });

  // Recompute dual-hash
  const fullCanonical = canonicalizeTraceFull(entry.traceId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3_256 = await computeTextSHA3_256(fullCanonical);

  fields.push({
    field: 'sha256Match',
    result: entry.sha256 === recomputedSha256 ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'sha3_256Match',
    result: entry.sha3_256 === recomputedSha3_256 ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// Chain Verification — verify forward-only hash chain
// ---------------------------------------------------------------------------

/**
 * Verify an entire audit trace chain.
 *
 * Checks for each entry:
 *   1. Hash link: entry[N].previousTraceHash === entry[N-1].sha256
 *      (entry[0].previousTraceHash === GENESIS_TRACE_HASH)
 *   2. Hash integrity: recomputed sha256/sha3_256 match stored values
 *   3. Sequence continuity: sequenceNumber === index + 1 (no gaps)
 *
 * Entries MUST be provided in sequence order (sorted by sequenceNumber ASC).
 *
 * Overall: PASS only if ALL entries pass ALL checks.
 * Binary only. No partial pass.
 *
 * Async because SHA-256 uses crypto.subtle.digest (Web Crypto API).
 * Deterministic — same input always produces same output.
 */
export async function verifyAuditTraceChain(
  entries: AuditTraceEntry[]
): Promise<ChainVerificationResult> {
  const links: ChainLinkVerification[] = [];
  let brokenLinks = 0;
  let hashMismatches = 0;
  let sequenceGaps = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? GENESIS_TRACE_HASH : entries[i - 1].sha256;
    const expectedSequence = i + 1;

    // Check chain link
    const linkPass = entry.previousTraceHash === expectedPrevHash;
    if (!linkPass) brokenLinks++;

    // Check hash integrity
    const hashVerification = await verifyAuditTraceEntry(entry);
    const hashPass = hashVerification.overallResult === 'PASS';
    if (!hashPass) hashMismatches++;

    // Check sequence continuity
    const seqPass = entry.sequenceNumber === expectedSequence;
    if (!seqPass) sequenceGaps++;

    links.push({
      traceId: entry.traceId,
      sequenceNumber: entry.sequenceNumber,
      verifiedLink: linkPass ? 'PASS' : 'FAIL',
      verifiedHash: hashPass ? 'PASS' : 'FAIL',
      verifiedSequence: seqPass ? 'PASS' : 'FAIL',
    });
  }

  const allPass = brokenLinks === 0 && hashMismatches === 0 && sequenceGaps === 0;

  return {
    links,
    overallResult: allPass ? 'PASS' : 'FAIL',
    totalEntries: entries.length,
    brokenLinks,
    hashMismatches,
    sequenceGaps,
  };
}

// ---------------------------------------------------------------------------
// Validate Audit Trace Entry — structural checks
// ---------------------------------------------------------------------------

/**
 * Validate the structural integrity of a single audit trace entry.
 *
 * Checks:
 *   1. traceId is valid hex (64 chars)
 *   2. sequenceNumber is positive integer
 *   3. tenantId is non-empty
 *   4. operationType is valid
 *   5. operationTimestamp is non-empty
 *   6. previousTraceHash is valid hex (64 chars)
 *   7. crossPhaseRefs are sorted by phase ASC
 *   8. operationPayloadHash is valid hex (64 chars)
 *   9. description is non-empty
 *   10. sha256 is valid hex (64 chars)
 *   11. sha3_256 is valid hex (64 chars)
 *
 * Binary result per check. Overall: PASS only if ALL checks pass.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateAuditTraceEntry(entry: AuditTraceEntry): TraceValidationMatrix {
  const fields: TraceFieldValidation[] = [];

  // Hex validation helper
  const isValidHex = (str: string): boolean => {
    if (str.length !== 64) return false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false;
    }
    return true;
  };

  const validOperationTypes: string[] = [
    'ANCHOR_BUILD',
    'ANCHOR_INTEGRATION',
    'ARCHIVE_CREATE',
    'ARCHIVE_PURGE',
    'ARCHIVE_RESTORE',
    'CAPS_BIND',
    'CREDIT_CONSUME',
    'CREDIT_PURCHASE',
    'DOCUMENT_INGEST',
    'DRIFT_SCAN',
    'EXPORT_BUILD',
    'GUARD_VALIDATE',
    'ISSUE_INDEX',
    'MERKLE_PROOF',
    'OFFICER_INDEX',
    'POLICY_INGEST',
    'SIGNATURE_BIND',
  ];

  // Check 1: traceId valid hex
  fields.push({
    field: 'traceIdValidHex',
    result: isValidHex(entry.traceId) ? 'PASS' : 'FAIL',
  });

  // Check 2: sequenceNumber positive integer
  fields.push({
    field: 'sequenceNumberPositive',
    result: Number.isInteger(entry.sequenceNumber) && entry.sequenceNumber > 0 ? 'PASS' : 'FAIL',
  });

  // Check 3: tenantId non-empty
  fields.push({
    field: 'tenantIdNonEmpty',
    result: typeof entry.tenantId === 'string' && entry.tenantId.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 4: operationType valid
  fields.push({
    field: 'operationTypeValid',
    result: validOperationTypes.indexOf(entry.operationType) !== -1 ? 'PASS' : 'FAIL',
  });

  // Check 5: operationTimestamp non-empty
  fields.push({
    field: 'operationTimestampNonEmpty',
    result: typeof entry.operationTimestamp === 'string' && entry.operationTimestamp.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 6: previousTraceHash valid hex
  fields.push({
    field: 'previousTraceHashValidHex',
    result: isValidHex(entry.previousTraceHash) ? 'PASS' : 'FAIL',
  });

  // Check 7: crossPhaseRefs sorted by phase ASC
  let refsSorted = true;
  for (let i = 0; i < entry.crossPhaseRefs.length - 1; i++) {
    if (entry.crossPhaseRefs[i].phase > entry.crossPhaseRefs[i + 1].phase) {
      refsSorted = false;
      break;
    }
  }
  fields.push({
    field: 'crossPhaseRefsSorted',
    result: refsSorted ? 'PASS' : 'FAIL',
  });

  // Check 8: operationPayloadHash valid hex
  fields.push({
    field: 'operationPayloadHashValidHex',
    result: isValidHex(entry.operationPayloadHash) ? 'PASS' : 'FAIL',
  });

  // Check 9: description non-empty
  fields.push({
    field: 'descriptionNonEmpty',
    result: typeof entry.description === 'string' && entry.description.length > 0 ? 'PASS' : 'FAIL',
  });

  // Check 10: sha256 valid hex
  fields.push({
    field: 'sha256ValidHex',
    result: isValidHex(entry.sha256) ? 'PASS' : 'FAIL',
  });

  // Check 11: sha3_256 valid hex
  fields.push({
    field: 'sha3_256ValidHex',
    result: isValidHex(entry.sha3_256) ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// CI Enforcement Hook — trace chain integrity
// ---------------------------------------------------------------------------

/**
 * CI enforcement check for audit trace chain integrity.
 *
 * Verifies the entire chain and returns a CI-compatible result.
 * Designed to be called from build/CI pipeline.
 *
 * Binary only: PASS or FAIL.
 * If FAIL → build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass flag.
 *
 * Async because chain verification uses crypto.subtle.digest (Web Crypto API).
 * Deterministic — same input always produces same output.
 */
export async function enforceTraceIntegrity(
  entries: AuditTraceEntry[]
): Promise<CITraceEnforcementResult> {
  const chainResult = await verifyAuditTraceChain(entries);

  return {
    result: chainResult.overallResult,
    brokenLinks: chainResult.brokenLinks,
    hashMismatches: chainResult.hashMismatches,
    sequenceGaps: chainResult.sequenceGaps,
    totalEntries: chainResult.totalEntries,
  };
}
