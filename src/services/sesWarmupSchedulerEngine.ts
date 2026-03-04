// ============================================
// Court Access — SES Warm-Up Scheduler Engine (Phase O1)
// Deterministic Outbound Email Scheduling
//
// Enforces progressive SES warm-up limits:
//   - Per-hour throttling
//   - Per-day quotas
//   - Weekly tier progression
//   - Sequential dispatch (no parallel burst)
//
// This is a scheduling and rate-control layer ONLY.
// Does NOT generate email content.
// Does NOT modify CommunicationLedger logic.
// Only queues and dispatches already-built communications.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary PASS/FAIL where applicable
//
// Architectural boundary:
//   - Does NOT import any other engine
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
//   - No update
//   - Binary PASS/FAIL only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  SendQueueEntry,
  SendQueueEntryInput,
  WarmupTier,
  WarmupSchedule,
  DispatchWindowResult,
  DispatchReason,
  WarmupScheduleValidationResult,
} from '../models/SendQueueModel';

// ---------------------------------------------------------------------------
// Default Warm-Up Schedule — hard-coded, no dynamic auto-scaling
// ---------------------------------------------------------------------------

/**
 * Default SES warm-up schedule.
 * Monotonically increasing per-day and per-hour limits.
 * No randomness. No dynamic adjustment.
 */
export const DEFAULT_WARMUP_SCHEDULE: WarmupSchedule = {
  week1: { maxPerDay: 20, maxPerHour: 5 },
  week2: { maxPerDay: 50, maxPerHour: 10 },
  week3: { maxPerDay: 150, maxPerHour: 25 },
  week4: { maxPerDay: 300, maxPerHour: 50 },
};

// ---------------------------------------------------------------------------
// Milliseconds per day — constant for tier selection
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Tier Selection — deterministic week selection from timestamps
// ---------------------------------------------------------------------------

/**
 * Determine which warmup tier applies based on days since warmup start.
 *
 * Uses Date.parse for ISO 8601 timestamps (constitutional: no Date.now, no new Date).
 *
 * Logic:
 *   0–6 days   → week1
 *   7–13 days  → week2
 *   14–20 days → week3
 *   21+ days   → week4
 *
 * Deterministic — same timestamps always produce same tier.
 */
function selectWarmupTier(
  currentTimestamp: string,
  warmupStartDate: string,
  schedule: WarmupSchedule
): WarmupTier {
  const currentMs = Date.parse(currentTimestamp);
  const startMs = Date.parse(warmupStartDate);
  const daysSinceStart = Math.floor((currentMs - startMs) / MS_PER_DAY);

  if (daysSinceStart < 7) return schedule.week1;
  if (daysSinceStart < 14) return schedule.week2;
  if (daysSinceStart < 21) return schedule.week3;
  return schedule.week4;
}

// ---------------------------------------------------------------------------
// Evaluate Dispatch Window
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a dispatch is allowed within the current warmup window.
 *
 * Parameters:
 *   - currentTimestamp: ISO 8601, caller-provided
 *   - warmupStartDate: ISO 8601, when SES warm-up began
 *   - todaysDispatchCount: number of sends already dispatched today
 *   - currentHourDispatchCount: number of sends dispatched in current hour
 *   - schedule: WarmupSchedule (use DEFAULT_WARMUP_SCHEDULE or custom)
 *
 * Logic:
 *   1. Select warmup tier based on days since start
 *   2. Check daily limit: todaysDispatchCount < maxPerDay
 *   3. Check hourly limit: currentHourDispatchCount < maxPerHour
 *   4. Return deterministic result
 *
 * Order of checks: daily first, then hourly.
 * If both limits exceeded, DAILY_LIMIT takes precedence.
 *
 * No Date.now. All timestamps passed in.
 * Deterministic — same inputs always produce same result.
 */
export function evaluateDispatchWindow(
  currentTimestamp: string,
  warmupStartDate: string,
  todaysDispatchCount: number,
  currentHourDispatchCount: number,
  schedule: WarmupSchedule
): DispatchWindowResult {
  const tier = selectWarmupTier(currentTimestamp, warmupStartDate, schedule);

  // Check daily limit first
  if (todaysDispatchCount >= tier.maxPerDay) {
    return {
      canDispatch: false,
      dailyLimit: tier.maxPerDay,
      hourlyLimit: tier.maxPerHour,
      reason: 'DAILY_LIMIT' as DispatchReason,
    };
  }

  // Check hourly limit
  if (currentHourDispatchCount >= tier.maxPerHour) {
    return {
      canDispatch: false,
      dailyLimit: tier.maxPerDay,
      hourlyLimit: tier.maxPerHour,
      reason: 'HOURLY_LIMIT' as DispatchReason,
    };
  }

  // Both within limits
  return {
    canDispatch: true,
    dailyLimit: tier.maxPerDay,
    hourlyLimit: tier.maxPerHour,
    reason: 'ALLOWED' as DispatchReason,
  };
}

// ---------------------------------------------------------------------------
// Enforce Warmup Gate — Binary PASS/FAIL
// ---------------------------------------------------------------------------

/**
 * Binary enforcement gate for warmup dispatch.
 *
 * PASS: dispatch allowed.
 * FAIL: dispatch blocked. No bypass. No warning mode.
 *
 * Deterministic — same inputs always produce same result.
 */
export function enforceWarmupGate(
  evaluationResult: DispatchWindowResult
): 'PASS' | 'FAIL' {
  return evaluationResult.canDispatch ? 'PASS' : 'FAIL';
}

// ---------------------------------------------------------------------------
// Canonical JSON — Send Queue Entry Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for queue entry ID derivation.
 *
 * Includes (in fixed order):
 *   tenantId, communicationId, agencyId, recipientAddress,
 *   scheduledTimestamp, createdTimestamp, sendStatus
 *
 * Excludes:
 *   queueId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 * No JSON.stringify key order dependency.
 */
function canonicalizeSendQueuePreId(input: SendQueueEntryInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"communicationId":${JSON.stringify(input.communicationId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"scheduledTimestamp":${JSON.stringify(input.scheduledTimestamp)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)},` +
    `"sendStatus":${JSON.stringify(input.sendStatus)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Send Queue Entry Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   queueId, tenantId, communicationId, agencyId, recipientAddress,
 *   scheduledTimestamp, createdTimestamp, sendStatus
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * No circular hash binding.
 */
function canonicalizeSendQueueFull(
  queueId: string,
  input: SendQueueEntryInput
): string {
  return (
    '{' +
    `"queueId":${JSON.stringify(queueId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"communicationId":${JSON.stringify(input.communicationId)},` +
    `"agencyId":${JSON.stringify(input.agencyId)},` +
    `"recipientAddress":${JSON.stringify(input.recipientAddress)},` +
    `"scheduledTimestamp":${JSON.stringify(input.scheduledTimestamp)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)},` +
    `"sendStatus":${JSON.stringify(input.sendStatus)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Send Queue Entry — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete send queue entry from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes queueId and hashes)
 *   2. Derive queueId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes queueId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete SendQueueEntry
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildSendQueueEntry(
  input: SendQueueEntryInput
): Promise<SendQueueEntry> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeSendQueuePreId(input);

  // Step 2: Derive queueId
  const queueId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeSendQueueFull(queueId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entry
  return {
    queueId,
    tenantId: input.tenantId,
    communicationId: input.communicationId,
    agencyId: input.agencyId,
    recipientAddress: input.recipientAddress,
    scheduledTimestamp: input.scheduledTimestamp,
    createdTimestamp: input.createdTimestamp,
    sendStatus: input.sendStatus,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Validate Warmup Schedule — structural integrity check
// ---------------------------------------------------------------------------

/**
 * Validate a warmup schedule for structural correctness.
 *
 * Checks:
 *   1. All tier values are positive integers (> 0)
 *   2. maxPerDay is monotonically increasing across weeks
 *   3. maxPerHour is monotonically increasing across weeks
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export function validateWarmupSchedule(
  schedule: WarmupSchedule
): WarmupScheduleValidationResult {
  const tiers: WarmupTier[] = [schedule.week1, schedule.week2, schedule.week3, schedule.week4];

  // Validate each tier has positive values
  const week1Valid = schedule.week1.maxPerDay > 0 && schedule.week1.maxPerHour > 0;
  const week2Valid = schedule.week2.maxPerDay > 0 && schedule.week2.maxPerHour > 0;
  const week3Valid = schedule.week3.maxPerDay > 0 && schedule.week3.maxPerHour > 0;
  const week4Valid = schedule.week4.maxPerDay > 0 && schedule.week4.maxPerHour > 0;

  // Validate monotonic increasing daily limits
  let monotonicDailyValid = true;
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].maxPerDay < tiers[i - 1].maxPerDay) {
      monotonicDailyValid = false;
      break;
    }
  }

  // Validate monotonic increasing hourly limits
  let monotonicHourlyValid = true;
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].maxPerHour < tiers[i - 1].maxPerHour) {
      monotonicHourlyValid = false;
      break;
    }
  }

  const allPass =
    week1Valid &&
    week2Valid &&
    week3Valid &&
    week4Valid &&
    monotonicDailyValid &&
    monotonicHourlyValid;

  return {
    result: allPass ? 'PASS' : 'FAIL',
    week1Valid,
    week2Valid,
    week3Valid,
    week4Valid,
    monotonicDailyValid,
    monotonicHourlyValid,
  };
}
