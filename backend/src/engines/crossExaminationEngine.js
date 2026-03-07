// ============================================
// Court Access — Cross-Examination Prep Engine
// Phase 139: Generate cross-examination questions
// based on inconsistencies, conflicts, reliability
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Generate cross-examination questions for a witness.
 * @param {string} caseId
 * @param {string} witnessName
 * @returns {{ questions: object[], summary: object }}
 */
export async function generateCrossExamQuestions(caseId, witnessName) {
  console.log(`[CrossExam] Generating questions for "${witnessName}" in case ${caseId}`);

  const [reliability, misidRisk, statements, conflicts, facts] = await Promise.all([
    prisma.witnessReliability.findFirst({ where: { caseId, witnessName }, orderBy: { createdAt: 'desc' } }),
    prisma.misidentificationRisk.findFirst({ where: { caseId, witnessName }, orderBy: { createdAt: 'desc' } }),
    prisma.transcriptStatement.findMany({ where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } } }),
    prisma.timelineConflict.findMany({ where: { caseId } }),
    prisma.extractedFact.findMany({ where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } } }),
  ]);

  const questions = [];

  // Consistency-based questions
  if (reliability && reliability.consistencyScore < 0.7) {
    questions.push({
      category: 'consistency',
      priority: 'high',
      question: `In your earlier statement, you said [X]. Today you stated [Y]. Can you explain this discrepancy?`,
      basis: `Witness consistency score: ${reliability.consistencyScore}`,
      tactic: 'impeachment',
    });
  }

  // Visibility-based questions
  if (reliability && reliability.visibilityScore < 0.5) {
    questions.push({
      category: 'perception',
      priority: 'high',
      question: `You said you saw the events clearly. What was the lighting condition at the time?`,
      basis: `Witness visibility score: ${reliability.visibilityScore}`,
      tactic: 'credibility_challenge',
    });
    questions.push({
      category: 'perception',
      priority: 'medium',
      question: `How far were you from the scene when you observed the events?`,
      basis: `Witness distance score: ${reliability.distanceScore}`,
      tactic: 'credibility_challenge',
    });
  }

  // Misidentification risk questions
  if (misidRisk && misidRisk.overallRiskScore > 0.5) {
    questions.push({
      category: 'identification',
      priority: 'critical',
      question: `How long did you observe the individual before making your identification?`,
      basis: `Misidentification risk: ${misidRisk.riskLevel} (${misidRisk.overallRiskScore})`,
      tactic: 'identification_challenge',
    });
    questions.push({
      category: 'identification',
      priority: 'high',
      question: `Were you shown any photos or descriptions of a suspect before making your identification?`,
      basis: `Lineup fairness score: ${misidRisk.lineupFairnessScore}`,
      tactic: 'suggestive_procedure',
    });
  }

  // Stress-based questions
  if (reliability && reliability.stressScore < 0.4) {
    questions.push({
      category: 'stress',
      priority: 'medium',
      question: `You described being under significant stress at the time. Research shows that stress can impair memory. Were you afraid during the event?`,
      basis: `Witness stress score: ${reliability.stressScore}`,
      tactic: 'cognitive_challenge',
    });
  }

  // Timeline conflict questions
  for (const conflict of conflicts.slice(0, 3)) {
    questions.push({
      category: 'timeline',
      priority: 'high',
      question: `There appears to be a discrepancy between your account and other evidence regarding the timeline. Can you explain why ${conflict.description.substring(0, 100)}?`,
      basis: `Timeline conflict: ${conflict.conflictType} (${conflict.severity})`,
      tactic: 'impeachment',
    });
  }

  // Statement-specific questions
  for (const stmt of statements.slice(0, 5)) {
    if (stmt.statementText.length > 30) {
      questions.push({
        category: 'prior_statement',
        priority: 'medium',
        question: `You previously stated: "${stmt.statementText.substring(0, 100)}". Is that still your testimony today?`,
        basis: `Prior statement from transcript`,
        tactic: 'lock_in_testimony',
      });
    }
  }

  // Store questions
  const stored = [];
  for (const q of questions) {
    try {
      const record = await prisma.crossExamQuestion.create({
        data: {
          caseId,
          witnessName,
          questionText: q.question,
          questionType: q.tactic || 'impeachment',
          notes: q.basis || '',
          metadata: { category: q.category, priority: q.priority },
        },
      });
      stored.push(record);
    } catch (err) {
      console.warn(`[CrossExam] Store error: ${err.message}`);
    }
  }

  console.log(`[CrossExam] Generated ${stored.length} questions for "${witnessName}"`);

  return {
    questions: stored,
    summary: {
      total: stored.length,
      byCategory: groupBy(stored, r => r.metadata?.category || 'unknown'),
      byPriority: groupBy(stored, r => r.metadata?.priority || 'unknown'),
    },
  };
}

function groupBy(items, keyOrFn) {
  return items.reduce((acc, item) => {
    const val = typeof keyOrFn === 'function' ? keyOrFn(item) : (item[keyOrFn] || 'unknown');
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export async function getCaseQuestions(caseId, witnessName = null) {
  const where = { caseId };
  if (witnessName) where.witnessName = witnessName;
  return prisma.crossExamQuestion.findMany({ where, orderBy: { createdAt: 'desc' } });
}
