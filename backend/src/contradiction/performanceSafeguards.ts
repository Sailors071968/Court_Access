// ============================================================================
// Large Case Performance Safeguards
// Batch processing, pagination, and index annotations for large-scale
// evidence workloads.
// ============================================================================

import type { ExtractedEvent, Contradiction, TimelineEvent } from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const PERFORMANCE_LIMITS = {
  /** Maximum events per timeline page. */
  TIMELINE_PAGE_SIZE: 1000,

  /** Maximum contradictions to analyze in one batch. */
  CONTRADICTION_BATCH_SIZE: 500,

  /** Maximum events to process in one extraction batch. */
  EXTRACTION_BATCH_SIZE: 200,

  /** Soft limit: warn if case exceeds this many events. */
  LARGE_CASE_THRESHOLD: 5000,

  /** Hard limit: refuse to process cases exceeding this. */
  MAX_CASE_EVENTS: 50_000,
} as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Paginate a timeline for large cases.
 * Default page size: 1000 events per page.
 */
export function paginateTimeline(
  timeline: TimelineEvent[],
  page = 1,
  pageSize: number = PERFORMANCE_LIMITS.TIMELINE_PAGE_SIZE,
): PaginatedResult<TimelineEvent> {
  const totalItems = timeline.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);

  return {
    items: timeline.slice(startIdx, endIdx),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

/**
 * Paginate contradictions for large cases.
 */
export function paginateContradictions(
  contradictions: Contradiction[],
  page = 1,
  pageSize: number = PERFORMANCE_LIMITS.CONTRADICTION_BATCH_SIZE,
): PaginatedResult<Contradiction> {
  const totalItems = contradictions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);

  return {
    items: contradictions.slice(startIdx, endIdx),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

/**
 * Split events into batches for processing.
 */
export function batchEvents(
  events: ExtractedEvent[],
  batchSize: number = PERFORMANCE_LIMITS.EXTRACTION_BATCH_SIZE,
): ExtractedEvent[][] {
  const batches: ExtractedEvent[][] = [];
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Split contradictions into batches for analysis.
 */
export function batchContradictions(
  contradictions: Contradiction[],
  batchSize: number = PERFORMANCE_LIMITS.CONTRADICTION_BATCH_SIZE,
): Contradiction[][] {
  const batches: Contradiction[][] = [];
  for (let i = 0; i < contradictions.length; i += batchSize) {
    batches.push(contradictions.slice(i, i + batchSize));
  }
  return batches;
}

// ---------------------------------------------------------------------------
// Case Size Validation
// ---------------------------------------------------------------------------

export interface CaseSizeCheck {
  eventCount: number;
  isLargeCase: boolean;
  exceedsHardLimit: boolean;
  recommendation: string;
}

/**
 * Check if a case exceeds performance thresholds.
 */
export function checkCaseSize(events: ExtractedEvent[]): CaseSizeCheck {
  const eventCount = events.length;
  const isLargeCase = eventCount > PERFORMANCE_LIMITS.LARGE_CASE_THRESHOLD;
  const exceedsHardLimit = eventCount > PERFORMANCE_LIMITS.MAX_CASE_EVENTS;

  let recommendation = 'Normal processing.';
  if (exceedsHardLimit) {
    recommendation = `Case has ${eventCount} events (exceeds hard limit of ${PERFORMANCE_LIMITS.MAX_CASE_EVENTS}). Batch processing required. Consider splitting into sub-cases.`;
  } else if (isLargeCase) {
    recommendation = `Large case detected (${eventCount} events). Batch processing and pagination recommended.`;
  }

  return { eventCount, isLargeCase, exceedsHardLimit, recommendation };
}

// ---------------------------------------------------------------------------
// Database Index Annotations
// Recommended indexes for production database deployment.
// ---------------------------------------------------------------------------

/**
 * SQL index creation statements for PostgreSQL/SQLite.
 * These should be applied to the production database schema.
 */
export const RECOMMENDED_INDEXES = [
  // Events table indexes
  'CREATE INDEX IF NOT EXISTS idx_events_case_id_timestamp ON events(case_id, timestamp);',
  'CREATE INDEX IF NOT EXISTS idx_events_case_id_event_type ON events(case_id, event_type);',
  'CREATE INDEX IF NOT EXISTS idx_events_source_evidence_id ON events(source_evidence_id);',
  'CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);',

  // Contradictions table indexes
  'CREATE INDEX IF NOT EXISTS idx_contradictions_case_id ON contradictions(case_id);',
  'CREATE INDEX IF NOT EXISTS idx_contradictions_case_id_type ON contradictions(case_id, contradiction_type);',
  'CREATE INDEX IF NOT EXISTS idx_contradictions_score ON contradictions(contradiction_score DESC);',
  'CREATE INDEX IF NOT EXISTS idx_contradictions_confidence ON contradictions(confidence DESC);',

  // Timeline table indexes
  'CREATE INDEX IF NOT EXISTS idx_timeline_case_id ON timeline_events(case_id);',
  'CREATE INDEX IF NOT EXISTS idx_timeline_canonical_ts ON timeline_events(canonical_timestamp);',

  // Doctrine matches indexes
  'CREATE INDEX IF NOT EXISTS idx_doctrine_matches_contradiction_id ON doctrine_matches(contradiction_id);',
  'CREATE INDEX IF NOT EXISTS idx_doctrine_matches_rule_id ON doctrine_matches(doctrine_rule_id);',
] as const;

/**
 * Neo4j index creation statements for graph database.
 */
export const RECOMMENDED_NEO4J_INDEXES = [
  'CREATE INDEX event_case_id IF NOT EXISTS FOR (n:Event) ON (n.caseId);',
  'CREATE INDEX event_timestamp IF NOT EXISTS FOR (n:Event) ON (n.timestamp);',
  'CREATE INDEX contradiction_case_id IF NOT EXISTS FOR (n:Contradiction) ON (n.caseId);',
  'CREATE INDEX evidence_id IF NOT EXISTS FOR (n:Evidence) ON (n.nodeId);',
  'CREATE INDEX actor_label IF NOT EXISTS FOR (n:Officer) ON (n.label);',
] as const;
