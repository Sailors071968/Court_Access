// ============================================
// Court Access — Output Constitution Engine (Phase 17)
// Central Output Validation Firewall
//
// Before any AI-generated or derived output is displayed
// or exported, this engine validates:
//   - Forbidden language (character-by-character scan)
//   - Citation presence
//   - Section ordering
//   - Deterministic structure
//
// If violation → BLOCK output.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
//
// Architectural boundary:
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No regex (character-by-character scan only)
//   - No legal advice / outcome prediction
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  OutputEnvelope,
  ForbiddenLanguageScanResult,
  OutputConstitutionResult,
} from '../models/OutputConstitutionModel';

import { REQUIRED_SECTION_ORDER } from '../models/OutputConstitutionModel';

// ---------------------------------------------------------------------------
// Forbidden Terms List
// ---------------------------------------------------------------------------

const FORBIDDEN_TERMS: readonly string[] = [
  'ADVICE',
  'RECOMMEND',
  'STRATEGY',
  'SHOULD',
  'LIKELY',
  'SUGGESTS',
  'INDICATES',
  'IMPLIES',
  'WEAK',
  'STRONG',
  'CONTRADICTION',
  'VIOLATION',
  'MISCONDUCT',
  'PATTERN',
];

// ---------------------------------------------------------------------------
// Deterministic Uppercase — character-by-character, no toLowerCase
// ---------------------------------------------------------------------------

function deterministicUppercase(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // a-z (97-122) -> A-Z (65-90)
    if (code >= 97 && code <= 122) {
      result = result + String.fromCharCode(code - 32);
    } else {
      result = result + input.charAt(i);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Character-by-Character Forbidden Term Scanner
// ---------------------------------------------------------------------------

/**
 * Scan text for forbidden terms using character-by-character matching.
 *
 * No regex. No toLowerCase. Deterministic uppercase transform.
 * Scans for each forbidden term as a substring in the uppercased text.
 *
 * Returns PASS if no forbidden terms found, FAIL if any found.
 * matchedTerms lists all detected forbidden terms.
 */
export function scanForbiddenLanguage(text: string): ForbiddenLanguageScanResult {
  const upper = deterministicUppercase(text);
  const matched: string[] = [];

  for (let t = 0; t < FORBIDDEN_TERMS.length; t++) {
    const term = FORBIDDEN_TERMS[t];
    // Character-by-character substring search
    for (let i = 0; i <= upper.length - term.length; i++) {
      let found = true;
      for (let j = 0; j < term.length; j++) {
        if (upper.charAt(i + j) !== term.charAt(j)) {
          found = false;
          break;
        }
      }
      if (found) {
        // Check word boundary: preceding char must not be A-Z
        if (i > 0) {
          const prevCode = upper.charCodeAt(i - 1);
          if (prevCode >= 65 && prevCode <= 90) {
            continue; // Part of a larger word
          }
        }
        // Check word boundary: following char must not be A-Z
        const afterIdx = i + term.length;
        if (afterIdx < upper.length) {
          const afterCode = upper.charCodeAt(afterIdx);
          if (afterCode >= 65 && afterCode <= 90) {
            continue; // Part of a larger word
          }
        }
        matched.push(term);
        break; // Only record each term once
      }
    }
  }

  return {
    status: matched.length === 0 ? 'PASS' : 'FAIL',
    matchedTerms: matched,
  };
}

// ---------------------------------------------------------------------------
// Citation Enforcement
// ---------------------------------------------------------------------------

/**
 * Validate that output has citations.
 *
 * If citationCount === 0 → FAIL.
 * Binary PASS/FAIL.
 */
export function enforceCitationPresence(envelope: OutputEnvelope): 'PASS' | 'FAIL' {
  if (envelope.citationCount === 0) {
    return 'FAIL';
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Section Order Enforcement
// ---------------------------------------------------------------------------

/**
 * Validate that sections appear in required order.
 *
 * ASCII strict match against REQUIRED_SECTION_ORDER.
 * Binary PASS/FAIL.
 */
export function enforceSectionOrder(sections: readonly string[]): 'PASS' | 'FAIL' {
  if (sections.length !== REQUIRED_SECTION_ORDER.length) {
    return 'FAIL';
  }
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] !== REQUIRED_SECTION_ORDER[i]) {
      return 'FAIL';
    }
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Output Gate — Central Enforcement
// ---------------------------------------------------------------------------

/**
 * Enforce output constitution on an envelope.
 *
 * Runs all checks:
 *   1. Forbidden language scan on serialized payload
 *   2. Citation presence
 *   3. Section order (if sections provided)
 *
 * Must block on any violation.
 * Binary PASS/FAIL overall.
 * Deterministic — same input always produces same output.
 */
export function enforceOutputConstitution(
  envelope: OutputEnvelope,
  payloadText: string,
  sections: readonly string[]
): OutputConstitutionResult {
  const languageResult = scanForbiddenLanguage(payloadText);
  const citationStatus = enforceCitationPresence(envelope);
  const sectionOrderStatus = enforceSectionOrder(sections);

  const overallStatus =
    languageResult.status === 'PASS' &&
    citationStatus === 'PASS' &&
    sectionOrderStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    forbiddenLanguageStatus: languageResult.status,
    citationStatus,
    sectionOrderStatus,
    overallStatus,
    matchedForbiddenTerms: languageResult.matchedTerms,
  };
}
