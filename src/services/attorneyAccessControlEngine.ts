// ============================================
// Court Access — Attorney Access Control Engine (Phase O7)
// Role-Based Permission Enforcement
//
// Controls role assignments and enforces access permissions
// for attorneys within tenants.
//
// This engine:
//   - Assigns roles with dual-hashed records
//   - Enforces PRIMARY_ATTORNEY uniqueness per tenant
//   - Binary ALLOW/DENY enforcement per action
//   - Checks FreezeState before role assignment
//   - No privilege escalation without manual override
//   - No cross-tenant role leakage
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
//   - Binary ALLOW/DENY only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  AttorneyRole,
  AttorneyRoleAssignment,
  AttorneyRoleAssignmentInput,
} from '../models/AttorneyOnboardingModel';

// ---------------------------------------------------------------------------
// Canonicalize Role Assignment Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for role assignment ID derivation.
 *
 * Includes (in fixed order):
 *   attorneyUserId, tenantId, role, assignedTimestamp
 *
 * Excludes:
 *   roleAssignmentId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 */
function canonicalizeRoleAssignmentPreId(input: AttorneyRoleAssignmentInput): string {
  return (
    '{' +
    `"attorneyUserId":${JSON.stringify(input.attorneyUserId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"role":${JSON.stringify(input.role)},` +
    `"assignedTimestamp":${JSON.stringify(input.assignedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Role Assignment Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   roleAssignmentId, attorneyUserId, tenantId, role, assignedTimestamp
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 */
function canonicalizeRoleAssignmentFull(
  roleAssignmentId: string,
  input: AttorneyRoleAssignmentInput
): string {
  return (
    '{' +
    `"roleAssignmentId":${JSON.stringify(roleAssignmentId)},` +
    `"attorneyUserId":${JSON.stringify(input.attorneyUserId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"role":${JSON.stringify(input.role)},` +
    `"assignedTimestamp":${JSON.stringify(input.assignedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Check Primary Attorney Uniqueness
// ---------------------------------------------------------------------------

/**
 * Check whether a PRIMARY_ATTORNEY already exists for this tenant.
 *
 * Rules:
 *   - Only one PRIMARY_ATTORNEY per tenant
 *   - Caller provides current role assignments for the tenant
 *   - Returns true if a PRIMARY_ATTORNEY already exists
 *
 * Deterministic — same inputs always produce same result.
 */
function hasPrimaryAttorney(
  existingAssignments: readonly AttorneyRoleAssignment[],
  tenantId: string
): boolean {
  for (let i = 0; i < existingAssignments.length; i++) {
    if (
      existingAssignments[i].tenantId === tenantId &&
      existingAssignments[i].role === 'PRIMARY_ATTORNEY'
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Assign Attorney Role — dual-hashed, manual only
// ---------------------------------------------------------------------------

/**
 * Assign a role to an attorney within a tenant.
 *
 * Rules:
 *   1. PRIMARY_ATTORNEY must be unique per tenant
 *   2. FreezeState must be checked by caller (isFrozen must be false)
 *   3. Dual-hash entity creation
 *   4. Returns null if constraints violated
 *
 * No privilege escalation without manual override.
 * No cross-tenant role leakage (caller enforces tenant context).
 *
 * Deterministic — same inputs always produce same output.
 */
export async function assignAttorneyRole(
  attorneyUserId: string,
  tenantId: string,
  role: AttorneyRole,
  timestamp: string,
  isFrozen: boolean,
  existingAssignments: readonly AttorneyRoleAssignment[]
): Promise<AttorneyRoleAssignment | null> {
  // FreezeState check
  if (isFrozen) {
    return null;
  }

  // PRIMARY_ATTORNEY uniqueness check
  if (role === 'PRIMARY_ATTORNEY' && hasPrimaryAttorney(existingAssignments, tenantId)) {
    return null;
  }

  const input: AttorneyRoleAssignmentInput = {
    attorneyUserId,
    tenantId,
    role,
    assignedTimestamp: timestamp,
  };

  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeRoleAssignmentPreId(input);

  // Step 2: Derive roleAssignmentId
  const roleAssignmentId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeRoleAssignmentFull(roleAssignmentId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    roleAssignmentId,
    attorneyUserId,
    tenantId,
    role,
    assignedTimestamp: timestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Enforce Attorney Access — binary ALLOW/DENY
// ---------------------------------------------------------------------------

/**
 * Enforce access control for a specific action based on attorney role.
 *
 * Permission matrix:
 *   PRIMARY_ATTORNEY:
 *     - APPROVE_AGENCY_ACTIVATION  → ALLOW
 *     - REVIEW_ESCALATION          → ALLOW
 *     - VIEW_CASE_DATA             → ALLOW
 *     - MODIFY_CASE_STRATEGY       → ALLOW
 *     - MANAGE_TEAM_ROLES          → ALLOW
 *
 *   ASSOCIATE_ATTORNEY:
 *     - APPROVE_AGENCY_ACTIVATION  → DENY
 *     - REVIEW_ESCALATION          → ALLOW
 *     - VIEW_CASE_DATA             → ALLOW
 *     - MODIFY_CASE_STRATEGY       → DENY
 *     - MANAGE_TEAM_ROLES          → DENY
 *
 *   READ_ONLY:
 *     - APPROVE_AGENCY_ACTIVATION  → DENY
 *     - REVIEW_ESCALATION          → DENY
 *     - VIEW_CASE_DATA             → ALLOW
 *     - MODIFY_CASE_STRATEGY       → DENY
 *     - MANAGE_TEAM_ROLES          → DENY
 *
 * Unknown actions → DENY (fail closed).
 * Binary decision only.
 * Deterministic — same inputs always produce same result.
 */
export function enforceAttorneyAccess(
  role: AttorneyRole,
  requestedAction: string
): 'ALLOW' | 'DENY' {
  if (role === 'PRIMARY_ATTORNEY') {
    if (
      requestedAction === 'APPROVE_AGENCY_ACTIVATION' ||
      requestedAction === 'REVIEW_ESCALATION' ||
      requestedAction === 'VIEW_CASE_DATA' ||
      requestedAction === 'MODIFY_CASE_STRATEGY' ||
      requestedAction === 'MANAGE_TEAM_ROLES'
    ) {
      return 'ALLOW';
    }
    return 'DENY';
  }

  if (role === 'ASSOCIATE_ATTORNEY') {
    if (
      requestedAction === 'REVIEW_ESCALATION' ||
      requestedAction === 'VIEW_CASE_DATA'
    ) {
      return 'ALLOW';
    }
    return 'DENY';
  }

  if (role === 'READ_ONLY') {
    if (requestedAction === 'VIEW_CASE_DATA') {
      return 'ALLOW';
    }
    return 'DENY';
  }

  // Unknown role → DENY (fail closed)
  return 'DENY';
}

// ---------------------------------------------------------------------------
// Verify Role Assignment Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a role assignment entity by recomputing all hashes.
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyRoleAssignmentEntity(
  entity: AttorneyRoleAssignment
): Promise<{
  roleAssignmentIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: AttorneyRoleAssignmentInput = {
    attorneyUserId: entity.attorneyUserId,
    tenantId: entity.tenantId,
    role: entity.role,
    assignedTimestamp: entity.assignedTimestamp,
  };

  // Recompute roleAssignmentId
  const preIdCanonical = canonicalizeRoleAssignmentPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const roleAssignmentIdMatch = recomputedId === entity.roleAssignmentId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeRoleAssignmentFull(entity.roleAssignmentId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    roleAssignmentIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    roleAssignmentIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
