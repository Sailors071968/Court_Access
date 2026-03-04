// ============================================
// Court Access — Cross-Case Variation Engine (Phase 14)
// Cross-Case Officer & Pattern Indexing
//
// Detects mechanical variations across cases involving
// same officer, department, policy citation, or report
// language structure.
//
// This engine:
//   - Normalizes officer names (uppercase, strip punctuation)
//   - Compares token-aligned segments across cases
//   - Detects identical language reuse
//   - Builds dual-hashed registry and variation entities
//   - Enforces tenant isolation before any comparison
//   - No allegations, no claims of pattern/misconduct
//   - No statistical inference, no probabilistic scoring
//
// Allowed phrasing only:
//   "Identical language detected in X cases."
//
// Not allowed:
//   "Pattern of misconduct"
//   "Systemic issue"
//   "Repeated violation"
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects (caller persists)
//
// Architectural boundary:
//   - Only imports policyIngestionService for hashing
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - No credibility analysis / intent inference
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  OfficerRegistryEntity,
  OfficerRegistryInput,
  CrossCaseVariationEntity,
  CrossCaseVariationInput,
  CrossCaseSegmentPair,
  CrossCaseComparisonResult,
} from '../models/CrossCaseIndexModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Normalize Officer Name — deterministic
// ---------------------------------------------------------------------------

/**
 * Normalize an officer name for deterministic comparison.
 *
 * Rules:
 *   1. Convert to uppercase character by character
 *   2. Strip all non-alphanumeric, non-space characters
 *   3. Trim leading/trailing whitespace
 *   4. Collapse multiple spaces to single space
 *
 * No localeCompare. No toLowerCase.
 * Deterministic — same input always produces same output.
 */
export function normalizeOfficerName(rawName: string): string {
  let result = '';

  for (let i = 0; i < rawName.length; i++) {
    const code = rawName.charCodeAt(i);

    // a-z (97-122) → A-Z (65-90)
    if (code >= 97 && code <= 122) {
      result = result + String.fromCharCode(code - 32);
    }
    // A-Z (65-90) — keep
    else if (code >= 65 && code <= 90) {
      result = result + rawName.charAt(i);
    }
    // 0-9 (48-57) — keep
    else if (code >= 48 && code <= 57) {
      result = result + rawName.charAt(i);
    }
    // Space (32) — keep
    else if (code === 32) {
      result = result + ' ';
    }
    // All other characters stripped
  }

  // Collapse multiple spaces and trim
  let collapsed = '';
  let lastWasSpace = true; // trim leading
  for (let i = 0; i < result.length; i++) {
    if (result.charAt(i) === ' ') {
      if (!lastWasSpace) {
        collapsed = collapsed + ' ';
        lastWasSpace = true;
      }
    } else {
      collapsed = collapsed + result.charAt(i);
      lastWasSpace = false;
    }
  }

  // Trim trailing space
  if (collapsed.length > 0 && collapsed.charAt(collapsed.length - 1) === ' ') {
    collapsed = collapsed.substring(0, collapsed.length - 1);
  }

  return collapsed;
}

// ---------------------------------------------------------------------------
// Compare Cross-Case Segments — detect identical language
// ---------------------------------------------------------------------------

/**
 * Compare two token-aligned segments from different cases.
 *
 * Detects:
 *   - Identical language (all tokens match)
 *   - Count of differing tokens
 *
 * No probabilistic scoring. No "pattern strength".
 * Deterministic — same inputs always produce same result.
 */
export function compareCrossCaseSegments(
  pair: CrossCaseSegmentPair
): CrossCaseComparisonResult {
  const maxLen = pair.tokensA.length > pair.tokensB.length
    ? pair.tokensA.length
    : pair.tokensB.length;

  let differingTokenCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const tokenA = i < pair.tokensA.length ? pair.tokensA[i] : null;
    const tokenB = i < pair.tokensB.length ? pair.tokensB[i] : null;

    if (tokenA !== tokenB) {
      differingTokenCount++;
    }
  }

  return {
    caseIdA: pair.caseIdA,
    caseIdB: pair.caseIdB,
    citationA: pair.citationA,
    citationB: pair.citationB,
    identicalLanguage: differingTokenCount === 0 && maxLen > 0,
    differingTokenCount,
  };
}

// ---------------------------------------------------------------------------
// Enforce Cross-Case Tenant Isolation
// ---------------------------------------------------------------------------

/**
 * Verify that all cases in a cross-case comparison belong to the same tenant.
 *
 * Must never compare across tenants.
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceCrossCaseTenantIsolation(
  caseIds: readonly string[],
  tenantCaseIds: readonly string[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < caseIds.length; i++) {
    let found = false;
    for (let j = 0; j < tenantCaseIds.length; j++) {
      if (caseIds[i] === tenantCaseIds[j]) {
        found = true;
        break;
      }
    }
    if (!found) {
      return 'FAIL';
    }
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Canonicalize Officer Registry Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeOfficerPreId(input: OfficerRegistryInput): string {
  const sortedCaseIds = input.associatedCaseIds.slice().sort(asciiCompare);
  return (
    '{' +
    `"normalizedOfficerName":${JSON.stringify(input.normalizedOfficerName)},` +
    `"departmentId":${JSON.stringify(input.departmentId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"associatedCaseIds":${JSON.stringify(sortedCaseIds)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Officer Registry Full Form
// ---------------------------------------------------------------------------

function canonicalizeOfficerFull(
  officerId: string,
  input: OfficerRegistryInput
): string {
  const sortedCaseIds = input.associatedCaseIds.slice().sort(asciiCompare);
  return (
    '{' +
    `"officerId":${JSON.stringify(officerId)},` +
    `"normalizedOfficerName":${JSON.stringify(input.normalizedOfficerName)},` +
    `"departmentId":${JSON.stringify(input.departmentId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"associatedCaseIds":${JSON.stringify(sortedCaseIds)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Officer Registry Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

export async function buildOfficerRegistryEntity(
  input: OfficerRegistryInput
): Promise<OfficerRegistryEntity> {
  const preIdCanonical = canonicalizeOfficerPreId(input);
  const officerId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeOfficerFull(officerId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    officerId,
    normalizedOfficerName: input.normalizedOfficerName,
    departmentId: input.departmentId,
    tenantId: input.tenantId,
    associatedCaseIds: input.associatedCaseIds.slice().sort(asciiCompare),
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Canonicalize Cross-Case Variation Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeVariationPreId(input: CrossCaseVariationInput): string {
  const sortedCaseIds = input.involvedCaseIds.slice().sort(asciiCompare);
  return (
    '{' +
    `"officerId":${JSON.stringify(input.officerId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"involvedCaseIds":${JSON.stringify(sortedCaseIds)},` +
    `"comparisonSummary":${JSON.stringify(input.comparisonSummary)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Cross-Case Variation Full Form
// ---------------------------------------------------------------------------

function canonicalizeVariationFull(
  variationId: string,
  input: CrossCaseVariationInput
): string {
  const sortedCaseIds = input.involvedCaseIds.slice().sort(asciiCompare);
  return (
    '{' +
    `"variationId":${JSON.stringify(variationId)},` +
    `"officerId":${JSON.stringify(input.officerId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"involvedCaseIds":${JSON.stringify(sortedCaseIds)},` +
    `"comparisonSummary":${JSON.stringify(input.comparisonSummary)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Cross-Case Variation Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

export async function buildCrossCaseVariationEntity(
  input: CrossCaseVariationInput
): Promise<CrossCaseVariationEntity> {
  const preIdCanonical = canonicalizeVariationPreId(input);
  const variationId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeVariationFull(variationId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    variationId,
    officerId: input.officerId,
    tenantId: input.tenantId,
    involvedCaseIds: input.involvedCaseIds.slice().sort(asciiCompare),
    comparisonSummary: input.comparisonSummary,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Officer Registry Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyOfficerRegistryEntity(
  entity: OfficerRegistryEntity
): Promise<{
  officerIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: OfficerRegistryInput = {
    normalizedOfficerName: entity.normalizedOfficerName,
    departmentId: entity.departmentId,
    tenantId: entity.tenantId,
    associatedCaseIds: entity.associatedCaseIds,
  };

  const preIdCanonical = canonicalizeOfficerPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const officerIdMatch = recomputedId === entity.officerId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeOfficerFull(entity.officerId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    officerIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { officerIdMatch, sha256Match, sha3_256Match, overallResult };
}

// ---------------------------------------------------------------------------
// Verify Cross-Case Variation Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyCrossCaseVariationEntity(
  entity: CrossCaseVariationEntity
): Promise<{
  variationIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: CrossCaseVariationInput = {
    officerId: entity.officerId,
    tenantId: entity.tenantId,
    involvedCaseIds: entity.involvedCaseIds,
    comparisonSummary: entity.comparisonSummary,
  };

  const preIdCanonical = canonicalizeVariationPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const variationIdMatch = recomputedId === entity.variationId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeVariationFull(entity.variationId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    variationIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { variationIdMatch, sha256Match, sha3_256Match, overallResult };
}
