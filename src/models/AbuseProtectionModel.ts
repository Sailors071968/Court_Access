// ============================================
// Court Access — Abuse Protection Model (Phase 24)
// Abuse & Resource Protection Hardening Layer
//
// Prevents computational abuse and scraping.
// Deterministic rate limiting per tenant.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Rate Limit Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for rate limiting per tenant.
 *
 * Deterministic counters. No probabilistic throttling.
 */
export interface RateLimitConfig {
  maxUploadsPerHour: number;
  maxQueriesPerHour: number;
  maxTranscriptionMinutesPerDay: number;
}

// ---------------------------------------------------------------------------
// Rate Limit Status — per resource type
// ---------------------------------------------------------------------------

/**
 * Current rate limit status for a tenant.
 *
 * Counts only. Binary PASS/FAIL per limit.
 */
export interface RateLimitStatus {
  tenantId: string;
  currentUploads: number;
  maxUploadsPerHour: number;
  uploadStatus: 'PASS' | 'FAIL';
  currentQueries: number;
  maxQueriesPerHour: number;
  queryStatus: 'PASS' | 'FAIL';
  currentTranscriptionMinutes: number;
  maxTranscriptionMinutesPerDay: number;
  transcriptionStatus: 'PASS' | 'FAIL';
  overallStatus: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Rate Limit Event — immutable log entry
// ---------------------------------------------------------------------------

/**
 * Immutable record of a rate limit check event.
 *
 * Append-only. No deletion.
 */
export interface RateLimitEvent {
  tenantId: string;
  resourceType: 'UPLOAD' | 'QUERY' | 'TRANSCRIPTION';
  currentCount: number;
  maxAllowed: number;
  status: 'PASS' | 'FAIL';
  checkedTimestamp: string;        // ISO 8601, caller-provided
}
