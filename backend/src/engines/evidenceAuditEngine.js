// ============================================
// Court Access — Evidence Audit Trail Engine
// Phase 148: Complete audit trail for all evidence operations
// ============================================

import prisma from '../services/prismaClient.js';

const AUDIT_CATEGORIES = [
  'evidence_registered', 'evidence_classified', 'evidence_transcribed',
  'fact_extracted', 'correlation_detected', 'timeline_built',
  'conflict_detected', 'witness_analyzed', 'admissibility_flagged',
  'impact_scored', 'task_generated', 'narrative_built',
  'motion_recommended', 'graph_enriched', 'analysis_exported',
];

/**
 * Log an evidence audit event.
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.action
 * @param {string} params.actor - User or system identifier
 * @param {string} [params.evidenceId]
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {object} [params.details]
 * @returns {object} EvidenceAuditLog record
 */
export async function logAuditEvent({ caseId, action, actor, evidenceId, entityType, entityId, details = {} }) {
  if (!AUDIT_CATEGORIES.includes(action)) {
    console.warn(`[EvidenceAudit] Unknown audit action: ${action}`);
  }

  const record = await prisma.evidenceAuditLog.create({
    data: {
      caseId,
      action,
      algorithm: actor || '',
      input: { evidenceId: evidenceId || null, entityType: entityType || null, entityId: entityId || null, ipAddress: details.ipAddress || null },
      output: details,
      timestamp: new Date(),
    },
  });

  console.log(`[EvidenceAudit] ${action} by ${actor} for case ${caseId}`);
  return record;
}

/**
 * Get audit trail for a case.
 * @param {string} caseId
 * @param {object} [filters]
 * @returns {object[]} Audit log entries
 */
export async function getCaseAuditTrail(caseId, filters = {}) {
  const where = { caseId };
  if (filters.action) where.action = filters.action;
  if (filters.startDate) where.timestamp = { ...where.timestamp, gte: new Date(filters.startDate) };
  if (filters.endDate) where.timestamp = { ...where.timestamp, lte: new Date(filters.endDate) };

  return prisma.evidenceAuditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: filters.limit || 500,
  });
}

/**
 * Get audit summary for a case.
 * @param {string} caseId
 * @returns {object} Audit summary
 */
export async function getAuditSummary(caseId) {
  const logs = await prisma.evidenceAuditLog.findMany({
    where: { caseId },
    orderBy: { timestamp: 'desc' },
  });

  const byAction = {};
  const byAlgorithm = {};
  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    if (log.algorithm) byAlgorithm[log.algorithm] = (byAlgorithm[log.algorithm] || 0) + 1;
  }

  return {
    caseId,
    totalEvents: logs.length,
    byAction,
    byActor: byAlgorithm,
    firstEvent: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    lastEvent: logs.length > 0 ? logs[0].timestamp : null,
  };
}

/**
 * Verify audit trail completeness for evidence.
 * @param {string} caseId
 * @param {string} evidenceId
 * @returns {object} Completeness report
 */
export async function verifyAuditCompleteness(caseId, evidenceId) {
  const logs = await prisma.evidenceAuditLog.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });
  // Filter logs related to this evidence via input JSON field
  const filtered = logs.filter(l => {
    const input = typeof l.input === 'object' ? l.input : {};
    return input.evidenceId === evidenceId;
  });

  const expectedActions = ['evidence_registered', 'evidence_classified', 'fact_extracted'];
  const foundActions = new Set(filtered.map(l => l.action));
  const missing = expectedActions.filter(a => !foundActions.has(a));

  return {
    evidenceId,
    totalEvents: filtered.length,
    expectedActions,
    foundActions: [...foundActions],
    missingActions: missing,
    isComplete: missing.length === 0,
    timeline: filtered.map(l => ({
      action: l.action,
      actor: l.algorithm,
      timestamp: l.timestamp,
    })),
  };
}
