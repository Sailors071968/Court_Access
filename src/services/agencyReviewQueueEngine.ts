// ============================================
// Court Access — Agency Review Queue Engine (Phase O6)
// Manual Review Pipeline Manager
//
// Manages the manual review pipeline for discovered
// agency candidates. All agencies must be manually
// approved before activation.
//
// This engine:
//   - Queues candidates for manual review
//   - Never auto-approves
//   - Requires explicit human approval
//   - Creates dual-hashed activation records
//   - Builds dual-hashed candidate entities
//   - Does NOT auto-activate agencies
//   - Does NOT auto-send email
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
//   - No deletion (rejected stays archived)
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  DiscoveredAgencyCandidate,
  DiscoveredAgencyCandidateInput,
  AgencyActivationRecord,
  AgencyActivationRecordInput,
  ReviewQueueEntry,
} from '../models/AgencyDiscoveryModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Canonicalize Candidate Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for candidate ID derivation.
 *
 * Includes (in fixed order):
 *   sourceUrl, agencyName, departmentType, emailAddress,
 *   mailingAddress, phoneNumber, county, discoveryTimestamp,
 *   validationStatus, reviewStatus
 *
 * Excludes:
 *   candidateId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 */
function canonicalizeCandidatePreId(input: DiscoveredAgencyCandidateInput): string {
  return (
    '{' +
    `"sourceUrl":${JSON.stringify(input.sourceUrl)},` +
    `"agencyName":${JSON.stringify(input.agencyName)},` +
    `"departmentType":${JSON.stringify(input.departmentType)},` +
    `"emailAddress":${JSON.stringify(input.emailAddress)},` +
    `"mailingAddress":${JSON.stringify(input.mailingAddress)},` +
    `"phoneNumber":${JSON.stringify(input.phoneNumber)},` +
    `"county":${JSON.stringify(input.county)},` +
    `"discoveryTimestamp":${JSON.stringify(input.discoveryTimestamp)},` +
    `"validationStatus":${JSON.stringify(input.validationStatus)},` +
    `"reviewStatus":${JSON.stringify(input.reviewStatus)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Candidate Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   candidateId, sourceUrl, agencyName, departmentType,
 *   emailAddress, mailingAddress, phoneNumber, county,
 *   discoveryTimestamp, validationStatus, reviewStatus
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeCandidateFull(
  candidateId: string,
  input: DiscoveredAgencyCandidateInput
): string {
  return (
    '{' +
    `"candidateId":${JSON.stringify(candidateId)},` +
    `"sourceUrl":${JSON.stringify(input.sourceUrl)},` +
    `"agencyName":${JSON.stringify(input.agencyName)},` +
    `"departmentType":${JSON.stringify(input.departmentType)},` +
    `"emailAddress":${JSON.stringify(input.emailAddress)},` +
    `"mailingAddress":${JSON.stringify(input.mailingAddress)},` +
    `"phoneNumber":${JSON.stringify(input.phoneNumber)},` +
    `"county":${JSON.stringify(input.county)},` +
    `"discoveryTimestamp":${JSON.stringify(input.discoveryTimestamp)},` +
    `"validationStatus":${JSON.stringify(input.validationStatus)},` +
    `"reviewStatus":${JSON.stringify(input.reviewStatus)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Activation Record Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for activation record ID derivation.
 *
 * Includes (in fixed order):
 *   candidateId, approvedByUserId, activationTimestamp
 *
 * Excludes:
 *   activationId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 */
function canonicalizeActivationPreId(input: AgencyActivationRecordInput): string {
  return (
    '{' +
    `"candidateId":${JSON.stringify(input.candidateId)},` +
    `"approvedByUserId":${JSON.stringify(input.approvedByUserId)},` +
    `"activationTimestamp":${JSON.stringify(input.activationTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Activation Record Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for activation record dual-hash computation.
 *
 * Includes (in fixed order):
 *   activationId, candidateId, approvedByUserId, activationTimestamp
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeActivationFull(
  activationId: string,
  input: AgencyActivationRecordInput
): string {
  return (
    '{' +
    `"activationId":${JSON.stringify(activationId)},` +
    `"candidateId":${JSON.stringify(input.candidateId)},` +
    `"approvedByUserId":${JSON.stringify(input.approvedByUserId)},` +
    `"activationTimestamp":${JSON.stringify(input.activationTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Discovered Agency Candidate — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete discovered agency candidate entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes candidateId and hashes)
 *   2. Derive candidateId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes candidateId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete DiscoveredAgencyCandidate
 *
 * Deterministic — same input always produces same output.
 */
export async function buildCandidateEntity(
  input: DiscoveredAgencyCandidateInput
): Promise<DiscoveredAgencyCandidate> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeCandidatePreId(input);

  // Step 2: Derive candidateId
  const candidateId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeCandidateFull(candidateId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    candidateId,
    sourceUrl: input.sourceUrl,
    agencyName: input.agencyName,
    departmentType: input.departmentType,
    emailAddress: input.emailAddress,
    mailingAddress: input.mailingAddress,
    phoneNumber: input.phoneNumber,
    county: input.county,
    discoveryTimestamp: input.discoveryTimestamp,
    validationStatus: input.validationStatus,
    reviewStatus: input.reviewStatus,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Queue for Review
// ---------------------------------------------------------------------------

/**
 * Create a review queue entry from a discovered candidate.
 *
 * All discovered agencies go into PENDING_REVIEW.
 * Never auto-approve.
 *
 * Deterministic — same input always produces same output.
 */
export function queueForReview(
  candidate: DiscoveredAgencyCandidate
): ReviewQueueEntry {
  return {
    candidateId: candidate.candidateId,
    agencyName: candidate.agencyName,
    departmentType: candidate.departmentType,
    emailAddress: candidate.emailAddress,
    county: candidate.county,
    validationStatus: candidate.validationStatus,
    reviewStatus: 'PENDING',
    discoveryTimestamp: candidate.discoveryTimestamp,
    sourceUrl: candidate.sourceUrl,
  };
}

// ---------------------------------------------------------------------------
// Approve Agency — manual action, dual-hashed activation record
// ---------------------------------------------------------------------------

/**
 * Approve a candidate for activation.
 *
 * Creates an immutable activation record (two-pass hash derivation).
 * This is the ONLY path to activation.
 * No auto-approve. No batch activation. No bypass.
 *
 * Parameters:
 *   - candidateId: ID of the approved candidate
 *   - approvedByUserId: human who approved
 *   - timestamp: ISO 8601, caller-provided
 *
 * Deterministic — same inputs always produce same output.
 */
export async function approveAgency(
  candidateId: string,
  approvedByUserId: string,
  timestamp: string
): Promise<AgencyActivationRecord> {
  const input: AgencyActivationRecordInput = {
    candidateId,
    approvedByUserId,
    activationTimestamp: timestamp,
  };

  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeActivationPreId(input);

  // Step 2: Derive activationId
  const activationId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeActivationFull(activationId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete activation record
  return {
    activationId,
    candidateId,
    approvedByUserId,
    activationTimestamp: timestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Sort Review Queue — deterministic ASCII ordering
// ---------------------------------------------------------------------------

/**
 * Sort review queue entries by agencyName in ASCII order.
 *
 * Returns new array — does not mutate input.
 * Deterministic — same inputs always produce same output.
 */
export function sortReviewQueue(
  entries: readonly ReviewQueueEntry[]
): ReviewQueueEntry[] {
  const sorted = entries.slice();
  sorted.sort(function sortByAgencyName(a: ReviewQueueEntry, b: ReviewQueueEntry): number {
    return asciiCompare(a.agencyName, b.agencyName);
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Verify Candidate Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a candidate entity by recomputing all hashes.
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyCandidateEntity(
  entity: DiscoveredAgencyCandidate
): Promise<{
  candidateIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: DiscoveredAgencyCandidateInput = {
    sourceUrl: entity.sourceUrl,
    agencyName: entity.agencyName,
    departmentType: entity.departmentType,
    emailAddress: entity.emailAddress,
    mailingAddress: entity.mailingAddress,
    phoneNumber: entity.phoneNumber,
    county: entity.county,
    discoveryTimestamp: entity.discoveryTimestamp,
    validationStatus: entity.validationStatus,
    reviewStatus: entity.reviewStatus,
  };

  // Recompute candidateId
  const preIdCanonical = canonicalizeCandidatePreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const candidateIdMatch = recomputedId === entity.candidateId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeCandidateFull(entity.candidateId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    candidateIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    candidateIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
