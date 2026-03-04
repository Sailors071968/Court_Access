// ============================================
// Court Access — Communication Model (Phase 16)
// Deterministic Communication Ledger
//
// Defines the CommunicationEntity schema, per-agency chain,
// response logging, escalation timer model, and validation types.
//
// This layer creates deterministic, court-admissible
// communication records:
//   - SES email sends
//   - Public records requests
//   - Follow-up escalation tracking
//   - Non-response timers
//   - Attorney-ready evidence packets
//   - Anchor eligibility for communications
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - No update
//   - No re-hashing of historical entries
//   - Append-only discipline
//   - Forward-only hash chain (per-agency)
//   - Deterministic reconstruction possible from ledger alone
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
//   - Escalation timers accept currentTimestamp as parameter
// ============================================

// ---------------------------------------------------------------------------
// Communication Type
// ---------------------------------------------------------------------------

/**
 * Communication types — additive only, none removed.
 *
 * INITIAL_REQUEST   — First outreach to agency
 * FOLLOW_UP_1       — First follow-up after non-response
 * FOLLOW_UP_2       — Second follow-up after non-response
 * ANNUAL_UPDATE     — Annual re-request / status update
 */
export type CommunicationType =
  | 'INITIAL_REQUEST'
  | 'FOLLOW_UP_1'
  | 'FOLLOW_UP_2'
  | 'ANNUAL_UPDATE';

// ---------------------------------------------------------------------------
// Delivery Status
// ---------------------------------------------------------------------------

/**
 * Delivery status for outbound communications.
 * Deterministic — no probabilistic delivery scoring.
 *
 * QUEUED     — Created but not yet sent
 * SENT       — Dispatched to delivery provider
 * DELIVERED  — Confirmed delivery (provider acknowledgment)
 * BOUNCED    — Delivery failure (permanent)
 * FAILED     — Delivery failure (transient or unknown)
 */
export type DeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'FAILED';

// ---------------------------------------------------------------------------
// Communication Entity — single outbound communication record
// ---------------------------------------------------------------------------

/**
 * A single outbound communication record.
 *
 * Each communication is:
 *   - Hash-chained per agency (previousCommunicationHash links to prior)
 *   - Dual-hashed (SHA-256 + SHA3-256)
 *   - Cross-referenced to tenant and agency
 *   - Anchor-eligible (can be included in daily anchor chain)
 *
 * Fields (canonical ordering for hash computation):
 *   1. communicationId    — deterministic ID (SHA-256 of canonical pre-ID form)
 *   2. sequenceNumber     — per-agency monotonically increasing (1-indexed, no gaps)
 *   3. tenantId           — tenant scope
 *   4. agencyId           — target agency
 *   5. caseId             — associated case (if applicable)
 *   6. communicationType  — INITIAL_REQUEST | FOLLOW_UP_1 | FOLLOW_UP_2 | ANNUAL_UPDATE
 *   7. sentTimestamp      — when communication was sent (ISO 8601, caller-provided)
 *   8. deliveryStatus     — QUEUED | SENT | DELIVERED | BOUNCED | FAILED
 *   9. recipientAddress   — email address of recipient
 *  10. subject            — email subject line
 *  11. messageHash        — SHA-256 of canonical email body
 *  12. previousCommunicationHash — SHA-256 of previous entry in per-agency chain
 *                                   First entry uses genesis hash: 64 zeros
 *  13. description        — human-readable description (no interpretive language)
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256              — SHA-256 of canonical JSON
 *   - sha3_256            — SHA3-256 of canonical JSON
 *
 * Per-agency chain rule:
 *   entry[N].previousCommunicationHash === entry[N-1].sha256
 *   entry[0].previousCommunicationHash === '0'.repeat(64) (genesis)
 */
export interface CommunicationEntity {
  communicationId: string;             // SHA-256 of canonical pre-ID form (64 hex chars)
  sequenceNumber: number;              // Per-agency, monotonically increasing, 1-indexed, integer
  tenantId: string;
  agencyId: string;
  caseId: string;                      // Associated case ID (empty string if not case-specific)
  communicationType: CommunicationType;
  sentTimestamp: string;               // ISO 8601, caller-provided, deterministic
  deliveryStatus: DeliveryStatus;
  recipientAddress: string;            // Email address
  subject: string;                     // Email subject line
  messageHash: string;                 // SHA-256 of canonical email body (64 hex chars)
  previousCommunicationHash: string;   // SHA-256 of previous entry in per-agency chain (64 hex chars)
  description: string;                 // No interpretive language
  sha256: string;                      // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                    // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Communication Input — for creating new outbound communications
// ---------------------------------------------------------------------------

/**
 * Input for creating a new outbound communication.
 *
 * The caller provides all fields except:
 *   - communicationId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 *
 * previousCommunicationHash is required — the caller must provide the SHA-256
 * of the previous entry in the per-agency chain (or genesis hash for first).
 */
export interface CommunicationInput {
  sequenceNumber: number;
  tenantId: string;
  agencyId: string;
  caseId: string;
  communicationType: CommunicationType;
  sentTimestamp: string;
  deliveryStatus: DeliveryStatus;
  recipientAddress: string;
  subject: string;
  messageHash: string;
  previousCommunicationHash: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Response Entity — incoming response record
// ---------------------------------------------------------------------------

/**
 * A single incoming response record.
 *
 * Each response is:
 *   - Linked to its prior outbound communication
 *   - Dual-hashed (SHA-256 + SHA3-256)
 *   - Raw body hashed
 *   - Header hash stored
 *   - Attachment hashes stored
 *
 * Fields:
 *   1. responseId          — deterministic ID (SHA-256 of canonical pre-ID form)
 *   2. tenantId            — tenant scope
 *   3. agencyId            — responding agency
 *   4. linkedCommunicationId — communicationId of the outbound this responds to
 *   5. receivedTimestamp    — when response was received (ISO 8601, caller-provided)
 *   6. bodyHash            — SHA-256 of raw response body
 *   7. headerHash          — SHA-256 of canonical response headers
 *   8. attachmentHashes    — array of SHA-256 hashes of each attachment (sorted ASC)
 *   9. senderAddress       — email address of responder
 *  10. subject             — response subject line
 *  11. description         — human-readable description (no interpretive language)
 *
 * Hash fields:
 *   - sha256               — SHA-256 of canonical JSON
 *   - sha3_256             — SHA3-256 of canonical JSON
 */
export interface ResponseEntity {
  responseId: string;                  // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  agencyId: string;
  linkedCommunicationId: string;       // communicationId this responds to
  receivedTimestamp: string;           // ISO 8601, caller-provided, deterministic
  bodyHash: string;                    // SHA-256 of raw response body (64 hex chars)
  headerHash: string;                  // SHA-256 of canonical response headers (64 hex chars)
  attachmentHashes: string[];          // SHA-256 of each attachment, sorted ASC (ASCII)
  senderAddress: string;               // Email address of responder
  subject: string;                     // Response subject line
  description: string;                 // No interpretive language
  sha256: string;                      // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                    // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Response Input — for creating new response records
// ---------------------------------------------------------------------------

/**
 * Input for creating a new response record.
 *
 * The caller provides all fields except:
 *   - responseId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface ResponseInput {
  tenantId: string;
  agencyId: string;
  linkedCommunicationId: string;
  receivedTimestamp: string;
  bodyHash: string;
  headerHash: string;
  attachmentHashes: string[];
  senderAddress: string;
  subject: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Escalation Timer Model
// ---------------------------------------------------------------------------

/**
 * Escalation status — deterministic evaluation result.
 *
 * NOT_DUE       — Timer has not elapsed
 * DUE           — Timer has elapsed, escalation required
 * ESCALATED     — Follow-up has been sent
 * RESPONDED     — Agency responded before escalation deadline
 */
export type EscalationStatus =
  | 'NOT_DUE'
  | 'DUE'
  | 'ESCALATED'
  | 'RESPONDED';

/**
 * Escalation thresholds — integer days for each follow-up tier.
 *
 * followUp1Days — Days until first follow-up is due
 * followUp2Days — Days until second follow-up is due
 * annualDays    — Days until annual re-request is due
 */
export interface EscalationThresholds {
  followUp1Days: number;               // Integer days until FOLLOW_UP_1 is due
  followUp2Days: number;               // Integer days until FOLLOW_UP_2 is due
  annualDays: number;                   // Integer days until ANNUAL_UPDATE is due
}

/**
 * Escalation evaluation result for a single agency communication chain.
 *
 * Deterministic evaluation:
 *   - Accepts currentTimestamp as input parameter
 *   - No Date.now
 *   - No runtime clock dependency
 *   - Same inputs always produce same output
 */
export interface EscalationEvaluation {
  agencyId: string;
  lastCommunicationType: CommunicationType;
  lastSentTimestamp: string;           // ISO 8601
  currentTimestamp: string;            // ISO 8601, caller-provided
  elapsedDays: number;                 // Integer days elapsed
  status: EscalationStatus;
  nextAction: CommunicationType | null; // What communication type is due next (null if responded)
}

// ---------------------------------------------------------------------------
// Per-Agency Chain Verification
// ---------------------------------------------------------------------------

/**
 * Result of verifying a single link in a per-agency communication chain.
 */
export interface CommunicationChainLinkVerification {
  communicationId: string;
  sequenceNumber: number;
  verifiedLink: 'PASS' | 'FAIL';
  verifiedHash: 'PASS' | 'FAIL';
  verifiedSequence: 'PASS' | 'FAIL';
}

/**
 * Result of verifying an entire per-agency communication chain.
 *
 * overallResult: PASS only if ALL links pass ALL checks.
 * Binary only. No partial pass.
 */
export interface CommunicationChainVerificationResult {
  agencyId: string;
  links: CommunicationChainLinkVerification[];
  overallResult: 'PASS' | 'FAIL';
  totalEntries: number;
  brokenLinks: number;
  hashMismatches: number;
  sequenceGaps: number;
}

// ---------------------------------------------------------------------------
// Communication Field Validation
// ---------------------------------------------------------------------------

/**
 * Single field validation for communication entry structural checks.
 * Binary only: PASS or FAIL.
 */
export interface CommunicationFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

/**
 * Validation matrix for communication entry structural checks.
 * Overall: PASS only if ALL fields pass.
 */
export interface CommunicationValidationMatrix {
  fields: CommunicationFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// CI Communication Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement for communication chain integrity.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked.
 */
export interface CICommunicationEnforcementResult {
  result: 'PASS' | 'FAIL';
  brokenLinks: number;
  hashMismatches: number;
  sequenceGaps: number;
  totalEntries: number;
}

// ---------------------------------------------------------------------------
// Genesis Hash Constant
// ---------------------------------------------------------------------------

/**
 * Genesis hash — the previousCommunicationHash for the first entry in a per-agency chain.
 * 64 zero characters (chain origin).
 * This is a structural constant, not a computed hash.
 */
export const GENESIS_COMMUNICATION_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Default Escalation Thresholds
// ---------------------------------------------------------------------------

/**
 * Default escalation thresholds.
 * Integer days. No floating point. No fractional days.
 *
 * 30 days  — first follow-up
 * 60 days  — second follow-up
 * 365 days — annual re-request
 */
export const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
  followUp1Days: 30,
  followUp2Days: 60,
  annualDays: 365,
};
