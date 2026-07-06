// ============================================
// Court Access — Send Queue Model (Phase O1)
// SES Warm-Up Scheduler Engine
//
// Defines the SendQueueEntry schema, send status types,
// warm-up configuration, and CI enforcement types.
//
// A send queue entry represents a single outbound email
// that has been pre-logged in the CommunicationLedger
// and is awaiting dispatch through the SES warm-up pipeline.
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
//   - No update
//   - Append-only discipline
//   - Binary PASS/FAIL only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Send Status — lifecycle of a queued send
// ---------------------------------------------------------------------------

/**
 * Status of a send queue entry.
 * Additive-only — new statuses may be added, none removed.
 *
 * Lifecycle:
 *   QUEUED → DISPATCHED (success)
 *   QUEUED → FAILED (SES error)
 *   QUEUED → THROTTLED (warmup limit reached)
 *   QUEUED → BLOCKED (warmup gate FAIL)
 */
export type SendStatus =
  | 'QUEUED'
  | 'DISPATCHED'
  | 'FAILED'
  | 'THROTTLED'
  | 'BLOCKED';

// ---------------------------------------------------------------------------
// Send Queue Entry — a single queued outbound email
// ---------------------------------------------------------------------------

/**
 * A single send queue entry.
 *
 * Fields (canonical ordering for hash computation):
 *   1. queueId              — SHA-256 of canonical pre-ID form
 *   2. tenantId             — tenant scope
 *   3. communicationId      — must exist in CommunicationLedger
 *   4. agencyId             — target agency
 *   5. recipientAddress     — email recipient
 *   6. scheduledTimestamp   — when to send (ISO 8601, deterministic)
 *   7. createdTimestamp     — when entry was created (ISO 8601, caller-provided)
 *   8. sendStatus           — current lifecycle status
 *
 * Hash fields (computed FROM canonical form, NOT part of it):
 *   - sha256                — SHA-256 of canonical JSON
 *   - sha3_256              — SHA3-256 of canonical JSON
 *
 * Two-pass derivation:
 *   Pass 1: pre-ID canonical (excludes queueId, sha256, sha3_256) → queueId
 *   Pass 2: full canonical (includes queueId, excludes sha256, sha3_256) → dual-hash
 */
export interface SendQueueEntry {
  queueId: string;                       // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  communicationId: string;               // Must exist in CommunicationLedger
  agencyId: string;
  recipientAddress: string;
  scheduledTimestamp: string;            // ISO 8601, deterministic
  createdTimestamp: string;              // ISO 8601, caller-provided
  sendStatus: SendStatus;
  sha256: string;                        // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                      // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Send Queue Entry Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new send queue entry.
 *
 * The caller provides all fields except:
 *   - queueId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface SendQueueEntryInput {
  tenantId: string;
  communicationId: string;
  agencyId: string;
  recipientAddress: string;
  scheduledTimestamp: string;            // ISO 8601, deterministic
  createdTimestamp: string;              // ISO 8601, caller-provided
  sendStatus: SendStatus;
}

// ---------------------------------------------------------------------------
// Warm-Up Configuration
// ---------------------------------------------------------------------------

/**
 * A single warm-up tier defining per-day and per-hour limits.
 * All values must be positive integers.
 * No floating point.
 */
export interface WarmupTier {
  maxPerDay: number;                     // Maximum sends per day
  maxPerHour: number;                    // Maximum sends per hour
}

/**
 * Weekly warm-up schedule.
 * 4 tiers, monotonically increasing.
 * Hard-coded — no dynamic auto-scaling.
 * No randomness.
 */
export interface WarmupSchedule {
  week1: WarmupTier;                     // 20/day, 5/hour
  week2: WarmupTier;                     // 50/day, 10/hour
  week3: WarmupTier;                     // 150/day, 25/hour
  week4: WarmupTier;                     // 300/day, 50/hour
}

// ---------------------------------------------------------------------------
// Dispatch Window Evaluation Result
// ---------------------------------------------------------------------------

/**
 * Reason for dispatch window evaluation.
 * ALLOWED: dispatch can proceed.
 * DAILY_LIMIT: daily quota exceeded.
 * HOURLY_LIMIT: hourly quota exceeded.
 */
export type DispatchReason =
  | 'ALLOWED'
  | 'DAILY_LIMIT'
  | 'HOURLY_LIMIT';

/**
 * Result of evaluating whether a dispatch window is open.
 * Deterministic — same inputs always produce same result.
 */
export interface DispatchWindowResult {
  canDispatch: boolean;
  dailyLimit: number;
  hourlyLimit: number;
  reason: DispatchReason;
}

// ---------------------------------------------------------------------------
// Dispatch Result — outcome of a single SES dispatch attempt
// ---------------------------------------------------------------------------

/**
 * Result of dispatching a single email via SES.
 * Maps to SendStatus transitions:
 *   'DISPATCHED' — SES accepted the message
 *   'FAILED' — SES rejected or error occurred
 *   'THROTTLED' — SES returned throttling response
 */
export type DispatchOutcome =
  | 'DISPATCHED'
  | 'FAILED'
  | 'THROTTLED';

/**
 * Result of a single SES dispatch attempt.
 */
export interface DispatchResult {
  queueId: string;
  outcome: DispatchOutcome;
  messageId: string;                     // SES message ID (empty string if failed/throttled)
  dispatchedTimestamp: string;           // ISO 8601, caller-provided
}

// ---------------------------------------------------------------------------
// Warmup Schedule Validation Result
// ---------------------------------------------------------------------------

/**
 * Result of validating a warmup schedule.
 * Binary PASS/FAIL only.
 */
export interface WarmupScheduleValidationResult {
  result: 'PASS' | 'FAIL';
  week1Valid: boolean;
  week2Valid: boolean;
  week3Valid: boolean;
  week4Valid: boolean;
  monotonicDailyValid: boolean;
  monotonicHourlyValid: boolean;
}
