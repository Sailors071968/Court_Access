// ============================================
// Court Access — Observability Service (Phase 17: Monitoring)
// Error tracking, structured logging, analytics, and system health monitoring.
//
// Integrations:
//   - Sentry-compatible error tracking
//   - PostHog-compatible analytics events
//   - Structured JSON logging
//   - System health aggregation
// ============================================

import type {
  LogEntry,
  LogLevel,
  ErrorReport,
  SystemMetric,
  MetricType,
  SystemHealth,
  ServiceHealth,
  HealthStatus,
  ProcessingBacklog,
  AnalyticsEvent,
  AnalyticsEventType,
} from '../models/ObservabilityModel';
import type { BackgroundJob } from '../models/BackgroundJobModel';

// ---------------------------------------------------------------------------
// Trace ID Generation
// ---------------------------------------------------------------------------

let traceCounter = 0;

function generateTraceId(): string {
  traceCounter++;
  return `trace-${Date.now()}-${traceCounter}`;
}

function generateErrorId(): string {
  return `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Structured Logging
// ---------------------------------------------------------------------------

const logBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER = 1000;

export function log(
  level: LogLevel,
  message: string,
  service: string,
  metadata: Record<string, unknown> = {},
  tenantId: string | null = null,
  userId: string | null = null
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service,
    tenantId,
    userId,
    traceId: generateTraceId(),
    metadata,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }

  return entry;
}

export function getRecentLogs(
  count: number = 100,
  levelFilter: LogLevel | null = null,
  serviceFilter: string | null = null
): LogEntry[] {
  let filtered = logBuffer;

  if (levelFilter) {
    const levelPriority: Record<LogLevel, number> = {
      debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
    };
    const minPriority = levelPriority[levelFilter];
    filtered = filtered.filter((e) => levelPriority[e.level] >= minPriority);
  }

  if (serviceFilter) {
    filtered = filtered.filter((e) => e.service === serviceFilter);
  }

  return filtered.slice(-count);
}

// ---------------------------------------------------------------------------
// Error Tracking (Sentry-compatible)
// ---------------------------------------------------------------------------

const errorReports: ErrorReport[] = [];
const MAX_ERROR_REPORTS = 500;

export function captureError(
  error: Error | string,
  service: string,
  metadata: Record<string, unknown> = {},
  tenantId: string | null = null,
  userId: string | null = null
): ErrorReport {
  const isError = error instanceof Error;
  const report: ErrorReport = {
    errorId: generateErrorId(),
    timestamp: new Date().toISOString(),
    message: isError ? error.message : error,
    stack: isError ? (error.stack ?? null) : null,
    service,
    tenantId,
    userId,
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    metadata,
    resolved: false,
    resolvedAt: null,
  };

  errorReports.push(report);
  if (errorReports.length > MAX_ERROR_REPORTS) {
    errorReports.shift();
  }

  // Also log as error
  log('error', report.message, service, { errorId: report.errorId, ...metadata }, tenantId, userId);

  return report;
}

export function getErrorReports(
  count: number = 50,
  unresolvedOnly: boolean = false
): ErrorReport[] {
  let filtered = errorReports;
  if (unresolvedOnly) {
    filtered = filtered.filter((e) => !e.resolved);
  }
  return filtered.slice(-count);
}

export function resolveError(errorId: string): ErrorReport | null {
  const report = errorReports.find((e) => e.errorId === errorId);
  if (!report) return null;
  report.resolved = true;
  report.resolvedAt = new Date().toISOString();
  return report;
}

// ---------------------------------------------------------------------------
// System Metrics
// ---------------------------------------------------------------------------

const metricsBuffer: SystemMetric[] = [];
const MAX_METRICS = 5000;

export function recordMetric(
  metricType: MetricType,
  value: number,
  tags: Record<string, string> = {}
): SystemMetric {
  const metric: SystemMetric = {
    metricType,
    value,
    timestamp: new Date().toISOString(),
    tags,
  };

  metricsBuffer.push(metric);
  if (metricsBuffer.length > MAX_METRICS) {
    metricsBuffer.shift();
  }

  return metric;
}

export function getMetrics(
  metricType: MetricType,
  sinceMinutes: number = 60
): SystemMetric[] {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  return metricsBuffer.filter(
    (m) => m.metricType === metricType && m.timestamp >= since
  );
}

// ---------------------------------------------------------------------------
// Analytics Events (PostHog-compatible)
// ---------------------------------------------------------------------------

const analyticsBuffer: AnalyticsEvent[] = [];
const MAX_ANALYTICS = 2000;

export function trackEvent(
  eventType: AnalyticsEventType,
  userId: string,
  tenantId: string,
  properties: Record<string, unknown> = {}
): AnalyticsEvent {
  const event: AnalyticsEvent = {
    eventType,
    userId,
    tenantId,
    timestamp: new Date().toISOString(),
    properties,
  };

  analyticsBuffer.push(event);
  if (analyticsBuffer.length > MAX_ANALYTICS) {
    analyticsBuffer.shift();
  }

  // In production: posthog.capture(eventType, { ...properties, userId, tenantId })
  return event;
}

export function getAnalyticsEvents(
  count: number = 100,
  eventTypeFilter: AnalyticsEventType | null = null
): AnalyticsEvent[] {
  let filtered = analyticsBuffer;
  if (eventTypeFilter) {
    filtered = filtered.filter((e) => e.eventType === eventTypeFilter);
  }
  return filtered.slice(-count);
}

// ---------------------------------------------------------------------------
// System Health
// ---------------------------------------------------------------------------

export function computeSystemHealth(
  services: ServiceHealth[]
): SystemHealth {
  let overall: HealthStatus = 'healthy';

  for (const svc of services) {
    if (svc.status === 'down') {
      overall = 'down';
      break;
    }
    if (svc.status === 'degraded') {
      overall = 'degraded';
    }
  }

  return {
    overall,
    services,
    lastChecked: new Date().toISOString(),
  };
}

export function evaluateServiceHealth(
  serviceName: string,
  errorRate: number,
  latencyMs: number | null,
  lastError: string | null,
  lastErrorAt: string | null
): ServiceHealth {
  let status: HealthStatus = 'healthy';

  if (errorRate > 0.1) {
    status = 'down';
  } else if (errorRate > 0.01 || (latencyMs !== null && latencyMs > 5000)) {
    status = 'degraded';
  }

  return {
    serviceName,
    status,
    latencyMs,
    errorRate,
    lastError,
    lastErrorAt,
  };
}

// ---------------------------------------------------------------------------
// Processing Backlog
// ---------------------------------------------------------------------------

export function computeProcessingBacklog(
  jobs: BackgroundJob[]
): ProcessingBacklog {
  const pending = jobs.filter((j) => j.status === 'queued');
  const active = jobs.filter((j) => j.status === 'active');
  const failed = jobs.filter((j) => j.status === 'failed');

  const byType: Record<string, { pending: number; active: number; failed: number }> = {};

  for (const job of jobs) {
    if (!byType[job.jobType]) {
      byType[job.jobType] = { pending: 0, active: 0, failed: 0 };
    }
    if (job.status === 'queued') byType[job.jobType].pending++;
    if (job.status === 'active') byType[job.jobType].active++;
    if (job.status === 'failed') byType[job.jobType].failed++;
  }

  let oldestPendingAge: string | null = null;
  if (pending.length > 0) {
    const sorted = [...pending].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    oldestPendingAge = sorted[0].createdAt;
  }

  return {
    totalPending: pending.length,
    totalActive: active.length,
    totalFailed: failed.length,
    oldestPendingAge,
    byType,
  };
}
