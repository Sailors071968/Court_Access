// ============================================
// Court Access — Purge Service (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Deterministic purge policy enforcement.
// No silent deletion. Explicit purge records.
// Explicit expiration notices before purge.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - Consumes SubscriptionTierConfig and DocumentEntity only
//   - Appends to ledger
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No silent deletion
//   - Explicit purge records required
//   - Explicit expiration notices required
//   - Append-only ledger discipline
//   - ASCII comparator only
// ============================================

import type { SubscriptionTierId } from '../models/SubscriptionTierModel';
import { getSubscriptionTierById } from '../models/SubscriptionTierModel';
import type { LedgerEntryInput } from '../models/CreditLedgerModel';

// ---------------------------------------------------------------------------
// Purge Policy Constants
// ---------------------------------------------------------------------------

/**
 * Grace period in days for paid tiers before purge after expiration.
 * Integer constant. No floating point.
 */
const PAID_TIER_GRACE_DAYS = 30;

/**
 * Archive retention period in days for paid tiers.
 * Archives are retained for 2 years (730 days) after archival.
 * Integer constant. No floating point.
 */
const ARCHIVE_RETENTION_DAYS = 730;

// ---------------------------------------------------------------------------
// Retention Evaluation Result
// ---------------------------------------------------------------------------

/**
 * Result of evaluating a document's retention status.
 * Binary only: eligible for purge or not.
 * No scoring. No probability.
 */
export interface RetentionEvaluationResult {
  documentId: string;
  tenantId: string;
  tierId: SubscriptionTierId;
  retentionDays: number;
  daysSinceUpload: number;
  expired: boolean;
  archiveEligible: boolean;
  gracePeriodDays: number;
  purgeEligible: boolean;
}

// ---------------------------------------------------------------------------
// Purge Eligibility Check
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a document is eligible for purge.
 *
 * Retention rules (deterministic, no heuristics):
 *
 * FREE tier:
 *   - 90-day retention (from tier config)
 *   - No archive eligibility
 *   - PURGE_EVENT appended before deletion
 *   - No grace period
 *
 * Paid tiers (TIER_2 through TIER_7):
 *   - Retention days from tier config
 *   - 30-day grace period after expiration
 *   - Archive for 2 years (if tier is archiveEligible)
 *   - EXPIRATION_NOTICE_EVENT before purge
 *
 * daysSinceUpload is provided by the caller (deterministic input).
 * No Date.now(). No runtime timestamp computation.
 *
 * purgeEligible = true ONLY if:
 *   - Document has exceeded retention period + grace period
 *   - For paid tiers: grace period is PAID_TIER_GRACE_DAYS (30 days)
 *   - For FREE tier: grace period is 0 days
 *
 * This is a pure function — same input always produces same output.
 */
export function evaluateRetention(
  documentId: string,
  tenantId: string,
  tierId: SubscriptionTierId,
  daysSinceUpload: number
): RetentionEvaluationResult {
  const tier = getSubscriptionTierById(tierId);

  if (tier === null) {
    // Unknown tier — treat as expired with no archive
    return {
      documentId,
      tenantId,
      tierId,
      retentionDays: 0,
      daysSinceUpload,
      expired: true,
      archiveEligible: false,
      gracePeriodDays: 0,
      purgeEligible: true,
    };
  }

  const retentionDays = tier.retentionDays;
  const expired = daysSinceUpload > retentionDays;
  const archiveEligible = tier.archiveEligible;
  const gracePeriodDays = tier.id === 'FREE' ? 0 : PAID_TIER_GRACE_DAYS;
  const purgeEligible = daysSinceUpload > retentionDays + gracePeriodDays;

  return {
    documentId,
    tenantId,
    tierId,
    retentionDays,
    daysSinceUpload,
    expired,
    archiveEligible,
    gracePeriodDays,
    purgeEligible,
  };
}

// ---------------------------------------------------------------------------
// Expiration Notice Generation
// ---------------------------------------------------------------------------

/**
 * Generate an EXPIRATION_NOTICE_EVENT ledger input for a document
 * that is within its grace period (expired but not yet purge-eligible).
 *
 * This must be appended to the ledger BEFORE any purge operation.
 * No silent deletion is allowed.
 *
 * Only applicable to paid tiers (archiveEligible = true).
 * FREE tier documents go directly to PURGE_EVENT (no grace period).
 *
 * This is a pure function — same input always produces same output.
 */
export function buildExpirationNotice(
  evaluation: RetentionEvaluationResult,
  noticeTimestamp: string
): LedgerEntryInput {
  return {
    tenantId: evaluation.tenantId,
    eventType: 'EXPIRATION_NOTICE_EVENT',
    eventTimestamp: noticeTimestamp,
    creditAmount: 0,
    balanceAfter: 0,
    referenceId: evaluation.documentId,
    referenceType: 'document',
    description:
      `Expiration notice for document ${evaluation.documentId}. ` +
      `Tier: ${evaluation.tierId}. ` +
      `Retention: ${evaluation.retentionDays} days. ` +
      `Days since upload: ${evaluation.daysSinceUpload}. ` +
      `Grace period: ${evaluation.gracePeriodDays} days.`,
  };
}

// ---------------------------------------------------------------------------
// Purge Event Generation
// ---------------------------------------------------------------------------

/**
 * Generate a PURGE_EVENT ledger input for a document
 * that has exceeded retention + grace period.
 *
 * This must be appended to the ledger BEFORE actual deletion.
 * No silent deletion is allowed.
 *
 * The PURGE_EVENT is the explicit record of the purge decision.
 * Actual data removal happens AFTER the event is appended.
 *
 * This is a pure function — same input always produces same output.
 */
export function buildPurgeEvent(
  evaluation: RetentionEvaluationResult,
  purgeTimestamp: string
): LedgerEntryInput {
  return {
    tenantId: evaluation.tenantId,
    eventType: 'PURGE_EVENT',
    eventTimestamp: purgeTimestamp,
    creditAmount: 0,
    balanceAfter: 0,
    referenceId: evaluation.documentId,
    referenceType: 'document',
    description:
      `Purge executed for document ${evaluation.documentId}. ` +
      `Tier: ${evaluation.tierId}. ` +
      `Retention: ${evaluation.retentionDays} days. ` +
      `Days since upload: ${evaluation.daysSinceUpload}. ` +
      `Purge eligible: true.`,
  };
}

// ---------------------------------------------------------------------------
// Purge Pipeline — deterministic execution plan
// ---------------------------------------------------------------------------

/**
 * A single purge action in the execution plan.
 * Binary: either EXPIRATION_NOTICE or PURGE.
 */
export interface PurgeAction {
  documentId: string;
  actionType: 'EXPIRATION_NOTICE' | 'PURGE';
  ledgerInput: LedgerEntryInput;
}

/**
 * Build a deterministic purge execution plan for a set of documents.
 *
 * For each document:
 *   1. Evaluate retention status
 *   2. If expired but not purge-eligible (in grace period) → EXPIRATION_NOTICE
 *   3. If purge-eligible → PURGE (with preceding EXPIRATION_NOTICE for paid tiers)
 *   4. If not expired → no action
 *
 * Returns actions sorted by documentId (ASCII comparator).
 * No silent deletion. Every purge has an explicit ledger record.
 *
 * This is a pure function — same input always produces same output.
 */
export function buildPurgeExecutionPlan(
  documents: Array<{ documentId: string; daysSinceUpload: number }>,
  tenantId: string,
  tierId: SubscriptionTierId,
  actionTimestamp: string
): PurgeAction[] {
  const actions: PurgeAction[] = [];

  // Sort documents by documentId (ASCII comparator)
  const sorted = [...documents].sort(
    (a, b) => a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0
  );

  for (const doc of sorted) {
    const evaluation = evaluateRetention(
      doc.documentId,
      tenantId,
      tierId,
      doc.daysSinceUpload
    );

    if (evaluation.purgeEligible) {
      // For paid tiers, issue expiration notice before purge
      if (evaluation.archiveEligible) {
        actions.push({
          documentId: doc.documentId,
          actionType: 'EXPIRATION_NOTICE',
          ledgerInput: buildExpirationNotice(evaluation, actionTimestamp),
        });
      }
      actions.push({
        documentId: doc.documentId,
        actionType: 'PURGE',
        ledgerInput: buildPurgeEvent(evaluation, actionTimestamp),
      });
    } else if (evaluation.expired) {
      // In grace period — issue expiration notice only
      actions.push({
        documentId: doc.documentId,
        actionType: 'EXPIRATION_NOTICE',
        ledgerInput: buildExpirationNotice(evaluation, actionTimestamp),
      });
    }
    // If not expired → no action
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Archive Retention Check
// ---------------------------------------------------------------------------

/**
 * Check whether an archive has exceeded its retention period.
 *
 * Archives for paid tiers are retained for ARCHIVE_RETENTION_DAYS (730 days / 2 years).
 * daysSinceArchive is provided by the caller (deterministic input).
 *
 * Returns true if the archive should be purged.
 *
 * This is a pure function — same input always produces same output.
 */
export function isArchiveExpired(daysSinceArchive: number): boolean {
  return daysSinceArchive > ARCHIVE_RETENTION_DAYS;
}
