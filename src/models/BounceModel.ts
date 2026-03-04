// ============================================
// Court Access — Bounce Model (Phase O2)
// Bounce / Complaint Handler Engine
//
// Defines bounce event, complaint event, and recipient
// reputation types for SES reputation protection.
//
// A bounce event records a delivery failure from SES SNS.
// A complaint event records a recipient abuse/fraud report.
// Recipient reputation status controls future dispatch eligibility.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports (none required for this model)
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
//   - No update of CommunicationLedger hashes
//   - Append-only discipline
//   - Binary PASS/FAIL only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Bounce Type — hard vs soft
// ---------------------------------------------------------------------------

/**
 * Bounce classification.
 * HARD: permanent delivery failure (invalid address, domain gone).
 * SOFT: temporary delivery failure (mailbox full, server busy).
 */
export type BounceType =
  | 'HARD'
  | 'SOFT';

// ---------------------------------------------------------------------------
// Complaint Type — abuse, fraud, or other
// ---------------------------------------------------------------------------

/**
 * Complaint classification from SES feedback loop.
 * ABUSE: recipient marked as spam/abuse.
 * FRAUD: recipient reported fraud.
 * OTHER: unclassified complaint.
 */
export type ComplaintType =
  | 'ABUSE'
  | 'FRAUD'
  | 'OTHER';

// ---------------------------------------------------------------------------
// Recipient Reputation Status — dispatch eligibility
// ---------------------------------------------------------------------------

/**
 * Recipient reputation status.
 * Controls future dispatch eligibility.
 *
 * Transitions (one-directional, no downgrade):
 *   ACTIVE → SOFT_BOUNCE (on soft bounce)
 *   ACTIVE → HARD_BOUNCED (on hard bounce)
 *   ACTIVE → COMPLAINT (on complaint)
 *   SOFT_BOUNCE → HARD_BOUNCED (on hard bounce or escalation)
 *   SOFT_BOUNCE → COMPLAINT (on complaint)
 *   HARD_BOUNCED → HARD_BOUNCED (no reversal)
 *   COMPLAINT → COMPLAINT (no reversal)
 *
 * No downgrade allowed. No status reversal.
 */
export type RecipientReputationStatus =
  | 'ACTIVE'
  | 'SOFT_BOUNCE'
  | 'HARD_BOUNCED'
  | 'COMPLAINT';

// ---------------------------------------------------------------------------
// Bounce Event Entity
// ---------------------------------------------------------------------------

/**
 * A single bounce event from SES SNS notification.
 *
 * Fields (canonical ordering for hash computation):
 *   1. bounceEventId       — SHA-256 of canonical pre-ID form
 *   2. tenantId            — tenant scope
 *   3. communicationId     — original communication that bounced
 *   4. recipientAddress    — address that bounced
 *   5. bounceType          — HARD or SOFT
 *   6. diagnosticCode      — SES diagnostic code string
 *   7. reportedTimestamp   — ISO 8601 from SNS notification
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256               — SHA-256 of canonical JSON
 *   - sha3_256             — SHA3-256 of canonical JSON
 *
 * Two-pass derivation:
 *   Pass 1: pre-ID canonical (excludes bounceEventId, sha256, sha3_256) → bounceEventId
 *   Pass 2: full canonical (includes bounceEventId, excludes sha256, sha3_256) → dual-hash
 */
export interface BounceEventEntity {
  bounceEventId: string;                 // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  communicationId: string;
  recipientAddress: string;
  bounceType: BounceType;
  diagnosticCode: string;
  reportedTimestamp: string;             // ISO 8601 from SNS
  sha256: string;                        // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                      // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Bounce Event Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new bounce event.
 *
 * The caller provides all fields except:
 *   - bounceEventId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface BounceEventInput {
  tenantId: string;
  communicationId: string;
  recipientAddress: string;
  bounceType: BounceType;
  diagnosticCode: string;
  reportedTimestamp: string;
}

// ---------------------------------------------------------------------------
// Complaint Event Entity
// ---------------------------------------------------------------------------

/**
 * A single complaint event from SES SNS notification.
 *
 * Fields (canonical ordering for hash computation):
 *   1. complaintEventId    — SHA-256 of canonical pre-ID form
 *   2. tenantId            — tenant scope
 *   3. communicationId     — original communication that was complained about
 *   4. recipientAddress    — address that filed complaint
 *   5. complaintType       — ABUSE, FRAUD, or OTHER
 *   6. feedbackId          — SES complaint feedback ID
 *   7. reportedTimestamp   — ISO 8601 from SNS notification
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256               — SHA-256 of canonical JSON
 *   - sha3_256             — SHA3-256 of canonical JSON
 */
export interface ComplaintEventEntity {
  complaintEventId: string;              // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  communicationId: string;
  recipientAddress: string;
  complaintType: ComplaintType;
  feedbackId: string;
  reportedTimestamp: string;             // ISO 8601 from SNS
  sha256: string;                        // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                      // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Complaint Event Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new complaint event.
 *
 * The caller provides all fields except:
 *   - complaintEventId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface ComplaintEventInput {
  tenantId: string;
  communicationId: string;
  recipientAddress: string;
  complaintType: ComplaintType;
  feedbackId: string;
  reportedTimestamp: string;
}

// ---------------------------------------------------------------------------
// Recipient Reputation Record
// ---------------------------------------------------------------------------

/**
 * A recipient's reputation record.
 * Tracks current status, bounce count, and last event timestamp.
 *
 * softBounceCount tracks consecutive soft bounces.
 * After threshold (e.g., 3), caller may escalate to HARD_BOUNCED.
 */
export interface RecipientReputationRecord {
  recipientAddress: string;
  tenantId: string;
  status: RecipientReputationStatus;
  softBounceCount: number;               // Consecutive soft bounces
  lastEventTimestamp: string;            // ISO 8601 of most recent event
}

// ---------------------------------------------------------------------------
// Dispatch Eligibility Check Result
// ---------------------------------------------------------------------------

/**
 * Result of checking whether a recipient is eligible for dispatch.
 * Binary PASS/FAIL only.
 *
 * PASS: recipient is ACTIVE or SOFT_BOUNCE (allowed with monitoring).
 * FAIL: recipient is HARD_BOUNCED or COMPLAINT (blocked).
 */
export interface DispatchEligibilityResult {
  recipientAddress: string;
  status: RecipientReputationStatus;
  eligible: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// SNS Notification Types (for webhook parsing)
// ---------------------------------------------------------------------------

/**
 * SES SNS notification type.
 * BOUNCE: delivery failure.
 * COMPLAINT: recipient complaint.
 */
export type SESNotificationType =
  | 'Bounce'
  | 'Complaint';

/**
 * Normalized SNS bounce payload extracted from SES notification JSON.
 */
export interface NormalizedBouncePayload {
  notificationType: 'Bounce';
  messageId: string;
  recipientAddresses: string[];
  bounceType: string;                    // Raw SES bounce type (e.g., "Permanent", "Transient")
  diagnosticCode: string;
  timestamp: string;                     // ISO 8601
}

/**
 * Normalized SNS complaint payload extracted from SES notification JSON.
 */
export interface NormalizedComplaintPayload {
  notificationType: 'Complaint';
  messageId: string;
  recipientAddresses: string[];
  feedbackType: string;                  // Raw SES feedback type (e.g., "abuse", "fraud")
  feedbackId: string;
  timestamp: string;                     // ISO 8601
}
