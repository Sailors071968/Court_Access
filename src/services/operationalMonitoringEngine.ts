// ============================================
// Court Access — Operational Monitoring Engine (Phase O4)
// Deterministic Integrity + Reputation + Throughput Observability
//
// Pure aggregation engine that produces daily health snapshots.
// No side effects. No dispatch. No escalation. No mutation.
// No crypto modifications. No store writes.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Read-only aggregation
//
// Architectural boundary:
//   - Imports evaluateDispatchWindow + enforceWarmupGate from O1
//     (read-only evaluation, no dispatch)
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//   - No anchor modifications
//   - No escalation triggering
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of any entity
//   - No deletion
//   - Deterministic processing
//   - All percentages integer-only (Math.floor)
//   - Binary PASS/FAIL only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { evaluateDispatchWindow, enforceWarmupGate } from './sesWarmupSchedulerEngine';

import type { WarmupSchedule } from '../models/SendQueueModel';
import type { SendQueueEntry } from '../models/SendQueueModel';
import type { RecipientReputationRecord } from '../models/BounceModel';
import type { BounceEventEntity, ComplaintEventEntity } from '../models/BounceModel';

import type {
  EscalationDecision,
} from '../models/EscalationModel';

import type {
  WarmupUtilizationMetrics,
  ReputationMetrics,
  EscalationMetrics,
  QueueMetrics,
  IntegrityMetrics,
  DailyOperationalSnapshot,
  WarmupMetricsInput,
} from '../models/OperationalMonitoringModel';

// ---------------------------------------------------------------------------
// MS per day constant
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Compute Current Tier Week
// ---------------------------------------------------------------------------

/**
 * Determine which warmup tier week applies (1, 2, 3, or 4).
 * Uses Date.parse for ISO 8601 timestamps.
 * Deterministic — same inputs always produce same result.
 */
function computeCurrentTierWeek(
  currentTimestamp: string,
  warmupStartDate: string
): number {
  const currentMs = Date.parse(currentTimestamp);
  const startMs = Date.parse(warmupStartDate);
  if (Number.isNaN(currentMs) || Number.isNaN(startMs)) return 1;
  const daysSinceStart = Math.floor((currentMs - startMs) / MS_PER_DAY);
  if (daysSinceStart < 7) return 1;
  if (daysSinceStart < 14) return 2;
  if (daysSinceStart < 21) return 3;
  return 4;
}

// ---------------------------------------------------------------------------
// Safe Integer Percentage
// ---------------------------------------------------------------------------

/**
 * Compute integer percentage using Math.floor.
 * Returns 0 if total is 0 (safe division).
 * Bounded at 100.
 */
function safeIntegerPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  const pct = Math.floor((value / total) * 100);
  return pct > 100 ? 100 : pct;
}

// ---------------------------------------------------------------------------
// 1. Compute Warmup Metrics
// ---------------------------------------------------------------------------

/**
 * Compute warm-up utilization metrics.
 *
 * Uses O1 evaluateDispatchWindow() for gate status.
 * Computes utilization percentages as integer floor.
 * All inputs caller-provided. No Date.now.
 *
 * Deterministic — same inputs always produce same output.
 */
export function computeWarmupMetrics(
  input: WarmupMetricsInput,
  schedule: WarmupSchedule
): WarmupUtilizationMetrics {
  // Evaluate dispatch window via O1
  const windowResult = evaluateDispatchWindow(
    input.currentTimestamp,
    input.warmupStartDate,
    input.todaysDispatchCount,
    input.currentHourDispatchCount,
    schedule
  );

  // Gate status via O1
  const gateStatus = enforceWarmupGate(windowResult);

  // Current tier week
  const currentTierWeek = computeCurrentTierWeek(
    input.currentTimestamp,
    input.warmupStartDate
  );

  // Utilization percentages (integer floor, bounded at 100)
  const dailyUtilizationPercent = safeIntegerPercent(
    input.todaysDispatchCount,
    windowResult.dailyLimit
  );
  const hourlyUtilizationPercent = safeIntegerPercent(
    input.currentHourDispatchCount,
    windowResult.hourlyLimit
  );

  return {
    currentTierWeek,
    maxPerDay: windowResult.dailyLimit,
    maxPerHour: windowResult.hourlyLimit,
    todaysDispatchCount: input.todaysDispatchCount,
    currentHourDispatchCount: input.currentHourDispatchCount,
    dailyUtilizationPercent,
    hourlyUtilizationPercent,
    gateStatus,
  };
}

// ---------------------------------------------------------------------------
// 2. Compute Reputation Metrics
// ---------------------------------------------------------------------------

/**
 * Compute reputation metrics from recipient reputation records.
 *
 * Counts each status category.
 * Computes rates as integer floor.
 * Handles total = 0 safely.
 *
 * softBounceEscalations: count of HARD_BOUNCED recipients that
 * have softBounceCount > 0 (indicating they were escalated from soft).
 *
 * Deterministic — same inputs always produce same output.
 */
export function computeReputationMetrics(
  reputationRecords: RecipientReputationRecord[],
  _bounceEvents: BounceEventEntity[],
  _complaintEvents: ComplaintEventEntity[]
): ReputationMetrics {
  let totalActive = 0;
  let softBounce = 0;
  let hardBounce = 0;
  let complaint = 0;
  let softBounceEscalations = 0;

  for (let i = 0; i < reputationRecords.length; i++) {
    const record = reputationRecords[i];
    if (record.status === 'ACTIVE') totalActive++;
    else if (record.status === 'SOFT_BOUNCE') softBounce++;
    else if (record.status === 'HARD_BOUNCED') {
      hardBounce++;
      // If softBounceCount > 0, this was escalated from soft bounce
      if (record.softBounceCount > 0) softBounceEscalations++;
    } else if (record.status === 'COMPLAINT') complaint++;
  }

  const totalRecipients = reputationRecords.length;

  return {
    totalActiveRecipients: totalActive,
    softBounceCount: softBounce,
    hardBounceCount: hardBounce,
    complaintCount: complaint,
    softBounceEscalations,
    hardBounceRatePercent: safeIntegerPercent(hardBounce, totalRecipients),
    complaintRatePercent: safeIntegerPercent(complaint, totalRecipients),
  };
}

// ---------------------------------------------------------------------------
// 3. Compute Escalation Metrics
// ---------------------------------------------------------------------------

/**
 * Compute escalation activity metrics from decisions.
 *
 * Counts by reason and action.
 * All counts are integers.
 *
 * Deterministic — same inputs always produce same output.
 */
export function computeEscalationMetrics(
  decisions: EscalationDecision[]
): EscalationMetrics {
  let agenciesDue = 0;
  let agenciesBlocked = 0;
  let agenciesResponded = 0;
  let agenciesNotDue = 0;
  let followUp1Created = 0;
  let followUp2Created = 0;
  let annualUpdatesCreated = 0;

  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i];

    // Count by reason
    if (d.reason === 'DUE') agenciesDue++;
    else if (d.reason === 'BLOCKED') agenciesBlocked++;
    else if (d.reason === 'RESPONDED') agenciesResponded++;
    else if (d.reason === 'NOT_DUE') agenciesNotDue++;

    // Count by action
    if (d.action === 'CREATE_FOLLOW_UP_1') followUp1Created++;
    else if (d.action === 'CREATE_FOLLOW_UP_2') followUp2Created++;
    else if (d.action === 'CREATE_ANNUAL_UPDATE') annualUpdatesCreated++;
  }

  return {
    totalAgencies: decisions.length,
    agenciesDue,
    agenciesBlocked,
    agenciesResponded,
    agenciesNotDue,
    followUp1Created,
    followUp2Created,
    annualUpdatesCreated,
  };
}

// ---------------------------------------------------------------------------
// 4. Compute Queue Metrics
// ---------------------------------------------------------------------------

/**
 * Extract YYYY-MM-DD date portion from an ISO 8601 timestamp.
 *
 * Forward scan: takes first 10 characters (YYYY-MM-DD).
 * Returns empty string if timestamp is too short.
 * No regex. No Date constructor. No localeCompare.
 */
function extractDatePortion(timestamp: string): string {
  if (timestamp.length < 10) return '';
  return timestamp.substring(0, 10);
}

/**
 * Compute send queue metrics.
 *
 * "Today" is determined by comparing the date portion of entry timestamps
 * against the caller-provided currentDate string (YYYY-MM-DD).
 *
 * backlogSize: QUEUED entries whose scheduledTimestamp date < currentDate.
 *
 * Date comparison uses ASCII string comparison (YYYY-MM-DD format is
 * lexicographically orderable).
 *
 * Deterministic — same inputs always produce same output.
 */
export function computeQueueMetrics(
  queueEntries: SendQueueEntry[],
  currentDate: string
): QueueMetrics {
  let totalQueued = 0;
  let totalDispatchedToday = 0;
  let totalFailedToday = 0;
  let totalThrottledToday = 0;
  let backlogSize = 0;

  for (let i = 0; i < queueEntries.length; i++) {
    const entry = queueEntries[i];

    if (entry.sendStatus === 'QUEUED') {
      totalQueued++;
      // Backlog: QUEUED entries with scheduledTimestamp date before today
      const entryDate = extractDatePortion(entry.scheduledTimestamp);
      if (entryDate < currentDate) {
        backlogSize++;
      }
    } else if (entry.sendStatus === 'DISPATCHED') {
      // Count if dispatched today
      const entryDate = extractDatePortion(entry.scheduledTimestamp);
      if (entryDate === currentDate) {
        totalDispatchedToday++;
      }
    } else if (entry.sendStatus === 'FAILED') {
      const entryDate = extractDatePortion(entry.scheduledTimestamp);
      if (entryDate === currentDate) {
        totalFailedToday++;
      }
    } else if (entry.sendStatus === 'THROTTLED') {
      const entryDate = extractDatePortion(entry.scheduledTimestamp);
      if (entryDate === currentDate) {
        totalThrottledToday++;
      }
    }
  }

  return {
    totalQueued,
    totalDispatchedToday,
    totalFailedToday,
    totalThrottledToday,
    backlogSize,
  };
}

// ---------------------------------------------------------------------------
// 5. Build Daily Operational Snapshot
// ---------------------------------------------------------------------------

/**
 * Aggregate all metric blocks into a DailyOperationalSnapshot.
 *
 * No mutation. No side effects. No dispatch. No escalation.
 * Pure aggregation only.
 *
 * Deterministic — same inputs always produce same output.
 */
export function buildDailyOperationalSnapshot(
  tenantId: string,
  snapshotDate: string,
  generatedTimestamp: string,
  warmup: WarmupUtilizationMetrics,
  reputation: ReputationMetrics,
  escalation: EscalationMetrics,
  queue: QueueMetrics,
  integrity: IntegrityMetrics
): DailyOperationalSnapshot {
  return {
    tenantId,
    snapshotDate,
    generatedTimestamp,
    warmup,
    reputation,
    escalation,
    queue,
    integrity,
  };
}
