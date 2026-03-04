// ============================================
// Court Access — Attorney Approval Engine (Phase O7)
// Manual Review & Approval Only
//
// Handles manual approval and rejection of attorney
// applications. No auto-approval. No auto-activation.
//
// This engine:
//   - Approves PENDING applications only
//   - Checks FreezeState before approval
//   - Creates dual-hashed activation entities
//   - Rejects applications (archived, never deleted)
//   - Never auto-creates tenants
//   - Never auto-approves
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
  AttorneyActivationEntity,
  AttorneyActivationInput,
} from '../models/AttorneyOnboardingModel';

// ---------------------------------------------------------------------------
// Canonicalize Activation Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for activation ID derivation.
 *
 * Includes (in fixed order):
 *   applicationId, approvedByUserId, tenantId, activationTimestamp
 *
 * Excludes:
 *   activationId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 */
function canonicalizeActivationPreId(input: AttorneyActivationInput): string {
  return (
    '{' +
    `"applicationId":${JSON.stringify(input.applicationId)},` +
    `"approvedByUserId":${JSON.stringify(input.approvedByUserId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"activationTimestamp":${JSON.stringify(input.activationTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Activation Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   activationId, applicationId, approvedByUserId, tenantId, activationTimestamp
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeActivationFull(
  activationId: string,
  input: AttorneyActivationInput
): string {
  return (
    '{' +
    `"activationId":${JSON.stringify(activationId)},` +
    `"applicationId":${JSON.stringify(input.applicationId)},` +
    `"approvedByUserId":${JSON.stringify(input.approvedByUserId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"activationTimestamp":${JSON.stringify(input.activationTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Approve Application — manual only, dual-hashed activation
// ---------------------------------------------------------------------------

/**
 * Approve an attorney application and create an activation entity.
 *
 * Rules:
 *   1. Only PENDING applications may be approved
 *   2. FreezeState must be checked by caller (isFrozen must be false)
 *   3. Tenant must already exist (no auto-create)
 *   4. Dual-hash activation entity created
 *   5. Returns null if application is not PENDING
 *
 * No auto-approval. No auto-tenant creation.
 * Caller must verify FreezeState before calling.
 * Caller must verify tenant exists before calling.
 *
 * Deterministic — same inputs always produce same output.
 */
export async function approveApplication(
  application: AttorneyApplicationEntity,
  approvedByUserId: string,
  tenantId: string,
  timestamp: string,
  isFrozen: boolean
): Promise<{
  activation: AttorneyActivationEntity;
  updatedApplication: AttorneyApplicationEntity;
} | null> {
  // Rule 1: Only PENDING applications
  if (application.applicationStatus !== 'PENDING') {
    return null;
  }

  // Rule 2: FreezeState check
  if (isFrozen) {
    return null;
  }

  const input: AttorneyActivationInput = {
    applicationId: application.applicationId,
    approvedByUserId,
    tenantId,
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

  const activation: AttorneyActivationEntity = {
    activationId,
    applicationId: application.applicationId,
    approvedByUserId,
    tenantId,
    activationTimestamp: timestamp,
    sha256,
    sha3_256,
  };

  // Create updated application with APPROVED status
  // This is a NEW entity — not a mutation of the original
  const updatedApplication: AttorneyApplicationEntity = {
    applicationId: application.applicationId,
    fullName: application.fullName,
    barNumber: application.barNumber,
    state: application.state,
    firmName: application.firmName,
    emailAddress: application.emailAddress,
    phoneNumber: application.phoneNumber,
    applicationTimestamp: application.applicationTimestamp,
    applicationStatus: 'APPROVED',
    sha256: application.sha256,
    sha3_256: application.sha3_256,
  };

  return { activation, updatedApplication };
}

// ---------------------------------------------------------------------------
// Reject Application — manual only, immutable rejection
// ---------------------------------------------------------------------------

/**
 * Reject an attorney application.
 *
 * Rules:
 *   1. Only PENDING applications may be rejected
 *   2. Rejected applications remain archived — never deleted
 *   3. Returns new entity with REJECTED status
 *   4. Returns null if application is not PENDING
 *
 * No mutation of original entity.
 * Deterministic — same inputs always produce same output.
 */
export function rejectApplication(
  application: AttorneyApplicationEntity
): AttorneyApplicationEntity | null {
  // Only PENDING applications may be rejected
  if (application.applicationStatus !== 'PENDING') {
    return null;
  }

  // Return new entity with REJECTED status
  // Original entity remains unchanged
  return {
    applicationId: application.applicationId,
    fullName: application.fullName,
    barNumber: application.barNumber,
    state: application.state,
    firmName: application.firmName,
    emailAddress: application.emailAddress,
    phoneNumber: application.phoneNumber,
    applicationTimestamp: application.applicationTimestamp,
    applicationStatus: 'REJECTED',
    sha256: application.sha256,
    sha3_256: application.sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Activation Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an activation entity by recomputing all hashes.
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyActivationEntity(
  entity: AttorneyActivationEntity
): Promise<{
  activationIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: AttorneyActivationInput = {
    applicationId: entity.applicationId,
    approvedByUserId: entity.approvedByUserId,
    tenantId: entity.tenantId,
    activationTimestamp: entity.activationTimestamp,
  };

  // Recompute activationId
  const preIdCanonical = canonicalizeActivationPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const activationIdMatch = recomputedId === entity.activationId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeActivationFull(entity.activationId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    activationIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    activationIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
