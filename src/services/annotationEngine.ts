// ============================================
// Court Access — Annotation Engine (Phase 13)
// Controlled Annotation Builder
//
// Builds immutable, dual-hashed annotation entities
// and share link entities for case collaboration.
//
// This engine:
//   - Creates annotations attached to intelligence entities
//   - No mutation of target entity
//   - No auto-link inference
//   - No editing of structured text
//   - Deterministic ordering by createdTimestamp ASC
//   - Builds share links (read-only, time-limited)
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
//   - No legal advice / outcome prediction
//   - No "advice" / "recommend" / "strategy"
//   - No "should" / "suggest" / "violation"
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  AnnotationEntity,
  AnnotationInput,
  ShareLinkEntity,
  ShareLinkInput,
} from '../models/AnnotationModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Canonicalize Annotation Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeAnnotationPreId(input: AnnotationInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"attachedEntityType":${JSON.stringify(input.attachedEntityType)},` +
    `"attachedEntityId":${JSON.stringify(input.attachedEntityId)},` +
    `"citationReference":${JSON.stringify(input.citationReference)},` +
    `"authorUserId":${JSON.stringify(input.authorUserId)},` +
    `"authorRole":${JSON.stringify(input.authorRole)},` +
    `"commentText":${JSON.stringify(input.commentText)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Annotation Full Form
// ---------------------------------------------------------------------------

function canonicalizeAnnotationFull(
  annotationId: string,
  input: AnnotationInput
): string {
  return (
    '{' +
    `"annotationId":${JSON.stringify(annotationId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"attachedEntityType":${JSON.stringify(input.attachedEntityType)},` +
    `"attachedEntityId":${JSON.stringify(input.attachedEntityId)},` +
    `"citationReference":${JSON.stringify(input.citationReference)},` +
    `"authorUserId":${JSON.stringify(input.authorUserId)},` +
    `"authorRole":${JSON.stringify(input.authorRole)},` +
    `"commentText":${JSON.stringify(input.commentText)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Annotation Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete annotation entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form
 *   2. Derive annotationId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form
 *   4. Compute dual-hash
 *   5. Return complete entity
 *
 * No mutation of target entity.
 * No auto-link inference.
 * Deterministic — same input always produces same output.
 */
export async function buildAnnotationEntity(
  input: AnnotationInput
): Promise<AnnotationEntity> {
  const preIdCanonical = canonicalizeAnnotationPreId(input);
  const annotationId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeAnnotationFull(annotationId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    annotationId,
    tenantId: input.tenantId,
    caseId: input.caseId,
    attachedEntityType: input.attachedEntityType,
    attachedEntityId: input.attachedEntityId,
    citationReference: input.citationReference,
    authorUserId: input.authorUserId,
    authorRole: input.authorRole,
    commentText: input.commentText,
    createdTimestamp: input.createdTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Sort Annotations — deterministic ordering
// ---------------------------------------------------------------------------

/**
 * Sort annotations by createdTimestamp ASC.
 * ASCII comparison only. No Date.now usage.
 *
 * Returns a new array — does not mutate input.
 * Deterministic — same inputs always produce same output.
 */
export function sortAnnotationsByTimestamp(
  annotations: readonly AnnotationEntity[]
): AnnotationEntity[] {
  const sorted = annotations.slice();
  sorted.sort(function sortByTimestamp(a: AnnotationEntity, b: AnnotationEntity): number {
    return asciiCompare(a.createdTimestamp, b.createdTimestamp);
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Verify Annotation Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyAnnotationEntity(
  entity: AnnotationEntity
): Promise<{
  annotationIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: AnnotationInput = {
    tenantId: entity.tenantId,
    caseId: entity.caseId,
    attachedEntityType: entity.attachedEntityType,
    attachedEntityId: entity.attachedEntityId,
    citationReference: entity.citationReference,
    authorUserId: entity.authorUserId,
    authorRole: entity.authorRole,
    commentText: entity.commentText,
    createdTimestamp: entity.createdTimestamp,
  };

  const preIdCanonical = canonicalizeAnnotationPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const annotationIdMatch = recomputedId === entity.annotationId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeAnnotationFull(entity.annotationId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    annotationIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { annotationIdMatch, sha256Match, sha3_256Match, overallResult };
}

// ---------------------------------------------------------------------------
// Canonicalize Share Link Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeShareLinkPreId(input: ShareLinkInput): string {
  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"expiresAt":${JSON.stringify(input.expiresAt)},` +
    `"createdBy":${JSON.stringify(input.createdBy)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Share Link Full Form
// ---------------------------------------------------------------------------

function canonicalizeShareLinkFull(
  shareId: string,
  input: ShareLinkInput
): string {
  return (
    '{' +
    `"shareId":${JSON.stringify(shareId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"expiresAt":${JSON.stringify(input.expiresAt)},` +
    `"createdBy":${JSON.stringify(input.createdBy)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Share Link Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete share link entity.
 *
 * Read-only. Time-limited. No anonymous editing.
 * Deterministic — same input always produces same output.
 */
export async function buildShareLinkEntity(
  input: ShareLinkInput
): Promise<ShareLinkEntity> {
  const preIdCanonical = canonicalizeShareLinkPreId(input);
  const shareId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeShareLinkFull(shareId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    shareId,
    caseId: input.caseId,
    tenantId: input.tenantId,
    expiresAt: input.expiresAt,
    createdBy: input.createdBy,
    createdTimestamp: input.createdTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Validate Share Link — deterministic expiry check
// ---------------------------------------------------------------------------

/**
 * Validate whether a share link is still valid.
 *
 * Uses Date.parse for ISO 8601 timestamp comparison.
 * Binary VALID/EXPIRED result.
 *
 * Deterministic — same inputs always produce same result.
 */
export function validateShareLink(
  entity: ShareLinkEntity,
  currentTimestamp: string
): 'VALID' | 'EXPIRED' {
  const expiresAtMs = Date.parse(entity.expiresAt);
  const currentMs = Date.parse(currentTimestamp);
  return currentMs < expiresAtMs ? 'VALID' : 'EXPIRED';
}

// ---------------------------------------------------------------------------
// Verify Share Link Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyShareLinkEntity(
  entity: ShareLinkEntity
): Promise<{
  shareIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: ShareLinkInput = {
    caseId: entity.caseId,
    tenantId: entity.tenantId,
    expiresAt: entity.expiresAt,
    createdBy: entity.createdBy,
    createdTimestamp: entity.createdTimestamp,
  };

  const preIdCanonical = canonicalizeShareLinkPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const shareIdMatch = recomputedId === entity.shareId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeShareLinkFull(entity.shareId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    shareIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { shareIdMatch, sha256Match, sha3_256Match, overallResult };
}
