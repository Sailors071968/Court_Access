// ============================================
// Court Access — Collaboration Access Engine (Phase 13)
// Role-Based Collaboration Permission Enforcement
//
// Enforces role-based access for collaboration features.
// Binary ALLOW/DENY decisions only.
//
// Permission matrix:
//   DEFENDANT: VIEW_ONLY + ANNOTATE
//   ATTORNEY:  VIEW_ONLY + ANNOTATE + EXPORT
//   No editing permission. No delete permission. Archive only.
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
//   - No legal advice / outcome prediction
//   - No "advice" / "recommend" / "strategy"
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  AuthorRole,
  CollaborationPermission,
} from '../models/AnnotationModel';

// ---------------------------------------------------------------------------
// Enforce Collaboration Access — binary ALLOW/DENY
// ---------------------------------------------------------------------------

/**
 * Enforce collaboration access based on role and requested permission.
 *
 * Permission matrix:
 *   DEFENDANT:
 *     VIEW_ONLY → ALLOW
 *     ANNOTATE  → ALLOW
 *     EXPORT    → DENY
 *
 *   ATTORNEY:
 *     VIEW_ONLY → ALLOW
 *     ANNOTATE  → ALLOW
 *     EXPORT    → ALLOW
 *
 * Unknown role → DENY (fail closed).
 * Binary decision only.
 * Deterministic — same inputs always produce same result.
 */
export function enforceCollaborationAccess(
  role: AuthorRole,
  requestedPermission: CollaborationPermission
): 'ALLOW' | 'DENY' {
  if (role === 'DEFENDANT') {
    if (
      requestedPermission === 'VIEW_ONLY' ||
      requestedPermission === 'ANNOTATE'
    ) {
      return 'ALLOW';
    }
    return 'DENY';
  }

  if (role === 'ATTORNEY') {
    if (
      requestedPermission === 'VIEW_ONLY' ||
      requestedPermission === 'ANNOTATE' ||
      requestedPermission === 'EXPORT'
    ) {
      return 'ALLOW';
    }
    return 'DENY';
  }

  // Unknown role → DENY (fail closed)
  return 'DENY';
}

// ---------------------------------------------------------------------------
// Enforce Tenant Isolation — annotation context
// ---------------------------------------------------------------------------

/**
 * Verify that an annotation belongs to the correct tenant context.
 *
 * Rules:
 *   1. Annotation tenantId must match current tenantId
 *   2. Case must belong to tenant (caller provides caseId list)
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceAnnotationTenantIsolation(
  annotationTenantId: string,
  currentTenantId: string,
  caseId: string,
  tenantCaseIds: readonly string[]
): 'PASS' | 'FAIL' {
  // Tenant ID must match
  if (annotationTenantId !== currentTenantId) {
    return 'FAIL';
  }

  // Case must belong to tenant
  for (let i = 0; i < tenantCaseIds.length; i++) {
    if (tenantCaseIds[i] === caseId) {
      return 'PASS';
    }
  }

  return 'FAIL';
}

// ---------------------------------------------------------------------------
// Enforce Share Link Access
// ---------------------------------------------------------------------------

/**
 * Verify that a share link provides valid access.
 *
 * Rules:
 *   1. Share link tenant must match current tenant
 *   2. Share link must not be expired (caller provides validity status)
 *   3. Share link is read-only — no editing, no deletion
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceShareLinkAccess(
  shareLinkTenantId: string,
  currentTenantId: string,
  shareLinkValidity: 'VALID' | 'EXPIRED'
): 'PASS' | 'FAIL' {
  if (shareLinkTenantId !== currentTenantId) {
    return 'FAIL';
  }

  if (shareLinkValidity === 'EXPIRED') {
    return 'FAIL';
  }

  return 'PASS';
}
