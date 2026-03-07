// ============================================
// Court Access — Investigative Task Generation (Fact-Based)
// Phase M: Generate investigative tasks from
// fact-graph analysis results
// ============================================

import prisma from './prismaClient.js';

/**
 * Generate investigative tasks from fact-graph analysis.
 * @param {string} caseId
 * @returns {{ tasks: object[], summary: object }}
 */
export async function generateFactBasedTasks(caseId) {
  console.log(`[FactTaskGen] Generating fact-based tasks for case ${caseId}`);

  const [inferences, ungrounded, corrobReport, legalAnalyses] = await Promise.all([
    prisma.factInference.findMany({ where: { caseId } }),
    prisma.outputValidation.findMany({ where: { caseId, isGrounded: false } }),
    prisma.factCorroborationRecord.findMany({ where: { caseId } }),
    prisma.legalAnalysis.findMany({ where: { caseId } }),
  ]);

  // Get existing tasks to avoid duplicates
  const existingTasks = await prisma.investigativeTask.findMany({
    where: { caseId },
    select: { title: true },
  });
  const existingTitles = new Set(existingTasks.map(t => t.title));

  const tasks = [];

  // Tasks from contradictions
  for (const inference of inferences) {
    if (inference.inferenceType !== 'contradiction' && inference.inferenceType !== 'impossibility') continue;

    const title = `Resolve ${inference.ruleName}: ${inference.description.substring(0, 60)}`;
    if (existingTitles.has(title)) continue;

    tasks.push({
      caseId,
      taskType: 'FACT_RESOLUTION',
      title,
      description: `The fact-graph reasoning engine detected a ${inference.inferenceType}: ${inference.description}. Investigate to resolve this discrepancy.`,
      priority: inference.severity === 'critical' ? 'critical' : 'high',
      status: 'pending',
      estimatedHours: 6,
      relatedEvidenceIds: [inference.factAId, inference.factBId].filter(Boolean),
      metadata: {
        source: 'fact_reasoning',
        inferenceId: inference.id,
        inferenceType: inference.inferenceType,
      },
    });
  }

  // Tasks from ungrounded outputs
  for (const validation of ungrounded) {
    const claims = validation.ungroundedClaims || [];
    if (claims.length === 0) continue;

    const title = `Find evidence for ${claims.length} ungrounded claims in ${validation.outputType}`;
    if (existingTitles.has(title)) continue;

    tasks.push({
      caseId,
      taskType: 'EVIDENCE_SEARCH',
      title,
      description: `${claims.length} claims in a ${validation.outputType} are not supported by verified facts. Locate evidence or remove unsupported claims.`,
      priority: 'medium',
      status: 'pending',
      estimatedHours: 4,
      relatedEvidenceIds: [],
      metadata: {
        source: 'output_validation',
        validationId: validation.id,
        ungroundedClaims: claims.slice(0, 5),
      },
    });
  }

  // Tasks from weak legal analyses
  for (const analysis of legalAnalyses) {
    if (analysis.conclusion === 'strong_argument') continue;
    if (analysis.overallStrength >= 0.5) continue;

    const missingElements = (analysis.elements || []).filter(e => !e.isMet);
    if (missingElements.length === 0) continue;

    const title = `Strengthen ${analysis.analysisName}: find evidence for ${missingElements.length} unmet elements`;
    if (existingTitles.has(title)) continue;

    tasks.push({
      caseId,
      taskType: 'LEGAL_RESEARCH',
      title,
      description: `Legal analysis "${analysis.analysisName}" currently ${analysis.conclusion}. Missing elements: ${missingElements.map(e => e.description).join('; ')}`,
      priority: analysis.conclusion === 'insufficient_evidence' ? 'high' : 'medium',
      status: 'pending',
      estimatedHours: 8,
      relatedEvidenceIds: [],
      metadata: {
        source: 'legal_analysis',
        analysisId: analysis.id,
        missingElements: missingElements.map(e => e.elementId),
      },
    });
  }

  // Store tasks
  const stored = [];
  for (const task of tasks) {
    try {
      const record = await prisma.investigativeTask.create({ data: task });
      stored.push(record);
    } catch (err) {
      console.warn(`[FactTaskGen] Store error: ${err.message}`);
    }
  }

  console.log(`[FactTaskGen] Generated ${stored.length} fact-based tasks for case ${caseId}`);

  return {
    tasks: stored,
    summary: {
      total: stored.length,
      byType: stored.reduce((acc, t) => { acc[t.taskType] = (acc[t.taskType] || 0) + 1; return acc; }, {}),
      byPriority: stored.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {}),
    },
  };
}

export async function getFactBasedTasks(caseId) {
  return prisma.investigativeTask.findMany({
    where: { caseId, metadata: { path: ['source'], string_contains: 'fact' } },
    orderBy: { createdAt: 'desc' },
  });
}
