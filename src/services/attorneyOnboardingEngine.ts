// ============================================
// Court Access — Attorney Onboarding Engine (Phase O7)
// Controlled Application Submission & Validation
//
// Handles attorney application submission and structural
// validation. No auto-approval. No auto-activation.
//
// This engine:
//   - Validates application structure (email, bar number, state, name)
//   - Creates dual-hashed application entities
//   - Always sets applicationStatus to PENDING
//   - Never auto-approves
//   - Never auto-creates tenants
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
//   - No store access (caller persists)
//   - No SES calls
//   - No escalation building
//   - No dispatch calls
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
//   - No auto-approval
//   - No auto-tenant creation
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  AttorneyApplicationEntity,
  AttorneyApplicationInput,
} from '../models/AttorneyOnboardingModel';

// ---------------------------------------------------------------------------
// Canonicalize Application Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for application ID derivation.
 *
 * Includes (in fixed order):
 *   fullName, barNumber, state, firmName, emailAddress,
 *   phoneNumber, applicationTimestamp, applicationStatus
 *
 * Excludes:
 *   applicationId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 */
function canonicalizeApplicationPreId(
  input: AttorneyApplicationInput,
  applicationStatus: 'PENDING'
): string {
  return (
    '{' +
    `"fullName":${JSON.stringify(input.fullName)},` +
    `"barNumber":${JSON.stringify(input.barNumber)},` +
    `"state":${JSON.stringify(input.state)},` +
    `"firmName":${JSON.stringify(input.firmName)},` +
    `"emailAddress":${JSON.stringify(input.emailAddress)},` +
    `"phoneNumber":${JSON.stringify(input.phoneNumber)},` +
    `"applicationTimestamp":${JSON.stringify(input.applicationTimestamp)},` +
    `"applicationStatus":${JSON.stringify(applicationStatus)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Application Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   applicationId, fullName, barNumber, state, firmName,
 *   emailAddress, phoneNumber, applicationTimestamp, applicationStatus
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeApplicationFull(
  applicationId: string,
  input: AttorneyApplicationInput,
  applicationStatus: 'PENDING'
): string {
  return (
    '{' +
    `"applicationId":${JSON.stringify(applicationId)},` +
    `"fullName":${JSON.stringify(input.fullName)},` +
    `"barNumber":${JSON.stringify(input.barNumber)},` +
    `"state":${JSON.stringify(input.state)},` +
    `"firmName":${JSON.stringify(input.firmName)},` +
    `"emailAddress":${JSON.stringify(input.emailAddress)},` +
    `"phoneNumber":${JSON.stringify(input.phoneNumber)},` +
    `"applicationTimestamp":${JSON.stringify(input.applicationTimestamp)},` +
    `"applicationStatus":${JSON.stringify(applicationStatus)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Validate Application Structure — pure structural validation
// ---------------------------------------------------------------------------

/**
 * Validate the structural integrity of an attorney application.
 *
 * Rules:
 *   1. fullName must be non-empty (after trim)
 *   2. barNumber must be non-empty (after trim)
 *   3. state must be exactly "CA"
 *   4. emailAddress must pass structural validation:
 *      - Contains exactly one '@'
 *      - Contains '.' after '@'
 *      - Local part non-empty
 *      - Domain part non-empty
 *
 * No API lookup of State Bar database.
 * External verification handled manually.
 * No SMTP validation.
 * No deliverability check.
 *
 * Returns 'PASS' or 'FAIL'.
 * Deterministic — same inputs always produce same result.
 */
export function validateApplicationStructure(
  input: AttorneyApplicationInput
): 'PASS' | 'FAIL' {
  // Rule 1: fullName non-empty
  if (input.fullName.trim().length === 0) {
    return 'FAIL';
  }

  // Rule 2: barNumber non-empty
  if (input.barNumber.trim().length === 0) {
    return 'FAIL';
  }

  // Rule 3: state must be exactly "CA"
  if (input.state !== 'CA') {
    return 'FAIL';
  }

  // Rule 4: email structural validation
  const atIndex = input.emailAddress.indexOf('@');
  if (atIndex < 1) {
    return 'FAIL';
  }

  // Exactly one '@'
  if (input.emailAddress.indexOf('@', atIndex + 1) >= 0) {
    return 'FAIL';
  }

  // Domain must contain '.'
  const domain = input.emailAddress.substring(atIndex + 1);
  if (domain.length === 0) {
    return 'FAIL';
  }

  const dotIndex = domain.indexOf('.');
  if (dotIndex < 0) {
    return 'FAIL';
  }

  // Must have content after last dot
  const lastDotIndex = domain.lastIndexOf('.');
  if (lastDotIndex >= domain.length - 1) {
    return 'FAIL';
  }

  return 'PASS';
}

// ---------------------------------------------------------------------------
// Submit Application — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Create a new attorney application entity.
 *
 * Pipeline:
 *   1. Validate structural integrity → FAIL aborts
 *   2. Canonicalize pre-ID form (excludes applicationId and hashes)
 *   3. Derive applicationId = SHA-256(preIdCanonical)
 *   4. Canonicalize full form (includes applicationId, excludes hashes)
 *   5. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   6. Return complete AttorneyApplicationEntity with status PENDING
 *
 * applicationStatus is ALWAYS "PENDING".
 * No auto-approval. No auto-activation.
 *
 * Deterministic — same input always produces same output.
 * Returns null if structural validation fails.
 */
export async function submitApplication(
  input: AttorneyApplicationInput
): Promise<AttorneyApplicationEntity | null> {
  // Step 1: Validate structure
  const validationResult = validateApplicationStructure(input);
  if (validationResult === 'FAIL') {
    return null;
  }

  const applicationStatus = 'PENDING' as const;

  // Step 2: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeApplicationPreId(input, applicationStatus);

  // Step 3: Derive applicationId
  const applicationId = await computeTextSHA256(preIdCanonical);

  // Step 4: Canonicalize full form
  const fullCanonical = canonicalizeApplicationFull(applicationId, input, applicationStatus);

  // Step 5: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 6: Return complete entity
  return {
    applicationId,
    fullName: input.fullName,
    barNumber: input.barNumber,
    state: input.state,
    firmName: input.firmName,
    emailAddress: input.emailAddress,
    phoneNumber: input.phoneNumber,
    applicationTimestamp: input.applicationTimestamp,
    applicationStatus,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Application Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an application entity by recomputing all hashes.
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyApplicationEntity(
  entity: AttorneyApplicationEntity
): Promise<{
  applicationIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: AttorneyApplicationInput = {
    fullName: entity.fullName,
    barNumber: entity.barNumber,
    state: entity.state,
    firmName: entity.firmName,
    emailAddress: entity.emailAddress,
    phoneNumber: entity.phoneNumber,
    applicationTimestamp: entity.applicationTimestamp,
  };

  // Recompute applicationId
  const preIdCanonical = canonicalizeApplicationPreId(input, 'PENDING');
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const applicationIdMatch = recomputedId === entity.applicationId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeApplicationFull(entity.applicationId, input, 'PENDING');
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    applicationIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    applicationIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
