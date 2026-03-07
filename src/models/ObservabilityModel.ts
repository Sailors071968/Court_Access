// ============================================
// Court Access — Observability Model (Phase 17: Monitoring)
// Structured logging, error tracking, and operational metrics.
// ============================================

// ---------------------------------------------------------------------------
// Log Levels
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ---------------------------------------------------------------------------
// Structured Log Entry
// ---------------------------------------------------------------------------

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  tenantId: string | null;
  userId: string | null;
  traceId: string | null;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error Report
// ---------------------------------------------------------------------------

export interface ErrorReport {
  errorId: string;
  timestamp: string;
  message: string;
  stack: string | null;
  service: string;
  tenantId: string | null;
  userId: string | null;
  url: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  resolved: boolean;
  resolvedAt: string | null;
}

// ---------------------------------------------------------------------------
// System Metric
// ---------------------------------------------------------------------------

export type MetricType =
  | 'upload_count'
  | 'upload_bytes'
  | 'processing_job_count'
  | 'processing_job_duration_ms'
  | 'search_query_count'
  | 'search_latency_ms'
  | 'api_request_count'
  | 'api_latency_ms'
  | 'error_count'
  | 'active_users';

export interface SystemMetric {
  metricType: MetricType;
  value: number;
  timestamp: string;
  tags: Record<string, string>;
}

// ---------------------------------------------------------------------------
// System Health
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface SystemHealth {
  overall: HealthStatus;
  services: ServiceHealth[];
  lastChecked: string;
}

export interface ServiceHealth {
  serviceName: string;
  status: HealthStatus;
  latencyMs: number | null;
  errorRate: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

// ---------------------------------------------------------------------------
// Processing Backlog
// ---------------------------------------------------------------------------

export interface ProcessingBacklog {
  totalPending: number;
  totalActive: number;
  totalFailed: number;
  oldestPendingAge: string | null;
  byType: Record<string, { pending: number; active: number; failed: number }>;
}

// ---------------------------------------------------------------------------
// Analytics Event (PostHog-compatible)
// ---------------------------------------------------------------------------

export type AnalyticsEventType =
  | 'evidence_uploaded'
  | 'evidence_processed'
  | 'evidence_viewed'
  | 'search_performed'
  | 'timeline_viewed'
  | 'graph_viewed'
  | 'case_created'
  | 'case_shared'
  | 'annotation_created'
  | 'comment_posted'
  | 'dashboard_interaction'
  | 'export_generated'
  | 'integrity_verified';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  userId: string;
  tenantId: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Warning',
  error: 'Error',
  fatal: 'Fatal',
};

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  upload_count: 'Uploads',
  upload_bytes: 'Upload Volume',
  processing_job_count: 'Processing Jobs',
  processing_job_duration_ms: 'Processing Duration',
  search_query_count: 'Search Queries',
  search_latency_ms: 'Search Latency',
  api_request_count: 'API Requests',
  api_latency_ms: 'API Latency',
  error_count: 'Errors',
  active_users: 'Active Users',
};

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
};
