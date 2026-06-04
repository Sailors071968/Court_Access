// ============================================================================
// Observability Layer: Routes (Stage 1 Expansion)
//
// Registers observability endpoints on the Fastify server:
//   GET /api/health/deep      — Deep health check (all dependencies)
//   GET /api/metrics           — Prometheus exposition format
//   GET /api/metrics/json      — JSON metrics summary
//   GET /api/metrics/failures  — Failure visibility report
//
// These endpoints are unauthenticated by design (for load balancers,
// monitoring agents, and Prometheus scrapers). Sensitive data is NOT
// exposed — only aggregate counts, latencies, and connection statuses.
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { runDeepHealthCheck } from './deepHealthCheck.ts';
import { metrics } from './metricsCollector.ts';
import { failureVisibility } from './failureVisibility.ts';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerObservabilityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/health/deep
   * Deep health check — verifies connectivity to Postgres, Redis, Neo4j,
   * checks memory usage, disk space, OCR dependencies, and queue state.
   *
   * Response codes:
   *   200 — all components healthy
   *   503 — one or more components unhealthy
   */
  app.get('/api/health/deep', async (_request, reply) => {
    const report = await runDeepHealthCheck();
    const statusCode = report.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(report);
  });

  /**
   * GET /api/metrics
   * Prometheus-compatible metrics endpoint.
   * Returns text/plain in OpenMetrics exposition format.
   *
   * Intended for Prometheus scraping or Grafana Agent.
   */
  app.get('/api/metrics', async (_request, reply) => {
    const text = metrics.toPrometheusText();
    return reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .send(text);
  });

  /**
   * GET /api/metrics/json
   * JSON summary of all metrics. Easier to consume from dashboards
   * or admin UIs than the Prometheus format.
   */
  app.get('/api/metrics/json', async () => {
    return metrics.toJSON();
  });

  /**
   * GET /api/metrics/failures
   * Failure visibility report — aggregated failure metrics across
   * ingestion, OCR, queues, and identity subsystems.
   *
   * NO automatic remediation — visibility ONLY.
   */
  app.get('/api/metrics/failures', async () => {
    return failureVisibility.getReport();
  });

  console.log('[Observability] Routes registered: /api/health/deep, /api/metrics, /api/metrics/json, /api/metrics/failures');
}
