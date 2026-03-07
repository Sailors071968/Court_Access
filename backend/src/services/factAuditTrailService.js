// ============================================
// Court Access — Fact Audit Trail Service
// Phase N: Complete audit trail for all fact operations
// ============================================

import prisma from './prismaClient.js';

const FACT_AUDIT_ACTIONS = [
  'fact_registered', 'fact_verified', 'fact_disputed', 'fact_retracted',
  'fact_merged', 'fact_corroborated', 'fact_queried',
  'inference_generated', 'dedup_performed', 'reasoning_applied',
  'output_validated', 'neutrality_checked',
];

/**
 * Log a fact audit event.
 * @param {object} params
 * @returns {object} FactAuditLog record
 */
export async function logFactAuditEvent({ caseId, action, actor, factId, entityType, entityId, details = {} }) {
  if (!FACT_AUDIT_ACTIONS.includes(action)) {
    console.warn(`[FactAudit] Unknown audit action: ${action}`);
  }

  const record = await prisma.factAuditLog.create({
    data: {
      caseId,
      action,
      actor,
      factId: factId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      details,
      timestamp: new Date(),
    },
  });

  return record;
}

/**
 * Get fact audit trail for a case.
 * @param {string} caseId
 * @param {object} [filters]
 * @returns {object[]} Audit log entries
 */
export async function getFactAuditTrail(caseId, filters = {}) {
  const where = { caseId };
  if (filters.action) where.action = filters.action;
  if (filters.actor) where.actor = filters.actor;
  if (filters.factId) where.factId = filters.factId;
  if (filters.startDate) where.timestamp = { ...where.timestamp, gte: new Date(filters.startDate) };
  if (filters.endDate) where.timestamp = { ...where.timestamp, lte: new Date(filters.endDate) };

  return prisma.factAuditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: filters.limit || 500,
  });
}

/**
 * Get fact audit summary.
 * @param {string} caseId
 * @returns {object} Summary
 */
export async function getFactAuditSummary(caseId) {
  const logs = await prisma.factAuditLog.findMany({
    where: { caseId },
    orderBy: { timestamp: 'desc' },
  });

  const byAction = {};
  const byActor = {};
  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byActor[log.actor] = (byActor[log.actor] || 0) + 1;
  }

  return {
    caseId,
    totalEvents: logs.length,
    byAction,
    byActor,
    firstEvent: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    lastEvent: logs.length > 0 ? logs[0].timestamp : null,
  };
}

/**
 * Verify completeness of fact processing pipeline.
 * @param {string} caseId
 * @param {string} factId
 * @returns {object} Pipeline completeness report
 */
export async function verifyFactPipelineCompleteness(caseId, factId) {
  const logs = await prisma.factAuditLog.findMany({
    where: { caseId, factId },
    orderBy: { timestamp: 'asc' },
  });

  const expectedPipeline = ['fact_registered', 'fact_verified'];
  const completedActions = new Set(logs.map(l => l.action));
  const missing = expectedPipeline.filter(a => !completedActions.has(a));

  return {
    factId,
    totalEvents: logs.length,
    completedActions: [...completedActions],
    missingActions: missing,
    isComplete: missing.length === 0,
    timeline: logs.map(l => ({
      action: l.action,
      actor: l.actor,
      timestamp: l.timestamp,
    })),
  };
}
