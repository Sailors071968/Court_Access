// ============================================
// Court Access — Abuse Protection Engine (Phase 24)
// Abuse & Resource Protection Hardening Layer
//
// Prevents computational abuse and scraping.
// Deterministic rate limiting per tenant.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
//
// Architectural boundary:
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  RateLimitConfig,
  RateLimitStatus,
  RateLimitEvent,
} from '../models/AbuseProtectionModel';

// ---------------------------------------------------------------------------
// Evaluate Upload Rate Limit
// ---------------------------------------------------------------------------

/**
 * Evaluate upload rate limit for a tenant.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function evaluateUploadRateLimit(
  currentUploads: number,
  maxUploadsPerHour: number
): 'PASS' | 'FAIL' {
  return currentUploads < maxUploadsPerHour ? 'PASS' : 'FAIL';
}

// ---------------------------------------------------------------------------
// Evaluate Query Rate Limit
// ---------------------------------------------------------------------------

/**
 * Evaluate query rate limit for a tenant.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function evaluateQueryRateLimit(
  currentQueries: number,
  maxQueriesPerHour: number
): 'PASS' | 'FAIL' {
  return currentQueries < maxQueriesPerHour ? 'PASS' : 'FAIL';
}

// ---------------------------------------------------------------------------
// Evaluate Transcription Rate Limit
// ---------------------------------------------------------------------------

/**
 * Evaluate transcription rate limit for a tenant.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function evaluateTranscriptionRateLimit(
  currentMinutes: number,
  maxMinutesPerDay: number
): 'PASS' | 'FAIL' {
  return currentMinutes < maxMinutesPerDay ? 'PASS' : 'FAIL';
}

// ---------------------------------------------------------------------------
// Build Rate Limit Status — full evaluation
// ---------------------------------------------------------------------------

/**
 * Build complete rate limit status for a tenant.
 *
 * Evaluates all three resource types.
 * Binary PASS/FAIL per resource + overall.
 * Deterministic — same inputs always produce same result.
 */
export function buildRateLimitStatus(
  tenantId: string,
  currentUploads: number,
  currentQueries: number,
  currentTranscriptionMinutes: number,
  config: RateLimitConfig
): RateLimitStatus {
  const uploadStatus = evaluateUploadRateLimit(currentUploads, config.maxUploadsPerHour);
  const queryStatus = evaluateQueryRateLimit(currentQueries, config.maxQueriesPerHour);
  const transcriptionStatus = evaluateTranscriptionRateLimit(
    currentTranscriptionMinutes,
    config.maxTranscriptionMinutesPerDay
  );

  const overallStatus =
    uploadStatus === 'PASS' &&
    queryStatus === 'PASS' &&
    transcriptionStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    tenantId,
    currentUploads,
    maxUploadsPerHour: config.maxUploadsPerHour,
    uploadStatus,
    currentQueries,
    maxQueriesPerHour: config.maxQueriesPerHour,
    queryStatus,
    currentTranscriptionMinutes,
    maxTranscriptionMinutesPerDay: config.maxTranscriptionMinutesPerDay,
    transcriptionStatus,
    overallStatus,
  };
}

// ---------------------------------------------------------------------------
// Build Rate Limit Event — immutable log entry
// ---------------------------------------------------------------------------

/**
 * Build an immutable rate limit check event.
 *
 * Append-only. No deletion.
 * Deterministic — same inputs always produce same result.
 */
export function buildRateLimitEvent(
  tenantId: string,
  resourceType: 'UPLOAD' | 'QUERY' | 'TRANSCRIPTION',
  currentCount: number,
  maxAllowed: number,
  checkedTimestamp: string
): RateLimitEvent {
  const status = currentCount < maxAllowed ? 'PASS' : 'FAIL';

  return {
    tenantId,
    resourceType,
    currentCount,
    maxAllowed,
    status,
    checkedTimestamp,
  };
}
