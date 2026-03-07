// ============================================
// Court Access — Fact Pipeline Performance Service
// Phase P: Monitor and optimize fact processing performance
// ============================================

import prisma from './prismaClient.js';

const FACT_PERFORMANCE_THRESHOLDS = {
  fact_registration: { warn: 500, critical: 2000 },
  fact_deduplication: { warn: 5000, critical: 15000 },
  fact_corroboration: { warn: 8000, critical: 25000 },
  fact_reasoning: { warn: 10000, critical: 30000 },
  graph_integration: { warn: 12000, critical: 35000 },
  logic_query: { warn: 3000, critical: 10000 },
  output_validation: { warn: 5000, critical: 15000 },
  dual_analysis: { warn: 30000, critical: 90000 },
};

/**
 * Record a fact pipeline performance metric.
 * @param {string} caseId
 * @param {string} operation
 * @param {number} durationMs
 * @param {object} [details]
 * @returns {object} Metric record
 */
export async function recordFactPerformance(caseId, operation, durationMs, details = {}) {
  const threshold = FACT_PERFORMANCE_THRESHOLDS[operation] || { warn: 5000, critical: 15000 };
  let status = 'normal';
  if (durationMs >= threshold.critical) status = 'critical';
  else if (durationMs >= threshold.warn) status = 'warning';

  const metric = await prisma.factPerformanceMetric.create({
    data: {
      caseId,
      operation,
      durationMs,
      status,
      itemsProcessed: details.itemsProcessed || 0,
      throughput: details.itemsProcessed && durationMs > 0
        ? Math.round((details.itemsProcessed / (durationMs / 1000)) * 100) / 100
        : 0,
      metadata: {
        ...details,
        recordedAt: new Date().toISOString(),
      },
    },
  });

  if (status !== 'normal') {
    console.warn(`[FactPerf] ${status.toUpperCase()}: ${operation} took ${durationMs}ms for case ${caseId}`);
  }

  return metric;
}

/**
 * Get fact pipeline performance summary.
 * @param {string} caseId
 * @returns {object} Performance summary
 */
export async function getFactPerformanceSummary(caseId) {
  const metrics = await prisma.factPerformanceMetric.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const byOperation = {};
  for (const metric of metrics) {
    if (!byOperation[metric.operation]) {
      byOperation[metric.operation] = {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
        warnings: 0,
        criticals: 0,
        avgThroughput: 0,
        totalItems: 0,
      };
    }
    const op = byOperation[metric.operation];
    op.count++;
    op.totalDuration += metric.durationMs;
    op.maxDuration = Math.max(op.maxDuration, metric.durationMs);
    op.minDuration = Math.min(op.minDuration, metric.durationMs);
    op.totalItems += metric.itemsProcessed;
    if (metric.status === 'warning') op.warnings++;
    if (metric.status === 'critical') op.criticals++;
  }

  for (const [, op] of Object.entries(byOperation)) {
    op.avgDuration = op.count > 0 ? Math.round(op.totalDuration / op.count) : 0;
    op.avgThroughput = op.count > 0 && op.totalDuration > 0
      ? Math.round((op.totalItems / (op.totalDuration / 1000)) * 100) / 100
      : 0;
    if (op.minDuration === Infinity) op.minDuration = 0;
  }

  const overallHealth = Object.values(byOperation).some(op => op.criticals > 0) ? 'degraded'
    : Object.values(byOperation).some(op => op.warnings > 0) ? 'warning'
    : 'healthy';

  return {
    caseId,
    totalMetrics: metrics.length,
    byOperation,
    overallHealth,
    thresholds: FACT_PERFORMANCE_THRESHOLDS,
  };
}

/**
 * Time a fact pipeline operation.
 * @param {string} caseId
 * @param {string} operation
 * @param {Function} fn
 * @returns {*} Result of the function
 */
export async function timedFactOperation(caseId, operation, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    await recordFactPerformance(caseId, operation, duration, {
      success: true,
      itemsProcessed: result?.summary?.total || result?.length || 0,
    });
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    await recordFactPerformance(caseId, operation, duration, {
      success: false,
      error: err.message,
    });
    throw err;
  }
}
