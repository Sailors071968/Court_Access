// ============================================
// Court Access — Policy Comparison Engine (Phase 10)
// Policy Language vs Conduct Mapping
//
// Mechanically compares department policy text to conduct
// description. No claim of violation. No accusation.
// Only language alignment comparison.
//
// This engine:
//   - Tokenizes policy and conduct segments
//   - Compares token sequences deterministically
//   - Detects language differences (binary)
//   - Builds dual-hashed comparison entities
//   - Does NOT claim "violation"
//   - Does NOT claim "inconsistent"
//   - Only outputs: "Language differs."
//
// Allowed phrasing only:
//   "Language differs."
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
//   - No legal advice / outcome prediction / strategy
//   - No credibility analysis / intent inference
//   - No "likely" / "appears to" / "suggests" / "indicates"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  PolicyComparisonResult,
  PolicyComparisonEntity,
  PolicyComparisonInput,
  ConductSegment,
  PolicySegment,
} from '../models/PolicyComparisonModel';

// ---------------------------------------------------------------------------
// Tokenize Text — whitespace-split
// ---------------------------------------------------------------------------

/**
 * Split text into tokens at whitespace boundaries.
 * Deterministic. No stemming. No normalization.
 */
function tokenizeText(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current = current + ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Build Conduct Segment
// ---------------------------------------------------------------------------

/**
 * Build a conduct segment from raw text and citation.
 * Deterministic tokenization.
 */
export function buildConductSegment(
  conductCitation: string,
  rawText: string
): ConductSegment {
  return {
    conductCitation,
    tokens: tokenizeText(rawText),
    rawText,
  };
}

// ---------------------------------------------------------------------------
// Build Policy Segment
// ---------------------------------------------------------------------------

/**
 * Build a policy segment from raw text, citation, and section ID.
 * Deterministic tokenization.
 */
export function buildPolicySegment(
  policyCitation: string,
  policySectionId: string,
  rawText: string
): PolicySegment {
  return {
    policyCitation,
    policySectionId,
    tokens: tokenizeText(rawText),
    rawText,
  };
}

// ---------------------------------------------------------------------------
// Compare Conduct to Policy — language difference detection
// ---------------------------------------------------------------------------

/**
 * Compare a conduct segment to a policy segment.
 *
 * Detects whether language differs between conduct description
 * and policy text. Binary result only.
 *
 * Comparison rule: check if policy tokens appear as a subsequence
 * within conduct tokens. If not, language differs.
 *
 * No "inconsistent" phrasing. No "violation" claims.
 * Only: languageDifferenceDetected = true/false.
 *
 * Deterministic — same inputs always produce same result.
 */
export function compareConductToPolicy(
  conduct: ConductSegment,
  policy: PolicySegment
): PolicyComparisonResult {
  // Check if policy tokens appear as subsequence in conduct tokens
  let pIdx = 0;
  for (let c = 0; c < conduct.tokens.length && pIdx < policy.tokens.length; c++) {
    if (conduct.tokens[c] === policy.tokens[pIdx]) {
      pIdx++;
    }
  }

  const languageDifferenceDetected = pIdx < policy.tokens.length;

  return {
    conductCitation: conduct.conductCitation,
    policyCitation: policy.policyCitation,
    languageDifferenceDetected,
  };
}

// ---------------------------------------------------------------------------
// Batch Compare — all conduct segments against all policy segments
// ---------------------------------------------------------------------------

/**
 * Compare multiple conduct segments against multiple policy segments.
 *
 * Each conduct segment is compared against each policy segment.
 * Results are ordered by conduct citation then policy citation (ASCII).
 *
 * Deterministic — same inputs always produce same results.
 */
export function batchCompareConductToPolicy(
  conductSegments: readonly ConductSegment[],
  policySegments: readonly PolicySegment[]
): PolicyComparisonResult[] {
  const results: PolicyComparisonResult[] = [];

  for (let c = 0; c < conductSegments.length; c++) {
    for (let p = 0; p < policySegments.length; p++) {
      results.push(compareConductToPolicy(conductSegments[c], policySegments[p]));
    }
  }

  // Sort by conductCitation then policyCitation for deterministic ordering
  results.sort(function sortResults(a: PolicyComparisonResult, b: PolicyComparisonResult): number {
    if (a.conductCitation < b.conductCitation) { return -1; }
    if (a.conductCitation > b.conductCitation) { return 1; }
    if (a.policyCitation < b.policyCitation) { return -1; }
    if (a.policyCitation > b.policyCitation) { return 1; }
    return 0;
  });

  return results;
}

// ---------------------------------------------------------------------------
// Canonicalize Policy Comparison Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeComparisonPreId(input: PolicyComparisonInput): string {
  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"departmentId":${JSON.stringify(input.departmentId)},` +
    `"results":${JSON.stringify(input.results)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Policy Comparison Full Form
// ---------------------------------------------------------------------------

function canonicalizeComparisonFull(
  comparisonId: string,
  input: PolicyComparisonInput,
  totalComparisons: number,
  differencesDetected: number
): string {
  return (
    '{' +
    `"comparisonId":${JSON.stringify(comparisonId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"departmentId":${JSON.stringify(input.departmentId)},` +
    `"results":${JSON.stringify(input.results)},` +
    `"totalComparisons":${totalComparisons},` +
    `"differencesDetected":${differencesDetected}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Policy Comparison Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete policy comparison entity.
 *
 * Counts total comparisons and differences deterministically.
 * Two-pass hash derivation.
 *
 * Deterministic — same input always produces same output.
 */
export async function buildPolicyComparisonEntity(
  input: PolicyComparisonInput
): Promise<PolicyComparisonEntity> {
  const totalComparisons = input.results.length;
  let differencesDetected = 0;

  for (let i = 0; i < input.results.length; i++) {
    if (input.results[i].languageDifferenceDetected) {
      differencesDetected++;
    }
  }

  const preIdCanonical = canonicalizeComparisonPreId(input);
  const comparisonId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeComparisonFull(
    comparisonId, input, totalComparisons, differencesDetected
  );
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    comparisonId,
    caseId: input.caseId,
    departmentId: input.departmentId,
    results: input.results,
    totalComparisons,
    differencesDetected,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Policy Comparison Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyPolicyComparisonEntity(
  entity: PolicyComparisonEntity
): Promise<{
  comparisonIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: PolicyComparisonInput = {
    caseId: entity.caseId,
    departmentId: entity.departmentId,
    results: entity.results,
  };

  const preIdCanonical = canonicalizeComparisonPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const comparisonIdMatch = recomputedId === entity.comparisonId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeComparisonFull(
    entity.comparisonId, input, entity.totalComparisons, entity.differencesDetected
  );
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    comparisonIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { comparisonIdMatch, sha256Match, sha3_256Match, overallResult };
}
