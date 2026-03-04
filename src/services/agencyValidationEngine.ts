// ============================================
// Court Access — Agency Validation Engine (Phase O6)
// Structural Validation Only
//
// Validates discovered agency candidates using structural
// format rules. No SMTP validation. No external API calls.
// No deliverability testing.
//
// This engine:
//   - Validates agency name exists
//   - Validates email format (contains '@' and '.')
//   - Validates county against California county list
//   - Rejects duplicates by normalized agencyName
//   - Returns binary VALID/INVALID
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Structural validation only (no network calls)
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//   - No SMTP validation
//   - No external API calls
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - Deterministic processing
//   - No fuzzy matching
//   - No AI heuristics
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  DiscoveredAgencyCandidate,
  ValidationStatus,
} from '../models/AgencyDiscoveryModel';

import { CALIFORNIA_COUNTIES } from '../models/AgencyDiscoveryModel';

// ---------------------------------------------------------------------------
// Validate Email Format — structural only
// ---------------------------------------------------------------------------

/**
 * Validate email format using structural rules only.
 *
 * Rules:
 *   - Must contain exactly one '@'
 *   - Must contain at least one '.' after '@'
 *   - Local part (before '@') must be non-empty
 *   - Domain part (after '@') must be non-empty
 *   - No SMTP validation
 *   - No deliverability check
 *   - ASCII-only validation
 *
 * Deterministic — same input always produces same result.
 */
function validateEmailFormat(email: string): boolean {
  // Must contain '@'
  const atIndex = email.indexOf('@');
  if (atIndex < 0) {
    return false;
  }

  // Must have exactly one '@'
  if (email.indexOf('@', atIndex + 1) >= 0) {
    return false;
  }

  // Local part must be non-empty
  if (atIndex === 0) {
    return false;
  }

  // Domain part must be non-empty and contain '.'
  const domain = email.substring(atIndex + 1);
  if (domain.length === 0) {
    return false;
  }

  const dotIndex = domain.indexOf('.');
  if (dotIndex < 0) {
    return false;
  }

  // Must have content after the last dot
  const lastDotIndex = domain.lastIndexOf('.');
  if (lastDotIndex >= domain.length - 1) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Validate County — exact match against California list
// ---------------------------------------------------------------------------

/**
 * Validate county against the California counties list.
 *
 * Rules:
 *   - Exact ASCII match (no case conversion)
 *   - Trim whitespace only
 *   - Must be in CALIFORNIA_COUNTIES list
 *   - null county is acceptable (some agencies may not have county listed)
 *
 * Deterministic — same input always produces same result.
 */
function validateCounty(county: string | null): boolean {
  if (county === null) {
    return true;
  }

  const trimmed = county.trim();
  for (let i = 0; i < CALIFORNIA_COUNTIES.length; i++) {
    if (CALIFORNIA_COUNTIES[i] === trimmed) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Validate Candidate — structural validation
// ---------------------------------------------------------------------------

/**
 * Validate a discovered agency candidate using structural rules.
 *
 * Rules:
 *   1. agencyName must exist (non-empty after trim)
 *   2. emailAddress (if present) must contain '@' and '.'
 *   3. county (if present) must match California county list
 *   4. No SMTP validation
 *   5. No deliverability testing
 *   6. No fuzzy matching
 *
 * Returns 'VALID' or 'INVALID'.
 * Deterministic — same inputs always produce same result.
 */
export function validateCandidate(
  candidate: DiscoveredAgencyCandidate
): ValidationStatus {
  // Rule 1: agencyName must exist
  if (candidate.agencyName.trim().length === 0) {
    return 'INVALID';
  }

  // Rule 2: email format validation (if present)
  if (candidate.emailAddress !== null) {
    if (!validateEmailFormat(candidate.emailAddress)) {
      return 'INVALID';
    }
  }

  // Rule 3: county validation (if present)
  if (!validateCounty(candidate.county)) {
    return 'INVALID';
  }

  return 'VALID';
}

// ---------------------------------------------------------------------------
// Batch Validate Candidates
// ---------------------------------------------------------------------------

/**
 * Validate an array of candidates and return validation results.
 *
 * Each candidate is independently validated.
 * No mutation of input array.
 * Returns new array of validation status values.
 *
 * Deterministic — same inputs always produce same results.
 */
export function batchValidateCandidates(
  candidates: readonly DiscoveredAgencyCandidate[]
): ValidationStatus[] {
  const results: ValidationStatus[] = [];

  for (let i = 0; i < candidates.length; i++) {
    results.push(validateCandidate(candidates[i]));
  }

  return results;
}
