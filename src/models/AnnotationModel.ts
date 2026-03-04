// ============================================
// Court Access — Annotation Model (Phase 13)
// Controlled Annotation & Attorney Collaboration Layer
//
// Defines types for read-only intelligence with
// structured discussion anchoring.
//
// This is collaboration infrastructure:
//   - AI-generated entities remain immutable
//   - Annotations are separate entities
//   - No annotation modifies original output
//   - All annotations dual-hashed
//   - All annotation ordering deterministic
//   - Tenant isolation strictly enforced
//   - Role-based access required
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - No credibility analysis / intent inference
//   - No "advice" / "recommend" / "strategy"
//   - No "should" / "suggest" / "violation"
//   - Deterministic processing
//   - Two-pass hash derivation
//   - No editing of AI output
//   - No deletion — archive only
// ============================================

// ---------------------------------------------------------------------------
// Attached Entity Type
// ---------------------------------------------------------------------------

/**
 * The type of entity an annotation is attached to.
 * Annotations anchor to specific intelligence output entities.
 */
export type AttachedEntityType =
  | 'ISSUE'
  | 'CALCRIM_ELEMENT'
  | 'POLICY_COMPARISON'
  | 'MEDIA_ALIGNMENT';

// ---------------------------------------------------------------------------
// Author Role
// ---------------------------------------------------------------------------

/**
 * Role of the annotation author.
 * Only verified defendants and attorneys may annotate.
 */
export type AuthorRole = 'DEFENDANT' | 'ATTORNEY';

// ---------------------------------------------------------------------------
// Collaboration Permission
// ---------------------------------------------------------------------------

/**
 * Permission levels for collaboration.
 *
 * VIEW_ONLY — can view structured outputs
 * ANNOTATE  — can view + add annotations
 * EXPORT    — can view + annotate + export
 *
 * No editing permission. No delete permission. Archive only.
 */
export type CollaborationPermission =
  | 'VIEW_ONLY'
  | 'ANNOTATE'
  | 'EXPORT';

// ---------------------------------------------------------------------------
// Annotation Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of an annotation attached to an intelligence entity.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> annotationId
 *   Pass 2: full canonical -> dual-hash
 *
 * No annotation modifies original output.
 * Append-only. No update. No delete.
 */
export interface AnnotationEntity {
  annotationId: string;                      // SHA-256 of canonical pre-ID form
  tenantId: string;
  caseId: string;
  attachedEntityType: AttachedEntityType;
  attachedEntityId: string;
  citationReference: string;
  authorUserId: string;
  authorRole: AuthorRole;
  commentText: string;
  createdTimestamp: string;                  // ISO 8601, caller-provided
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Annotation Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new annotation entity.
 */
export interface AnnotationInput {
  tenantId: string;
  caseId: string;
  attachedEntityType: AttachedEntityType;
  attachedEntityId: string;
  citationReference: string;
  authorUserId: string;
  authorRole: AuthorRole;
  commentText: string;
  createdTimestamp: string;
}

// ---------------------------------------------------------------------------
// Share Link Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a share link for case collaboration.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> shareId
 *   Pass 2: full canonical -> dual-hash
 *
 * Read-only. Time-limited. No anonymous editing.
 */
export interface ShareLinkEntity {
  shareId: string;                           // SHA-256 of canonical pre-ID form
  caseId: string;
  tenantId: string;
  expiresAt: string;                         // ISO 8601, caller-provided
  createdBy: string;
  createdTimestamp: string;                  // ISO 8601, caller-provided
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Share Link Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new share link entity.
 */
export interface ShareLinkInput {
  caseId: string;
  tenantId: string;
  expiresAt: string;
  createdBy: string;
  createdTimestamp: string;
}
