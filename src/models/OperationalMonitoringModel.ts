// ============================================
// Court Access — Operational Monitoring Model (Phase O4)
// Deterministic Integrity + Reputation + Throughput Observability
//
// Defines strictly typed snapshot structures for:
//   - Warm-up utilization metrics
//   - Reputation metrics
//   - Escalation metrics
//   - Queue metrics
//   - Integrity metrics (Phases 15–20)
//   - Daily operational snapshot (per tenant)
//
// This is a reporting model only.
// No dispatch. No escalation. No mutation. No crypto modification.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from sibling models
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
//   - All percentages integer-only (Math.floor)
// ============================================

// ---------------------------------------------------------------------------
// Warm-Up Utilization Metrics
// ---------------------------------------------------------------------------

/**
 * Warm-up utilization metrics for a single tenant.
 *
 * All percentages are deterministic integer floor:
 *   Math.floor((value / total) * 100)
 * Bounded at 100.
 * No floating decimals.
 */
export interface WarmupUtilizationMetrics {
  currentTierWeek: number;               // 1, 2, 3, or 4
  maxPerDay: number;                     // Current tier daily limit
  maxPerHour: number;                    // Current tier hourly limit
  todaysDispatchCount: number;           // Sends dispatched today
  currentHourDispatchCount: number;      // Sends dispatched this hour
  dailyUtilizationPercent: number;       // Deterministic integer floor
  hourlyUtilizationPercent: number;      // Deterministic integer floor
  gateStatus: 'PASS' | 'FAIL';          // Current warmup gate status
}

// ---------------------------------------------------------------------------
// Reputation Metrics
// ---------------------------------------------------------------------------

/**
 * Reputation metrics for a single tenant.
 *
 * All counts are integers.
 * Rates use Math.floor((value / total) * 100).
 * If total = 0, rates = 0 (safe division).
 */
export interface ReputationMetrics {
  totalActiveRecipients: number;         // Recipients with status ACTIVE
  softBounceCount: number;               // Recipients with status SOFT_BOUNCE
  hardBounceCount: number;               // Recipients with status HARD_BOUNCED
  complaintCount: number;                // Recipients with status COMPLAINT
  softBounceEscalations: number;         // Soft bounces escalated to HARD_BOUNCED
  hardBounceRatePercent: number;         // Math.floor((hardBounce / total) * 100)
  complaintRatePercent: number;          // Math.floor((complaint / total) * 100)
}

// ---------------------------------------------------------------------------
// Escalation Metrics
// ---------------------------------------------------------------------------

/**
 * Escalation activity metrics for a single tenant.
 *
 * Counts from EscalationDecision[] produced by the escalation runner.
 * All counts are integers.
 */
export interface EscalationMetrics {
  totalAgencies: number;                 // Total agencies evaluated
  agenciesDue: number;                   // Agencies with reason DUE
  agenciesBlocked: number;               // Agencies with reason BLOCKED
  agenciesResponded: number;             // Agencies with reason RESPONDED
  agenciesNotDue: number;                // Agencies with reason NOT_DUE
  followUp1Created: number;              // Actions = CREATE_FOLLOW_UP_1
  followUp2Created: number;              // Actions = CREATE_FOLLOW_UP_2
  annualUpdatesCreated: number;          // Actions = CREATE_ANNUAL_UPDATE
}

// ---------------------------------------------------------------------------
// Queue Metrics
// ---------------------------------------------------------------------------

/**
 * Send queue metrics for a single tenant.
 *
 * "Today" is determined by comparing entry timestamps against
 * the caller-provided currentDate string (YYYY-MM-DD).
 * All counts are integers.
 */
export interface QueueMetrics {
  totalQueued: number;                   // Entries with sendStatus QUEUED
  totalDispatchedToday: number;          // Entries dispatched today
  totalFailedToday: number;              // Entries failed today
  totalThrottledToday: number;           // Entries throttled today
  backlogSize: number;                   // QUEUED entries older than today
}

// ---------------------------------------------------------------------------
// Integrity Metrics (Phases 15–20)
// ---------------------------------------------------------------------------

/**
 * Integrity verification results from Phases 15–20.
 *
 * Each field is a binary PASS/FAIL result from the corresponding
 * CI enforcement function. The monitoring engine does NOT re-run
 * crypto — it receives these results from the caller.
 */
export interface IntegrityMetrics {
  communicationChainStatus: 'PASS' | 'FAIL';
  referentialIntegrityStatus: 'PASS' | 'FAIL';
  tenantIsolationStatus: 'PASS' | 'FAIL';
  evidencePacketVerificationStatus: 'PASS' | 'FAIL';
  anchorBindingStatus: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Daily Operational Snapshot
// ---------------------------------------------------------------------------

/**
 * A complete daily operational snapshot for a single tenant.
 *
 * Deterministic:
 *   - Same inputs always produce same snapshot
 *   - generatedTimestamp is caller-provided (no Date.now)
 *   - snapshotDate is caller-provided (YYYY-MM-DD)
 *   - All metric blocks are pure aggregation results
 *
 * This is read-only. No side effects. No dispatch. No mutation.
 */
export interface DailyOperationalSnapshot {
  tenantId: string;
  snapshotDate: string;                  // YYYY-MM-DD, caller-provided
  generatedTimestamp: string;            // ISO 8601, caller-provided
  warmup: WarmupUtilizationMetrics;
  reputation: ReputationMetrics;
  escalation: EscalationMetrics;
  queue: QueueMetrics;
  integrity: IntegrityMetrics;
}

// ---------------------------------------------------------------------------
// Monitoring Snapshot Entity — immutable dual-hashed snapshot record
// ---------------------------------------------------------------------------

/**
 * An immutable, dual-hashed monitoring snapshot entity.
 *
 * Two-pass derivation:
 *   Pass 1: pre-ID canonical (excludes snapshotId, sha256, sha3_256) → snapshotId
 *   Pass 2: full canonical (includes snapshotId, excludes sha256, sha3_256) → dual-hash
 *
 * Allows anchoring of monitoring history.
 * Append-only — no update, no delete.
 */
export interface MonitoringSnapshotEntity {
  snapshotId: string;                    // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  snapshotDate: string;                  // YYYY-MM-DD
  snapshotHash: string;                  // SHA-256 of canonical snapshot JSON
  sha256: string;                        // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                      // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Monitoring Snapshot Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new monitoring snapshot entity.
 *
 * The caller provides all fields except:
 *   - snapshotId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface MonitoringSnapshotInput {
  tenantId: string;
  snapshotDate: string;
  snapshotHash: string;
}

// ---------------------------------------------------------------------------
// Warmup Metrics Input — what the caller passes in
// ---------------------------------------------------------------------------

/**
 * Input for computing warmup utilization metrics.
 * All values are caller-provided.
 */
export interface WarmupMetricsInput {
  currentTimestamp: string;              // ISO 8601
  warmupStartDate: string;              // ISO 8601
  todaysDispatchCount: number;
  currentHourDispatchCount: number;
}
