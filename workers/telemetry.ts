// ============================================
// Court Access — OpenTelemetry Instrumentation (Wave 1 Stabilization)
// Instruments critical pipeline stages with execution time, error count,
// throughput, and queue wait time metrics.
//
// Instrumented stages:
//   - Fact Extraction
//   - Evidence Ingestion
//   - Graph Queries
//   - Timeline Generation
//   - AI Reasoning
//   - Transcription
// ============================================

// ---------------------------------------------------------------------------
// Metric Types
// ---------------------------------------------------------------------------

export interface SpanMetric {
  /** Unique span identifier */
  spanId: string;
  /** Pipeline stage name */
  stage: PipelineStage;
  /** Operation name within the stage */
  operation: string;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds (null if still running) */
  endTime: number | null;
  /** Duration in milliseconds (null if still running) */
  durationMs: number | null;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if failed */
  error: string | null;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string | null;
  /** Additional metadata */
  attributes: Record<string, string | number | boolean>;
}

export type PipelineStage =
  | 'factExtraction'
  | 'evidenceIngestion'
  | 'graphQuery'
  | 'timelineGeneration'
  | 'aiReasoning'
  | 'transcription';

export interface StageMetrics {
  /** Total number of operations completed */
  totalOperations: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  errorCount: number;
  /** Average execution time in milliseconds */
  avgDurationMs: number;
  /** P95 execution time in milliseconds */
  p95DurationMs: number;
  /** P99 execution time in milliseconds */
  p99DurationMs: number;
  /** Maximum execution time observed */
  maxDurationMs: number;
  /** Operations per second (rolling 60s window) */
  throughputPerSec: number;
  /** Average queue wait time before execution starts */
  avgQueueWaitMs: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

export interface TelemetryReport {
  timestamp: string;
  stages: Record<PipelineStage, StageMetrics>;
  activeSpans: number;
  totalSpansRecorded: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_STAGES: PipelineStage[] = [
  'factExtraction',
  'evidenceIngestion',
  'graphQuery',
  'timelineGeneration',
  'aiReasoning',
  'transcription',
];

/** Maximum number of duration samples to retain per stage for percentile calculations */
const MAX_DURATION_SAMPLES = 1000;

/** Rolling throughput window in milliseconds */
const THROUGHPUT_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Telemetry State (module-scoped singleton)
// ---------------------------------------------------------------------------

/** Completed span durations per stage (for percentile calculations) */
const durationSamples: Map<PipelineStage, number[]> = new Map();

/** Queue wait times per stage */
const queueWaitSamples: Map<PipelineStage, number[]> = new Map();

/** Completion timestamps per stage (for throughput calculation) */
const completionTimestamps: Map<PipelineStage, number[]> = new Map();

/** Error counts per stage */
const errorCounts: Map<PipelineStage, number> = new Map();

/** Success counts per stage */
const successCounts: Map<PipelineStage, number> = new Map();

/** Currently active spans */
const activeSpans: Map<string, SpanMetric> = new Map();

/** Total spans ever recorded */
let totalSpansRecorded = 0;

/** Counter for generating span IDs */
let spanIdCounter = 0;

// Initialize all stages
for (const stage of ALL_STAGES) {
  durationSamples.set(stage, []);
  queueWaitSamples.set(stage, []);
  completionTimestamps.set(stage, []);
  errorCounts.set(stage, 0);
  successCounts.set(stage, 0);
}

// ---------------------------------------------------------------------------
// Span Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a new instrumentation span for a pipeline stage.
 * Returns the span ID that must be passed to `endSpan()` when the operation completes.
 */
export function startSpan(
  stage: PipelineStage,
  operation: string,
  options?: {
    tenantId?: string;
    queuedAt?: number;
    attributes?: Record<string, string | number | boolean>;
  },
): string {
  spanIdCounter++;
  const spanId = `span-${stage}-${spanIdCounter}-${Date.now()}`;

  const span: SpanMetric = {
    spanId,
    stage,
    operation,
    startTime: Date.now(),
    endTime: null,
    durationMs: null,
    success: true,
    error: null,
    tenantId: options?.tenantId ?? null,
    attributes: options?.attributes ?? {},
  };

  // Record queue wait time if queued timestamp provided
  if (options?.queuedAt) {
    const waitMs = span.startTime - options.queuedAt;
    const waits = queueWaitSamples.get(stage);
    if (waits) {
      waits.push(waitMs);
      if (waits.length > MAX_DURATION_SAMPLES) waits.shift();
    }
  }

  activeSpans.set(spanId, span);
  return spanId;
}

/**
 * End an active span, recording its duration and success/failure status.
 */
export function endSpan(
  spanId: string,
  options?: {
    success?: boolean;
    error?: string;
    attributes?: Record<string, string | number | boolean>;
  },
): SpanMetric | null {
  const span = activeSpans.get(spanId);
  if (!span) return null;

  span.endTime = Date.now();
  span.durationMs = span.endTime - span.startTime;
  span.success = options?.success ?? true;
  span.error = options?.error ?? null;

  if (options?.attributes) {
    Object.assign(span.attributes, options.attributes);
  }

  // Record metrics
  const durations = durationSamples.get(span.stage);
  if (durations) {
    durations.push(span.durationMs);
    if (durations.length > MAX_DURATION_SAMPLES) durations.shift();
  }

  const timestamps = completionTimestamps.get(span.stage);
  if (timestamps) {
    timestamps.push(span.endTime);
    // Prune old timestamps outside the throughput window
    const cutoff = span.endTime - THROUGHPUT_WINDOW_MS;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  if (span.success) {
    successCounts.set(span.stage, (successCounts.get(span.stage) ?? 0) + 1);
  } else {
    errorCounts.set(span.stage, (errorCounts.get(span.stage) ?? 0) + 1);
  }

  activeSpans.delete(spanId);
  totalSpansRecorded++;

  return span;
}

// ---------------------------------------------------------------------------
// Convenience: Instrument an async function
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with automatic span instrumentation.
 * Records execution time, success/failure, and throughput.
 *
 * Usage:
 *   const result = await instrument('factExtraction', 'extractFromDocument', async () => {
 *     return await extractFacts(document);
 *   });
 */
export async function instrument<T>(
  stage: PipelineStage,
  operation: string,
  fn: () => Promise<T>,
  options?: {
    tenantId?: string;
    queuedAt?: number;
    attributes?: Record<string, string | number | boolean>;
  },
): Promise<T> {
  const spanId = startSpan(stage, operation, options);
  try {
    const result = await fn();
    endSpan(spanId, { success: true });
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    endSpan(spanId, { success: false, error: errorMessage });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Percentile Calculations
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ---------------------------------------------------------------------------
// Metrics Retrieval
// ---------------------------------------------------------------------------

/**
 * Get metrics for a specific pipeline stage.
 */
export function getStageMetrics(stage: PipelineStage): StageMetrics {
  const durations = durationSamples.get(stage) ?? [];
  const waits = queueWaitSamples.get(stage) ?? [];
  const timestamps = completionTimestamps.get(stage) ?? [];
  const errors = errorCounts.get(stage) ?? 0;
  const successes = successCounts.get(stage) ?? 0;

  const sorted = [...durations].sort((a, b) => a - b);
  const avgDuration = sorted.length > 0
    ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
    : 0;

  const avgWait = waits.length > 0
    ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
    : 0;

  // Throughput: operations in the last 60s window
  const now = Date.now();
  const cutoff = now - THROUGHPUT_WINDOW_MS;
  const recentCompletions = timestamps.filter((t) => t >= cutoff).length;
  const throughput = Math.round((recentCompletions / (THROUGHPUT_WINDOW_MS / 1000)) * 100) / 100;

  return {
    totalOperations: successes + errors,
    successCount: successes,
    errorCount: errors,
    avgDurationMs: avgDuration,
    p95DurationMs: percentile(sorted, 95),
    p99DurationMs: percentile(sorted, 99),
    maxDurationMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    throughputPerSec: throughput,
    avgQueueWaitMs: avgWait,
    lastUpdated: now,
  };
}

/**
 * Get the full telemetry report for all pipeline stages.
 */
export function getTelemetryReport(): TelemetryReport {
  const stages = {} as Record<PipelineStage, StageMetrics>;

  for (const stage of ALL_STAGES) {
    stages[stage] = getStageMetrics(stage);
  }

  return {
    timestamp: new Date().toISOString(),
    stages,
    activeSpans: activeSpans.size,
    totalSpansRecorded,
  };
}

/**
 * Get all currently active spans (for debugging / admin visibility).
 */
export function getActiveSpans(): SpanMetric[] {
  return Array.from(activeSpans.values());
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

/**
 * Reset all telemetry state. Intended for testing only.
 */
export function resetTelemetry(): void {
  for (const stage of ALL_STAGES) {
    durationSamples.set(stage, []);
    queueWaitSamples.set(stage, []);
    completionTimestamps.set(stage, []);
    errorCounts.set(stage, 0);
    successCounts.set(stage, 0);
  }
  activeSpans.clear();
  totalSpansRecorded = 0;
  spanIdCounter = 0;
}
