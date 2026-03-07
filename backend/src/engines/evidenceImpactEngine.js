// ============================================
// Court Access — Evidence Impact Scoring
// Phase 132: Score evidence based on reliability,
// corroboration, independence, timeline alignment
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Score evidence impact for a specific evidence item.
 * @param {string} caseId
 * @param {string} evidenceId
 * @returns {object} EvidenceImpactScore record
 */
export async function scoreEvidenceImpact(caseId, evidenceId) {
  console.log(`[EvidenceImpact] Scoring evidence ${evidenceId} for case ${caseId}`);

  // Gather related data (correlations depend on facts, so run sequentially)
  const [facts, conflicts, admissibilityIssues] = await Promise.all([
    prisma.extractedFact.findMany({ where: { caseId, documentId: evidenceId } }),
    prisma.evidenceConflict.findMany({
      where: { caseId, OR: [{ documentA: evidenceId }, { documentB: evidenceId }] },
    }),
    prisma.admissibilityIssue.findMany({ where: { caseId, evidenceId } }),
  ]);

  // Now query correlations using the resolved fact IDs
  const factIds = facts.map(f => f.id);
  const correlations = factIds.length > 0
    ? await prisma.factCorrelation.findMany({
        where: { caseId, OR: [{ factAId: { in: factIds } }, { factBId: { in: factIds } }] },
      }).catch(() => [])
    : [];

  // Reliability: based on admissibility issues and conflicts
  const admissibilityPenalty = admissibilityIssues.length * 0.15;
  const conflictPenalty = conflicts.length * 0.1;
  const reliabilityScore = Math.max(0, Math.min(1, 1 - admissibilityPenalty - conflictPenalty));

  // Corroboration: how many facts from this evidence are supported elsewhere
  const allFacts = await prisma.extractedFact.findMany({ where: { caseId } });
  let corroboratedFacts = 0;
  for (const fact of facts) {
    const hasCorrob = allFacts.some(f =>
      f.id !== fact.id &&
      f.documentId !== evidenceId &&
      f.normalizedValue === fact.normalizedValue
    );
    if (hasCorrob) corroboratedFacts++;
  }
  const corroborationScore = facts.length > 0 ? corroboratedFacts / facts.length : 0.5;

  // Independence: is this evidence independent of other evidence?
  const registry = await prisma.evidenceRegistry.findUnique({ where: { evidenceId } }).catch(() => null);
  const independenceScore = registry ? 0.8 : 0.5; // If registered, assumed independent source

  // Timeline alignment: do facts from this evidence fit the timeline?
  const timeline = await prisma.courtTimelineEvent.findMany({ where: { caseId } });
  let aligned = 0;
  for (const fact of facts) {
    if (fact.timestamp) {
      const nearTimeline = timeline.some(te => {
        const diff = Math.abs(new Date(te.time).getTime() - new Date(fact.timestamp).getTime());
        return diff < 30 * 60 * 1000; // Within 30 minutes
      });
      if (nearTimeline) aligned++;
    }
  }
  const factsWithTime = facts.filter(f => f.timestamp).length;
  const timelineAlignmentScore = factsWithTime > 0 ? aligned / factsWithTime : 0.5;

  // Overall impact score
  const weights = { reliability: 0.30, corroboration: 0.25, independence: 0.20, timelineAlignment: 0.25 };
  const overallImpactScore = Math.round((
    reliabilityScore * weights.reliability +
    corroborationScore * weights.corroboration +
    independenceScore * weights.independence +
    timelineAlignmentScore * weights.timelineAlignment
  ) * 100) / 100;

  let impactLevel = 'low';
  if (overallImpactScore >= 0.75) impactLevel = 'critical';
  else if (overallImpactScore >= 0.55) impactLevel = 'high';
  else if (overallImpactScore >= 0.35) impactLevel = 'medium';

  const record = await prisma.evidenceImpactScore.upsert({
    where: { caseId_evidenceId: { caseId, evidenceId } },
    create: {
      caseId,
      evidenceId,
      reliabilityScore,
      corroborationScore,
      independenceScore,
      timelineAlignmentScore,
      overallImpactScore,
      impactLevel,
      factors: weights,
      metadata: {
        factCount: facts.length,
        conflictCount: conflicts.length,
        admissibilityIssueCount: admissibilityIssues.length,
      },
    },
    update: {
      reliabilityScore,
      corroborationScore,
      independenceScore,
      timelineAlignmentScore,
      overallImpactScore,
      impactLevel,
      factors: weights,
      metadata: {
        factCount: facts.length,
        conflictCount: conflicts.length,
        admissibilityIssueCount: admissibilityIssues.length,
      },
    },
  });

  console.log(`[EvidenceImpact] Evidence ${evidenceId} impact: ${impactLevel} (${overallImpactScore})`);
  return record;
}

/**
 * Score all evidence in a case.
 * @param {string} caseId
 * @returns {{ scores: object[], summary: object }}
 */
export async function scoreCaseEvidence(caseId) {
  const registry = await prisma.evidenceRegistry.findMany({ where: { caseId } });
  const scores = [];

  for (const evidence of registry) {
    try {
      const score = await scoreEvidenceImpact(caseId, evidence.evidenceId);
      scores.push(score);
    } catch (err) {
      console.warn(`[EvidenceImpact] Failed to score ${evidence.evidenceId}: ${err.message}`);
    }
  }

  return {
    scores,
    summary: {
      total: scores.length,
      avgImpact: scores.length > 0
        ? Math.round((scores.reduce((s, e) => s + e.overallImpactScore, 0) / scores.length) * 100) / 100
        : 0,
      byLevel: {
        critical: scores.filter(s => s.impactLevel === 'critical').length,
        high: scores.filter(s => s.impactLevel === 'high').length,
        medium: scores.filter(s => s.impactLevel === 'medium').length,
        low: scores.filter(s => s.impactLevel === 'low').length,
      },
    },
  };
}

export async function getCaseImpactScores(caseId) {
  return prisma.evidenceImpactScore.findMany({
    where: { caseId },
    orderBy: { overallImpactScore: 'desc' },
  });
}
