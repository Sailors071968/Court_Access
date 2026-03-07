// ============================================
// Court Access — Evidence Performance Engine
// Phase 147: Monitor and optimize evidence pipeline performance
// ============================================

import prisma from '../services/prismaClient.js';

const PERFORMANCE_THRESHOLDS = {
  factExtraction: { warn: 5000, critical: 15000 },
  correlation: { warn: 10000, critical: 30000 },
  timeline: { warn: 8000, critical: 20000 },
  graphEnrichment: { warn: 15000, critical: 45000 },
  narrativeGeneration: { warn: 20000, critical: 60000 },
};

/**
 * Record a pipeline performance metric.
 * @param {string} caseId
 * @param {string} operation
 * @param {number} durationMs
 * @param {object} [details]
 * @returns {object} PerformanceMetric record
 */
export async function recordPerformanceMetric(caseId, operation, durationMs, details = {}) {
  const threshold = PERFORMANCE_THRESHOLDS[operation] || { warn: 10000, critical: 30000 };
  let status = 'normal';
  if (durationMs >= threshold.critical) status = 'critical';
  else if (durationMs >= threshold.warn) status = 'warning';

  const metric = await prisma.evidencePerformanceMetric.create({
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
    console.warn(`[EvidencePerf] ${status.toUpperCase()}: ${operation} took ${durationMs}ms for case ${caseId}`);
  }

  return metric;
}

/**
 * Get performance summary for a case.
 * @param {string} caseId
 * @returns {object} Performance summary
 */
export async function getCasePerformanceSummary(caseId) {
  const metrics = await prisma.evidencePerformanceMetric.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 100,
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
      };
    }
    const op = byOperation[metric.operation];
    op.count++;
    op.totalDuration += metric.durationMs;
    op.maxDuration = Math.max(op.maxDuration, metric.durationMs);
    op.minDuration = Math.min(op.minDuration, metric.durationMs);
    if (metric.status === 'warning') op.warnings++;
    if (metric.status === 'critical') op.criticals++;
  }

  for (const [key, op] of Object.entries(byOperation)) {
    op.avgDuration = op.count > 0 ? Math.round(op.totalDuration / op.count) : 0;
    if (op.minDuration === Infinity) op.minDuration = 0;
  }

  return {
    caseId,
    totalMetrics: metrics.length,
    byOperation,
    overallHealth: metrics.some(m => m.status === 'critical') ? 'degraded'
      : metrics.some(m => m.status === 'warning') ? 'warning'
      : 'healthy',
  };
}

/**
 * Time a function execution and record the metric.
 * @param {string} caseId
 * @param {string} operation
 * @param {Function} fn
 * @returns {*} Result of the function
 */
export async function timedExecution(caseId, operation, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    await recordPerformanceMetric(caseId, operation, duration, {
      success: true,
      itemsProcessed: result?.summary?.total || result?.length || 0,
    });
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    await recordPerformanceMetric(caseId, operation, duration, {
      success: false,
      error: err.message,
    });
    throw err;
  }
}
