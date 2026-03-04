// ============================================
// Court Access — Attorney Onboarding Model (Phase O7)
// Controlled Onboarding Workflow (Attorney-Facing)
//
// Defines types for the controlled professional onboarding
// pipeline for licensed attorneys.
//
// This is NOT a self-serve SaaS signup.
// This is a controlled professional onboarding pipeline:
//   - Attorneys request access
//   - Identity verified manually
//   - Manual approval required before activation
//   - Scoped permissions assigned
//   - All events logged immutably
//   - No auto-tenant creation
//   - No auto-approval
//   - FreezeState (O5) respected
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - Append-only discipline
//   - Deterministic processing
//   - Two-pass hash derivation
//   - No auto-approval
//   - No auto-tenant creation
// ============================================

// ---------------------------------------------------------------------------
// Application Status
// ---------------------------------------------------------------------------

/**
 * Application status — explicit state transitions only.
 *
 * PENDING  — submitted, awaiting manual review
 * APPROVED — manually approved by authorized user
 * REJECTED — manually rejected (archived, never deleted)
 *
 * Status must never auto-transition.
 * Every transition requires explicit function call.
 */
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ---------------------------------------------------------------------------
// Attorney Role
// ---------------------------------------------------------------------------

/**
 * Attorney role within a tenant.
 *
 * PRIMARY_ATTORNEY    — full strategic control, can approve actions
 * ASSOCIATE_ATTORNEY  — limited control, cannot approve agency activation
 * READ_ONLY           — view only, cannot trigger any actions
 */
export type AttorneyRole =
  | 'PRIMARY_ATTORNEY'
  | 'ASSOCIATE_ATTORNEY'
  | 'READ_ONLY';

// ---------------------------------------------------------------------------
// Onboarding Event Type
// ---------------------------------------------------------------------------

/**
 * Event types for the onboarding audit trail.
 */
export type OnboardingEventType =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ROLE_ASSIGNED';

// ---------------------------------------------------------------------------
// Attorney Application Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of an attorney's application for access.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical (excludes applicationId, sha256, sha3_256) → applicationId
 *   Pass 2: full canonical (includes applicationId, excludes sha256, sha3_256) → dual-hash
 *
 * applicationStatus must never auto-transition.
 * Only explicit approval/rejection functions change status.
 * Append-only — no update, no delete.
 */
export interface AttorneyApplicationEntity {
  applicationId: string;                     // SHA-256 of canonical pre-ID form (64 hex chars)
  fullName: string;
  barNumber: string;
  state: string;                             // Must be "CA"
  firmName: string | null;
  emailAddress: string;
  phoneNumber: string | null;
  applicationTimestamp: string;              // ISO 8601, caller-provided
  applicationStatus: ApplicationStatus;
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Attorney Application Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new attorney application.
 *
 * The caller provides all fields except:
 *   - applicationId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface AttorneyApplicationInput {
  fullName: string;
  barNumber: string;
  state: string;
  firmName: string | null;
  emailAddress: string;
  phoneNumber: string | null;
  applicationTimestamp: string;
}

// ---------------------------------------------------------------------------
// Attorney Activation Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of attorney activation after manual approval.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical → activationId
 *   Pass 2: full canonical → dual-hash
 *
 * Created only when authorized user approves an application.
 * Never auto-created. Never deleted.
 */
export interface AttorneyActivationEntity {
  activationId: string;                      // SHA-256 of canonical pre-ID form
  applicationId: string;                     // Reference to AttorneyApplicationEntity
  approvedByUserId: string;                  // Human who approved
  tenantId: string;                          // Pre-existing tenant (no auto-create)
  activationTimestamp: string;               // ISO 8601, caller-provided
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Attorney Activation Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new attorney activation entity.
 */
export interface AttorneyActivationInput {
  applicationId: string;
  approvedByUserId: string;
  tenantId: string;
  activationTimestamp: string;
}

// ---------------------------------------------------------------------------
// Attorney Role Assignment — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of role assignment for an attorney within a tenant.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical → roleAssignmentId
 *   Pass 2: full canonical → dual-hash
 *
 * PRIMARY_ATTORNEY must be unique per tenant.
 * Role escalation requires manual override.
 * Append-only — no update, no delete.
 */
export interface AttorneyRoleAssignment {
  roleAssignmentId: string;                  // SHA-256 of canonical pre-ID form
  attorneyUserId: string;
  tenantId: string;
  role: AttorneyRole;
  assignedTimestamp: string;                 // ISO 8601, caller-provided
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Attorney Role Assignment Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new role assignment.
 */
export interface AttorneyRoleAssignmentInput {
  attorneyUserId: string;
  tenantId: string;
  role: AttorneyRole;
  assignedTimestamp: string;
}

// ---------------------------------------------------------------------------
// Onboarding Event Entity — immutable ledger record
// ---------------------------------------------------------------------------

/**
 * Immutable record of an onboarding event.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical → onboardingEventId
 *   Pass 2: full canonical → dual-hash
 *
 * Append-only — no update, no delete.
 */
export interface OnboardingEventEntity {
  onboardingEventId: string;                 // SHA-256 of canonical pre-ID form
  applicationId: string;
  eventType: OnboardingEventType;
  actorUserId: string;
  eventTimestamp: string;                    // ISO 8601, caller-provided
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Onboarding Event Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new onboarding event entity.
 */
export interface OnboardingEventInput {
  applicationId: string;
  eventType: OnboardingEventType;
  actorUserId: string;
  eventTimestamp: string;
}
