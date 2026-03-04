// ============================================
// Court Access — Bounce Handler Engine (Phase O2)
// Bounce / Complaint Handler — Reputation Protection
//
// Processes SES bounce and complaint events:
//   - Classifies bounce type (HARD/SOFT)
//   - Classifies complaint type (ABUSE/FRAUD/OTHER)
//   - Builds immutable bounce/complaint event entities
//   - Updates recipient reputation deterministically
//   - Checks dispatch eligibility
//
// This layer protects domain reputation.
// Does NOT mutate CommunicationLedger hashes.
// Does NOT retry automatically.
// Does NOT auto-delete queue entries.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary PASS/FAIL where applicable
//
// Architectural boundary:
//   - Does NOT import anchorEngine
//   - Does NOT import signatureEngine
//   - Does NOT import scheduler engine
//   - Only shared hashing functions from policyIngestionService
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access (callers provide all data)
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of input entities
//   - No deletion
//   - No update of CommunicationLedger entities
//   - Binary PASS/FAIL only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  BounceType,
  ComplaintType,
  RecipientReputationStatus,
  BounceEventEntity,
  BounceEventInput,
  ComplaintEventEntity,
  ComplaintEventInput,
  RecipientReputationRecord,
  DispatchEligibilityResult,
} from '../models/BounceModel';

// ---------------------------------------------------------------------------
// Classify Bounce — deterministic mapping
// ---------------------------------------------------------------------------

/**
 * Classify an SES bounce type into HARD or SOFT.
 *
 * Mapping (ASCII comparison):
 *   "Permanent" → HARD
 *   "Transient" → SOFT
 *   Everything else → HARD (fail-safe)
 *
 * No fuzzy logic. No probability.
 * ASCII compare only — no localeCompare, no toLowerCase.
 * Deterministic — same input always produces same output.
 */
export function classifyBounce(sesBounceType: string): BounceType {
  if (sesBounceType === 'Transient') return 'SOFT';
  // "Permanent" and everything else → HARD (fail-safe)
  return 'HARD';
}

// ---------------------------------------------------------------------------
// Classify Complaint — deterministic mapping
// ---------------------------------------------------------------------------

/**
 * Classify an SES complaint feedback type.
 *
 * Mapping (ASCII comparison):
 *   "abuse" → ABUSE
 *   "fraud" → FRAUD
 *   Everything else → OTHER
 *
 * No fuzzy logic. No probability.
 * ASCII compare only — no localeCompare, no toLowerCase.
 * Deterministic — same input always produces same output.
 */
export function classifyComplaint(feedbackType: string): ComplaintType {
  if (feedbackType === 'abuse') return 'ABUSE';
  if (feedbackType === 'fraud') return 'FRAUD';
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Canonical JSON — Bounce Event Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for bounce event ID derivation.
 *
 * Includes (in fixed order):
 *   tenantId, communicationId, recipientAddress,
 *   bounceType, diagnosticCode, reportedTimestamp
 *
 * Excludes:
 *   bounceEventId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 */
function canonicalizeBouncePreId(input: BounceEventInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"communicationId":${JSON.stringify(input.communicationId)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"bounceType":${JSON.stringify(input.bounceType)},` +
    `"diagnosticCode":${JSON.stringify(input.diagnosticCode)},` +
    `"reportedTimestamp":${JSON.stringify(input.reportedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Bounce Event Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for bounce event dual-hash computation.
 *
 * Includes (in fixed order):
 *   bounceEventId, tenantId, communicationId, recipientAddress,
 *   bounceType, diagnosticCode, reportedTimestamp
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeBounceFull(
  bounceEventId: string,
  input: BounceEventInput
): string {
  return (
    '{' +
    `"bounceEventId":${JSON.stringify(bounceEventId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"communicationId":${JSON.stringify(input.communicationId)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"bounceType":${JSON.stringify(input.bounceType)},` +
    `"diagnosticCode":${JSON.stringify(input.diagnosticCode)},` +
    `"reportedTimestamp":${JSON.stringify(input.reportedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Complaint Event Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for complaint event ID derivation.
 *
 * Includes (in fixed order):
 *   tenantId, communicationId, recipientAddress,
 *   complaintType, feedbackId, reportedTimestamp
 */
function canonicalizeComplaintPreId(input: ComplaintEventInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"communicationId":${JSON.stringify(input.communicationId)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"complaintType":${JSON.stringify(input.complaintType)},` +
    `"feedbackId":${JSON.stringify(input.feedbackId)},` +
    `"reportedTimestamp":${JSON.stringify(input.reportedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Complaint Event Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for complaint event dual-hash computation.
 *
 * Includes (in fixed order):
 *   complaintEventId, tenantId, communicationId, recipientAddress,
 *   complaintType, feedbackId, reportedTimestamp
 */
function canonicalizeComplaintFull(
  complaintEventId: string,
  input: ComplaintEventInput
): string {
  return (
    '{' +
    `"complaintEventId":${JSON.stringify(complaintEventId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"communicationId":${JSON.stringify(input.communicationId)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"complaintType":${JSON.stringify(input.complaintType)},` +
    `"feedbackId":${JSON.stringify(input.feedbackId)},` +
    `"reportedTimestamp":${JSON.stringify(input.reportedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Bounce Event — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete bounce event entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes bounceEventId and hashes)
 *   2. Derive bounceEventId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes bounceEventId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete BounceEventEntity
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildBounceEvent(
  input: BounceEventInput
): Promise<BounceEventEntity> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeBouncePreId(input);

  // Step 2: Derive bounceEventId
  const bounceEventId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeBounceFull(bounceEventId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    bounceEventId,
    tenantId: input.tenantId,
    communicationId: input.communicationId,
    recipientAddress: input.recipientAddress,
    bounceType: input.bounceType,
    diagnosticCode: input.diagnosticCode,
    reportedTimestamp: input.reportedTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Build Complaint Event — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete complaint event entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes complaintEventId and hashes)
 *   2. Derive complaintEventId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes complaintEventId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete ComplaintEventEntity
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildComplaintEvent(
  input: ComplaintEventInput
): Promise<ComplaintEventEntity> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeComplaintPreId(input);

  // Step 2: Derive complaintEventId
  const complaintEventId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeComplaintFull(complaintEventId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    complaintEventId,
    tenantId: input.tenantId,
    communicationId: input.communicationId,
    recipientAddress: input.recipientAddress,
    complaintType: input.complaintType,
    feedbackId: input.feedbackId,
    reportedTimestamp: input.reportedTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Update Recipient Reputation — deterministic state transition
// ---------------------------------------------------------------------------

/**
 * Determine new recipient reputation status based on current status and event.
 *
 * Rules (one-directional, no downgrade, no reversal):
 *   HARD bounce:
 *     Any status → HARD_BOUNCED
 *   COMPLAINT:
 *     Any status → COMPLAINT
 *   SOFT bounce:
 *     ACTIVE → SOFT_BOUNCE
 *     SOFT_BOUNCE → SOFT_BOUNCE (remains, counter incremented by caller)
 *     HARD_BOUNCED → HARD_BOUNCED (no reversal)
 *     COMPLAINT → COMPLAINT (no reversal)
 *
 * No downgrade allowed.
 * No status reversal logic.
 * Deterministic — same inputs always produce same output.
 */
export function updateRecipientReputation(
  currentStatus: RecipientReputationStatus,
  eventType: 'HARD' | 'SOFT' | 'COMPLAINT'
): RecipientReputationStatus {
  // HARD bounce always escalates to HARD_BOUNCED
  if (eventType === 'HARD') return 'HARD_BOUNCED';

  // COMPLAINT always escalates to COMPLAINT
  if (eventType === 'COMPLAINT') return 'COMPLAINT';

  // SOFT bounce: only transitions ACTIVE → SOFT_BOUNCE
  // Already terminal states remain unchanged
  if (currentStatus === 'HARD_BOUNCED') return 'HARD_BOUNCED';
  if (currentStatus === 'COMPLAINT') return 'COMPLAINT';
  return 'SOFT_BOUNCE';
}

// ---------------------------------------------------------------------------
// Check Dispatch Eligibility — pre-dispatch reputation check
// ---------------------------------------------------------------------------

/**
 * Check whether a recipient is eligible for dispatch based on reputation.
 *
 * Rules:
 *   ACTIVE → PASS (eligible)
 *   SOFT_BOUNCE → PASS (allowed but monitoring recommended)
 *   HARD_BOUNCED → FAIL (blocked)
 *   COMPLAINT → FAIL (blocked)
 *
 * Binary PASS/FAIL only.
 * No scoring. No probability.
 * Deterministic — same inputs always produce same output.
 */
export function checkDispatchEligibility(
  record: RecipientReputationRecord
): DispatchEligibilityResult {
  const blocked = record.status === 'HARD_BOUNCED' || record.status === 'COMPLAINT';

  return {
    recipientAddress: record.recipientAddress,
    status: record.status,
    eligible: blocked ? 'FAIL' : 'PASS',
  };
}

// ---------------------------------------------------------------------------
// Soft Bounce Escalation Check — threshold-based escalation
// ---------------------------------------------------------------------------

/**
 * Check whether a soft bounce count has reached the escalation threshold.
 *
 * If softBounceCount >= threshold → should escalate to HARD_BOUNCED.
 * Default threshold: 3 consecutive soft bounces.
 *
 * Binary result only.
 * No probability. No scoring.
 * Deterministic — same inputs always produce same output.
 */
export function shouldEscalateSoftBounce(
  softBounceCount: number,
  threshold: number
): boolean {
  return softBounceCount >= threshold;
}
