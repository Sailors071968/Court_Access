// ============================================
// Court Access — Investigative Task Engine
// Phase 134: Generate actionable tasks from opportunities
// ============================================

import prisma from '../services/prismaClient.js';

const TASK_TEMPLATES = {
  MISSING_WITNESS: (opp) => ({
    taskType: 'WITNESS_INTERVIEW',
    title: `Interview witness: ${opp.metadata?.personName || 'Unknown'}`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 4,
  }),
  UNCORROBORATED_CLAIM: (opp) => ({
    taskType: 'EVIDENCE_SEARCH',
    title: `Find corroboration for uncorroborated claim`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 8,
  }),
  SURVEILLANCE_GAP: (opp) => ({
    taskType: 'SURVEILLANCE_REQUEST',
    title: `Obtain surveillance footage for gap period`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 6,
  }),
  FORENSIC_OPPORTUNITY: (opp) => ({
    taskType: 'FORENSIC_ANALYSIS',
    title: `Submit evidence for forensic analysis`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 40,
  }),
  ALIBI_VERIFICATION: (opp) => ({
    taskType: 'ALIBI_CHECK',
    title: `Verify alibi / resolve timeline conflict`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 12,
  }),
  TIMELINE_GAP: (opp) => ({
    taskType: 'TIMELINE_INVESTIGATION',
    title: `Investigate ${opp.metadata?.gapHours || '?'}-hour timeline gap`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 8,
  }),
  RECORD_REQUEST: (opp) => ({
    taskType: 'SUBPOENA',
    title: `Subpoena records for evidence chain of custody`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 4,
  }),
  EXPERT_CONSULTATION: (opp) => ({
    taskType: 'EXPERT_RETENTION',
    title: `Consult expert witness`,
    description: opp.suggestedAction,
    priority: opp.priority,
    estimatedHours: 16,
  }),
};

/**
 * Generate investigative tasks from opportunities.
 * @param {string} caseId
 * @returns {{ tasks: object[], summary: object }}
 */
export async function generateInvestigativeTasks(caseId) {
  console.log(`[InvestigativeTask] Generating tasks for case ${caseId}`);

  const opportunities = await prisma.investigativeOpportunity.findMany({
    where: { caseId, status: 'open' },
    orderBy: { createdAt: 'desc' },
  });

  const tasks = [];

  for (const opp of opportunities) {
    const template = TASK_TEMPLATES[opp.opportunityType];
    if (!template) continue;

    const taskData = template(opp);

    // Check for duplicate tasks
    const existing = await prisma.investigativeTask.findFirst({
      where: {
        caseId,
        taskType: taskData.taskType,
        opportunityId: opp.id,
      },
    });
    if (existing) continue;

    const task = await prisma.investigativeTask.create({
      data: {
        caseId,
        opportunityId: opp.id,
        taskType: taskData.taskType,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: 'pending',
        estimatedHours: taskData.estimatedHours,
        relatedEvidenceIds: opp.relatedEvidenceIds || [],
        metadata: {
          generatedFrom: opp.opportunityType,
          opportunityMetadata: opp.metadata,
        },
      },
    });
    tasks.push(task);
  }

  console.log(`[InvestigativeTask] Generated ${tasks.length} tasks for case ${caseId}`);

  return {
    tasks,
    summary: {
      total: tasks.length,
      byType: groupBy(tasks, 'taskType'),
      byPriority: groupBy(tasks, 'priority'),
      totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    },
  };
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export async function updateTaskStatus(taskId, status, notes = '') {
  return prisma.investigativeTask.update({
    where: { id: taskId },
    data: {
      status,
      metadata: { completionNotes: notes, updatedAt: new Date().toISOString() },
    },
  });
}

export async function getCaseTasks(caseId, status = null) {
  const where = { caseId };
  if (status) where.status = status;
  return prisma.investigativeTask.findMany({ where, orderBy: { createdAt: 'desc' } });
}
