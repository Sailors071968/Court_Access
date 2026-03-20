// ============================================
// Court Access — Observability Layer
// PR 6: Full Observability
// Public API barrel file
// ============================================

export { MetricsCollector, metrics } from './metricsCollector.ts';
export type { MetricLabels } from './metricsCollector.ts';

export { runDeepHealthCheck } from './deepHealthCheck.ts';
export type { HealthReport, ComponentHealth, ComponentStatus } from './deepHealthCheck.ts';

export { StructuredLogger, logger, setCorrelationId, getCorrelationId, clearCorrelationId } from './structuredLogger.ts';
export type { LogLevel, LogEntry, LoggerConfig } from './structuredLogger.ts';

export { registerObservabilityRoutes } from './observabilityRoutes.ts';
