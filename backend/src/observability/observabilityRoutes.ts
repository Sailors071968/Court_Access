// ============================================================================
// PR 6 — Observability Layer: Routes
//
// Registers observability endpoints on the Fastify server:
//   GET /api/health/deep      — Deep health check (all dependencies)
//   GET /api/metrics           — Prometheus exposition format
//   GET /api/metrics/json      — JSON metrics summary
//
// These endpoints are unauthenticated by design (for load balancers,
// monitoring agents, and Prometheus scrapers). Sensitive data is NOT
// exposed — only aggregate counts, latencies, and connection statuses.
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { runDeepHealthCheck, runReadinessCheck } from './deepHealthCheck.ts';
import { metrics } from './metricsCollector.ts';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerObservabilityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/health/deep
   * Deep health check — verifies connectivity to Postgres, Redis, Neo4j,
   * and checks memory usage. Returns structured JSON report.
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
   * GET /api/health/ready
   * Readiness — should this instance receive traffic?
   *
   * Checks only what serving a request needs: the database, a writable upload
   * directory, and disk headroom. Redis, Neo4j and OpenAI are excluded because
   * a request can be served without them, and taking an instance out of
   * rotation for an optional dependency causes an outage rather than
   * preventing one.
   *
   * Degraded still returns 200: an instance low on disk is worse than a healthy
   * one and better than no instance at all.
   *
   * Response codes:
   *   200 — healthy or degraded, safe to route traffic here
   *   503 — unhealthy, do not route traffic here
   */
  app.get('/api/health/ready', async (_request, reply) => {
    const report = await runReadinessCheck();
    return reply.status(report.status === 'unhealthy' ? 503 : 200).send(report);
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

  console.log('[Observability] Routes registered: /api/health/deep, /api/metrics, /api/metrics/json');
}
