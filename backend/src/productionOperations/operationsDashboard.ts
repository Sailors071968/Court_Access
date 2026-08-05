// ============================================================================
// Program 21 — Operations Dashboard Aggregator
// ============================================================================

import os from 'node:os';
import { runProductionGates } from '../productionGates/runProductionGates.js';
import { runDeepHealthCheck } from '../observability/deepHealthCheck.js';
import { getRedisMemorySnapshot } from '../observability/redisMemoryAlert.js';
import { getQueueHealth, QUEUE_NAMES } from '../lib/queues.js';
import { collectBillingReadinessMetrics } from '../billing/billingMetricsService.js';
import { collectProductionMetrics } from '../legislative/productionMetrics.js';
import { generateEngineeringDashboard } from '../legislative/engineeringDashboard.js';
import { metrics } from '../observability/metricsCollector.js';
import { evaluateOperationsAlerts } from './alertingService.js';
import type { ComponentHealth, HealthStatus, OperationsDashboard } from './types.js';
import type { ProductionGatesReport } from '../productionGates/types.js';

function mapComponent(status: string): HealthStatus {
  if (status === 'healthy' || status === 'PASS' || status === 'OPERATIONAL' || status === 'READY') return 'healthy';
  if (status === 'degraded' || status === 'PARTIAL' || status === 'INCOMPLETE' || status === 'NOT_READY') return 'degraded';
  if (status === 'unhealthy' || status === 'FAIL' || status === 'NOT_CONFIGURED') return 'unhealthy';
  return 'unknown';
}

function worstStatus(...statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.every((s) => s === 'unknown')) return 'unknown';
  if (statuses.includes('healthy')) return 'healthy';
  return 'unknown';
}

/**
 * Building this dashboard runs the full production-gate suite, which performs
 * transactional writes (the billing certification exercises credit balances).
 * Three admin endpoints call it, so two concurrent requests used to collide on
 * those writes and fail with Prisma P2034. Concurrent callers now share a
 * single in-flight computation, and the result is held briefly so that opening
 * the operations console does not re-run the whole suite per panel.
 */
const DASHBOARD_TTL_MS = parseInt(process.env.OPERATIONS_DASHBOARD_TTL_MS || '15000', 10);
let inFlight: Promise<OperationsDashboard> | null = null;
let cached: { at: number; value: OperationsDashboard } | null = null;

export async function buildOperationsDashboard(): Promise<OperationsDashboard> {
  if (cached && Date.now() - cached.at < DASHBOARD_TTL_MS) return cached.value;
  if (inFlight) return inFlight;

  inFlight = computeOperationsDashboard()
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

async function computeOperationsDashboard(): Promise<OperationsDashboard> {
  const [
    gatesReport,
    deepHealth,
    redisMemory,
    queueHealth,
    billingMetrics,
    productionMetrics,
    engineering,
  ] = await Promise.all([
    // The gate suite performs transactional writes as part of the billing
    // certification, so it can fail on a write conflict. That must degrade the
    // gates panel rather than fail the whole operations console, which is
    // exactly what an operator needs during an incident.
    runProductionGates().catch((err): ProductionGatesReport => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[OperationsDashboard] Production gates could not be evaluated:', message);
      return {
        generatedAt: new Date().toISOString(),
        version: 'unavailable',
        program: 'PRODUCTION_CERTIFICATION',
        overallResult: 'NOT_READY',
        deploymentBlocked: true,
        passCount: 0,
        failCount: 0,
        partialCount: 0,
        skipCount: 0,
        gates: [],
        blockers: ['Production gates could not be evaluated on this request; the rest of the dashboard is unaffected.'],
      };
    }),
    runDeepHealthCheck(),
    getRedisMemorySnapshot().catch(() => null),
    getQueueHealth().catch(() => ({} as Record<string, { waiting: number; active: number; completed: number; failed: number }>)),
    collectBillingReadinessMetrics(),
    collectProductionMetrics(),
    generateEngineeringDashboard().catch(() => null),
  ]);

  const metricsJson = metrics.toJSON() as Record<string, unknown>;
  const httpLatency = metricsJson.http_request_duration_ms as
    | { type: string; summaries: Record<string, { p50: number; p95: number }> }
    | undefined;
  const errorCounter = metricsJson.errors_total as { type: string; values: Record<string, number> } | undefined;
  const requestCounter = metricsJson.http_requests_total as { type: string; values: Record<string, number> } | undefined;

  const totalErrors = errorCounter ? Object.values(errorCounter.values).reduce((a, b) => a + b, 0) : 0;
  const totalRequests = requestCounter ? Object.values(requestCounter.values).reduce((a, b) => a + b, 0) : 0;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  let responseTimeP50Ms = 0;
  let responseTimeP95Ms = 0;
  if (httpLatency?.summaries) {
    const all = Object.values(httpLatency.summaries);
    if (all.length) {
      responseTimeP50Ms = Math.round(all.reduce((s, v) => s + v.p50, 0) / all.length);
      responseTimeP95Ms = Math.round(all.reduce((s, v) => s + v.p95, 0) / all.length);
    }
  }

  const totalFailedJobs = Object.values(queueHealth).reduce((sum, q) => sum + Math.max(0, q.failed), 0);
  const totalWaitingJobs = Object.values(queueHealth).reduce((sum, q) => sum + Math.max(0, q.waiting), 0);
  const ocrQueue = queueHealth.EVIDENCE_INGEST ?? { waiting: 0, active: 0, completed: 0, failed: 0 };
  const aiQueue = queueHealth.AI_ANALYSIS ?? { waiting: 0, active: 0, completed: 0, failed: 0 };

  const database: ComponentHealth = {
    status: mapComponent(deepHealth.components.postgres.status),
    latencyMs: deepHealth.components.postgres.latencyMs,
    message: deepHealth.components.postgres.message,
  };

  const redis: ComponentHealth = {
    status: redisMemory
      ? redisMemory.status === 'critical'
        ? 'unhealthy'
        : redisMemory.status === 'warn'
          ? 'degraded'
          : mapComponent(deepHealth.components.redis.status)
      : mapComponent(deepHealth.components.redis.status),
    message: redisMemory
      ? `memory ${redisMemory.usedMemoryMB}MB / ${redisMemory.maxMemoryMB || '∞'}MB (${Math.round(redisMemory.usagePct * 100)}%)`
      : deepHealth.components.redis.message,
    details: redisMemory ? { ...redisMemory } : undefined,
  };

  const queueStatus: HealthStatus =
    totalFailedJobs > 50 ? 'unhealthy' : totalFailedJobs > 10 || totalWaitingJobs > 100 ? 'degraded' : 'healthy';

  const legislativeStatus: HealthStatus =
    productionMetrics.sectionsParsed > 0 && productionMetrics.repositoryIntegrity === 'PASS'
      ? 'healthy'
      : productionMetrics.sectionsParsed > 0
        ? 'degraded'
        : 'unknown';

  const kgStatus: HealthStatus =
    (productionMetrics.repositories.offenses ?? 0) > 0 ? 'healthy' : productionMetrics.sectionsParsed > 0 ? 'degraded' : 'unknown';

  const stripeStatus: HealthStatus = mapComponent(billingMetrics.overallBillingIntegrity);
  const emailStatus: HealthStatus =
    billingMetrics.emailSync === 'NOT_IMPLEMENTED' ? 'degraded' : mapComponent(billingMetrics.overallBillingIntegrity);

  const memory = process.memoryUsage();
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memory.rss / 1024 / 1024);
  const heapPct = Math.round((memory.heapUsed / memory.heapTotal) * 100);
  const memoryStatus: HealthStatus = heapPct > 90 ? 'unhealthy' : heapPct > 75 ? 'degraded' : 'healthy';

  const cpuUsage = process.cpuUsage();
  const loadAvg = os.loadavg();
  const cpuStatus: HealthStatus = loadAvg[0] > os.cpus().length * 2 ? 'unhealthy' : loadAvg[0] > os.cpus().length ? 'degraded' : 'healthy';

  const storageStatus: HealthStatus = process.env.R2_BUCKET_NAME || process.env.R2_ACCOUNT_ID ? 'healthy' : 'degraded';

  const apiHealth: ComponentHealth = {
    status: worstStatus(mapComponent(deepHealth.status), errorRate > 0.05 ? 'unhealthy' : errorRate > 0.01 ? 'degraded' : 'healthy'),
    message: `errorRate=${(errorRate * 100).toFixed(2)}% p95=${responseTimeP95Ms}ms`,
  };

  const dashboard: OperationsDashboard = {
    generatedAt: new Date().toISOString(),
    overallStatus: worstStatus(
      mapComponent(deepHealth.status),
      gatesReport.deploymentBlocked ? 'degraded' : 'healthy',
      queueStatus,
      stripeStatus,
    ),
    productionGates: {
      overallResult: gatesReport.overallResult,
      passCount: gatesReport.passCount,
      failCount: gatesReport.failCount,
      partialCount: gatesReport.partialCount,
      deploymentBlocked: gatesReport.deploymentBlocked,
      gates: gatesReport.gates.map((g) => ({ id: g.id, name: g.name, result: g.result })),
    },
    systemHealth: { status: mapComponent(deepHealth.status), message: `uptime=${deepHealth.uptimeSeconds}s env=${deepHealth.environment}` },
    apiHealth,
    database,
    redis,
    queues: { status: queueStatus, queues: queueHealth, message: `${totalWaitingJobs} waiting, ${totalFailedJobs} failed` },
    ocrWorkers: {
      status: ocrQueue.failed > 10 ? 'degraded' : ocrQueue.waiting > 100 ? 'degraded' : 'healthy',
      message: `EVIDENCE_INGEST waiting=${ocrQueue.waiting} failed=${ocrQueue.failed}`,
    },
    aiWorkers: {
      status: aiQueue.failed > 10 ? 'degraded' : aiQueue.waiting > 50 ? 'degraded' : 'healthy',
      message: `AI_ANALYSIS waiting=${aiQueue.waiting} failed=${aiQueue.failed}`,
    },
    legislativePipeline: {
      status: legislativeStatus,
      message: `parsed=${productionMetrics.sectionsParsed} offenses=${productionMetrics.criminalOffenses}`,
    },
    knowledgeGraph: {
      status: kgStatus,
      message: `offenses=${productionMetrics.repositories.offenses ?? 0} elements=${productionMetrics.repositories.elements ?? 0}`,
    },
    repositoryIntegrity: {
      status: mapComponent(productionMetrics.repositoryIntegrity),
      message: `integrity=${productionMetrics.repositoryIntegrity}`,
    },
    stripeHealth: {
      status: stripeStatus,
      message: `integrity=${billingMetrics.overallBillingIntegrity} webhooks24h=${billingMetrics.webhookEventsLast24h}`,
    },
    emailHealth: {
      status: emailStatus,
      message: `emailSync=${billingMetrics.emailSync}`,
    },
    backgroundJobs: {
      status: queueStatus,
      message: `${Object.keys(queueHealth).length} queues monitored`,
    },
    storage: {
      status: storageStatus,
      message: process.env.R2_BUCKET_NAME ? `bucket=${process.env.R2_BUCKET_NAME}` : 'R2 not configured',
    },
    resources: {
      cpu: { userMicros: cpuUsage.user, systemMicros: cpuUsage.system, status: cpuStatus },
      memory: { heapUsedMB, heapTotalMB, rssMB, status: memoryStatus },
      disk: { status: 'unknown', message: 'Disk metrics require host agent' },
      network: { status: 'unknown', message: 'Network metrics require host agent' },
    },
    performance: { errorRate, responseTimeP50Ms, responseTimeP95Ms },
    alerts: [],
    observability: {
      productionGatesCoverage: Math.round((gatesReport.passCount / gatesReport.gates.length) * 100),
      repositoryCoveragePercent: productionMetrics.authorityCoveragePercent ?? 0,
      legislativeCoveragePercent: productionMetrics.californiaCodes.total
        ? Math.round((productionMetrics.californiaCodes.discovered / productionMetrics.californiaCodes.total) * 100)
        : 0,
      knowledgeGraphCoveragePercent: productionMetrics.calcrimCoveragePercent ?? 0,
      attorneyWorkflowCoveragePercent: engineering?.attorneyWorkflows.completionPercent ?? 0,
      systemAvailability: mapComponent(deepHealth.status),
      apiAvailability: apiHealth.status,
      billingAvailability: stripeStatus,
    },
  };

  dashboard.alerts = evaluateOperationsAlerts(dashboard, billingMetrics, productionMetrics);
  if (dashboard.alerts.some((a) => a.severity === 'critical')) {
    dashboard.overallStatus = worstStatus(dashboard.overallStatus, 'unhealthy');
  } else if (dashboard.alerts.some((a) => a.severity === 'warning')) {
    dashboard.overallStatus = worstStatus(dashboard.overallStatus, 'degraded');
  }

  return dashboard;
}

/** Adapter for legacy SystemHealthDashboard.tsx */
export async function buildSystemHealthAdapter(): Promise<Record<string, unknown>> {
  const dashboard = await buildOperationsDashboard();
  const queues = dashboard.queues.queues ?? {};

  const workerQueues = Object.entries(queues).map(([name, counts]) => ({
    name,
    active: counts.active,
    waiting: counts.waiting,
    completed: counts.completed,
    failed: counts.failed,
    concurrency: name === 'AI_ANALYSIS' || name === 'EVIDENCE_INGEST' ? 2 : 1,
  }));

  const ocr = queues.EVIDENCE_INGEST ?? { waiting: 0, active: 0, completed: 0, failed: 0 };

  return {
    apiLatency: [
      {
        endpoint: '/api/*',
        p50: dashboard.performance.responseTimeP50Ms,
        p95: dashboard.performance.responseTimeP95Ms,
        p99: dashboard.performance.responseTimeP95Ms,
        status: dashboard.apiHealth.status === 'healthy' ? 'healthy' : dashboard.apiHealth.status === 'degraded' ? 'degraded' : 'critical',
      },
    ],
    dbLatency: [
      {
        queryType: 'postgres ping',
        avgMs: dashboard.database.latencyMs ?? 0,
        maxMs: dashboard.database.latencyMs ?? 0,
        status: dashboard.database.status === 'healthy' ? 'healthy' : dashboard.database.status === 'degraded' ? 'degraded' : 'critical',
      },
    ],
    aiLatency: [
      {
        model: 'court-access-ai-analysis',
        avgMs: dashboard.performance.responseTimeP50Ms,
        tokensPerSec: 0,
        queueDepth: ocr.waiting + (queues.AI_ANALYSIS?.waiting ?? 0),
        status: dashboard.aiWorkers.status === 'healthy' ? 'healthy' : 'degraded',
      },
    ],
    crawlerStatus: {
      activeSessions: 0,
      domainsThrottled: 0,
      pagesVisitedToday: 0,
      robotsTxtCacheSize: 0,
      status: dashboard.legislativePipeline.status === 'healthy' ? 'active' : 'idle',
    },
    workerQueues,
    ocrBacklog: {
      pending: ocr.waiting,
      active: ocr.active,
      completedToday: ocr.completed,
      failedToday: ocr.failed,
      textractBudgetUsed: 0,
      textractBudgetLimit: 1000,
      primaryMethod: 'pdf-parse',
    },
    policyIngestion: {
      totalPolicies: dashboard.observability.legislativeCoveragePercent,
      ingestedToday: 0,
      pendingReview: 0,
      avgConfidenceScore: 0,
      belowThreshold: 0,
    },
    cpraCampaign: {
      totalAgencies: 0,
      requestsSent: 0,
      responsesReceived: 0,
      pendingFollowUp: 0,
      campaignStatus: 'not_started',
    },
    s3Storage: {
      totalObjects: 0,
      totalSizeGb: 0,
      bucketName: process.env.R2_BUCKET_NAME ?? 'courtaccess-evidence',
      recentUploads: 0,
      storageClass: 'STANDARD',
    },
    operationsDashboard: dashboard,
    lastRefreshed: dashboard.generatedAt,
  };
}

export { QUEUE_NAMES };
