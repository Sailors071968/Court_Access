// ============================================
// Court Access — Refusal Engine (Phase 19)
// Structured Refusal Integrity Engine
//
// Standardizes AI refusal logic.
// Deterministic keyword detection for prohibited requests.
// No regex. ASCII character-by-character scan.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
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
//   - No regex
//   - No legal advice / outcome prediction
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  RefusalEntity,
  RefusalInput,
  RefusalReason,
  RefusalTriggerScanResult,
} from '../models/RefusalModel';

// ---------------------------------------------------------------------------
// Deterministic Uppercase — character-by-character
// ---------------------------------------------------------------------------

function deterministicUppercase(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 97 && code <= 122) {
      result = result + String.fromCharCode(code - 32);
    } else {
      result = result + input.charAt(i);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Refusal Trigger Terms — mapped to RefusalReason
// ---------------------------------------------------------------------------

interface TriggerMapping {
  term: string;
  reason: RefusalReason;
}

const TRIGGER_MAPPINGS: readonly TriggerMapping[] = [
  { term: 'WIN', reason: 'OUTCOME_PREDICTION_REQUEST' },
  { term: 'BEAT', reason: 'OUTCOME_PREDICTION_REQUEST' },
  { term: 'WILL I', reason: 'OUTCOME_PREDICTION_REQUEST' },
  { term: 'SHOULD I', reason: 'LEGAL_ADVICE_REQUEST' },
  { term: 'WHAT SHOULD', reason: 'LEGAL_ADVICE_REQUEST' },
  { term: 'ADVISE', reason: 'LEGAL_ADVICE_REQUEST' },
  { term: 'MOTIVE', reason: 'MOTIVE_ANALYSIS_REQUEST' },
  { term: 'INTENT', reason: 'MOTIVE_ANALYSIS_REQUEST' },
  { term: 'CREDIB', reason: 'CREDIBILITY_ANALYSIS_REQUEST' },
  { term: 'BELIEVE', reason: 'CREDIBILITY_ANALYSIS_REQUEST' },
  { term: 'LYING', reason: 'CREDIBILITY_ANALYSIS_REQUEST' },
  { term: 'TRUTHFUL', reason: 'CREDIBILITY_ANALYSIS_REQUEST' },
];

// ---------------------------------------------------------------------------
// Character-by-Character Substring Search
// ---------------------------------------------------------------------------

function containsSubstring(haystack: string, needle: string): boolean {
  if (needle.length > haystack.length) {
    return false;
  }
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack.charAt(i + j) !== needle.charAt(j)) {
        found = false;
        break;
      }
    }
    if (found) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scan for Refusal Triggers
// ---------------------------------------------------------------------------

/**
 * Scan request text for refusal trigger terms.
 *
 * Character-by-character scan. No regex. No toLowerCase.
 * Deterministic uppercase transform before matching.
 *
 * Returns first matched trigger if any.
 * Deterministic — same input always produces same output.
 */
export function scanRefusalTriggers(requestText: string): RefusalTriggerScanResult {
  const upper = deterministicUppercase(requestText);

  for (let i = 0; i < TRIGGER_MAPPINGS.length; i++) {
    if (containsSubstring(upper, TRIGGER_MAPPINGS[i].term)) {
      return {
        triggered: true,
        matchedReason: TRIGGER_MAPPINGS[i].reason,
        matchedTerm: TRIGGER_MAPPINGS[i].term,
      };
    }
  }

  return {
    triggered: false,
    matchedReason: null,
    matchedTerm: null,
  };
}

// ---------------------------------------------------------------------------
// Canonicalize Refusal Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeRefusalPreId(input: RefusalInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"requestText":${JSON.stringify(input.requestText)},` +
    `"refusalReason":${JSON.stringify(input.refusalReason)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Refusal Full Form
// ---------------------------------------------------------------------------

function canonicalizeRefusalFull(
  refusalId: string,
  input: RefusalInput
): string {
  return (
    '{' +
    `"refusalId":${JSON.stringify(refusalId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"requestText":${JSON.stringify(input.requestText)},` +
    `"refusalReason":${JSON.stringify(input.refusalReason)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Refusal Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete refusal entity.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> refusalId
 *   Pass 2: full canonical -> dual-hash
 *
 * Deterministic — same input always produces same output.
 */
export async function buildRefusalEntity(
  input: RefusalInput
): Promise<RefusalEntity> {
  const preIdCanonical = canonicalizeRefusalPreId(input);
  const refusalId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeRefusalFull(refusalId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    refusalId,
    tenantId: input.tenantId,
    caseId: input.caseId,
    requestText: input.requestText,
    refusalReason: input.refusalReason,
    createdTimestamp: input.createdTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Refusal Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a refusal entity by recomputing all hashes.
 *
 * Binary PASS/FAIL per field.
 * Deterministic — same input always produces same result.
 */
export async function verifyRefusalEntity(
  entity: RefusalEntity
): Promise<{
  refusalIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: RefusalInput = {
    tenantId: entity.tenantId,
    caseId: entity.caseId,
    requestText: entity.requestText,
    refusalReason: entity.refusalReason,
    createdTimestamp: entity.createdTimestamp,
  };

  const preIdCanonical = canonicalizeRefusalPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const refusalIdMatch = recomputedId === entity.refusalId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeRefusalFull(entity.refusalId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    refusalIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { refusalIdMatch, sha256Match, sha3_256Match, overallResult };
}
