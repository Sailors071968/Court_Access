// ============================================
// Court Access — Fact Neutrality Enforcement
// Phase O: Ensure fact-graph outputs maintain neutrality
//
// Rules:
// 1. Never assume guilt or innocence
// 2. Only reference verified facts in the record
// 3. Present facts without value judgment
// 4. Flag biased reasoning in inferences
// ============================================

import prisma from './prismaClient.js';
import { checkNeutrality } from '../engines/evidenceNeutralityEngine.js';

/**
 * Audit all fact-graph outputs for neutrality.
 * @param {string} caseId
 * @returns {{ results: object[], summary: object }}
 */
export async function auditFactOutputNeutrality(caseId) {
  console.log(`[FactNeutrality] Auditing fact outputs for case ${caseId}`);

  const [inferences, analyses, comparisons, tasks] = await Promise.all([
    prisma.factInference.findMany({ where: { caseId } }),
    prisma.legalAnalysis.findMany({ where: { caseId } }),
    prisma.narrativeFactComparison.findMany({ where: { caseId } }),
    prisma.investigativeTask.findMany({ where: { caseId } }),
  ]);

  const results = [];

  // Check inferences
  for (const inference of inferences) {
    const check = checkNeutrality(inference.description);
    if (!check.isNeutral) {
      results.push({
        entityType: 'inference',
        entityId: inference.id,
        violations: check.violations,
        originalText: inference.description,
        suggestedText: check.neutralizedText,
      });
    }
  }

  // Check legal analyses
  for (const analysis of analyses) {
    const elements = analysis.elements || [];
    for (const element of elements) {
      if (element.description) {
        const check = checkNeutrality(element.description);
        if (!check.isNeutral) {
          results.push({
            entityType: 'legal_analysis',
            entityId: analysis.id,
            violations: check.violations,
            originalText: element.description,
            suggestedText: check.neutralizedText,
          });
        }
      }
    }
  }

  // Check task descriptions
  for (const task of tasks) {
    const check = checkNeutrality(task.description);
    if (!check.isNeutral) {
      results.push({
        entityType: 'task',
        entityId: task.id,
        violations: check.violations,
        originalText: task.description,
        suggestedText: check.neutralizedText,
      });
    }
  }

  // Store audit
  await prisma.neutralityAudit.create({
    data: {
      caseId,
      entityType: 'fact_graph_outputs',
      totalChecked: inferences.length + analyses.length + comparisons.length + tasks.length,
      violationsFound: results.reduce((sum, r) => sum + r.violations.length, 0),
      results,
      metadata: {
        auditedAt: new Date().toISOString(),
        inferenceCount: inferences.length,
        analysisCount: analyses.length,
        taskCount: tasks.length,
      },
    },
  });

  console.log(`[FactNeutrality] Found ${results.length} outputs with neutrality issues`);

  return {
    results,
    summary: {
      totalChecked: inferences.length + analyses.length + comparisons.length + tasks.length,
      issuesFound: results.length,
      totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
      byEntityType: results.reduce((acc, r) => {
        acc[r.entityType] = (acc[r.entityType] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}
