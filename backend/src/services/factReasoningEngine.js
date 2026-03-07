// ============================================
// Court Access — Fact-Based Reasoning Engine
// Phase F: Draw inferences from verified facts
// using logical rules
// ============================================

import prisma from './prismaClient.js';

const INFERENCE_RULES = [
  {
    name: 'alibi_conflict',
    description: 'Person cannot be in two places at the same time',
    condition: (factsA, factsB) => {
      // Find same person with different locations at similar times
      for (const a of factsA) {
        for (const b of factsB) {
          if (a.speaker === b.speaker && a.factType === 'LOCATION' && b.factType === 'LOCATION' &&
              a.normalizedValue !== b.normalizedValue && a.timestamp && b.timestamp) {
            const timeDiff = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            if (timeDiff < 30 * 60 * 1000) return { factA: a, factB: b, timeDiff };
          }
        }
      }
      return null;
    },
    inferenceType: 'contradiction',
    severity: 'critical',
  },
  {
    name: 'temporal_impossibility',
    description: 'Sequence of events is physically impossible in the timeframe',
    condition: (factsA, factsB) => {
      for (const a of factsA) {
        for (const b of factsB) {
          if (a.factType === 'EVENT' && b.factType === 'EVENT' && a.timestamp && b.timestamp) {
            const timeDiff = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            if (timeDiff < 60 * 1000 && a.documentId !== b.documentId) {
              return { factA: a, factB: b, timeDiff };
            }
          }
        }
      }
      return null;
    },
    inferenceType: 'impossibility',
    severity: 'high',
  },
  {
    name: 'witness_agreement',
    description: 'Multiple independent witnesses agree on same fact',
    condition: (factsA, factsB) => {
      for (const a of factsA) {
        for (const b of factsB) {
          if (a.factType === b.factType && a.normalizedValue === b.normalizedValue &&
              a.speaker && b.speaker && a.speaker !== b.speaker && a.documentId !== b.documentId) {
            return { factA: a, factB: b };
          }
        }
      }
      return null;
    },
    inferenceType: 'corroboration',
    severity: 'low',
  },
];

/**
 * Run fact-based reasoning on a case.
 * @param {string} caseId
 * @returns {{ inferences: object[], summary: object }}
 */
export async function runFactReasoning(caseId) {
  console.log(`[FactReasoning] Running reasoning for case ${caseId}`);

  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, verificationStatus: { not: 'merged' } },
    orderBy: { createdAt: 'asc' },
  });

  // Group facts by document
  const byDoc = new Map();
  for (const fact of facts) {
    if (!byDoc.has(fact.documentId)) byDoc.set(fact.documentId, []);
    byDoc.get(fact.documentId).push(fact);
  }

  const docIds = [...byDoc.keys()];
  const inferences = [];

  // Compare facts across document pairs
  for (let i = 0; i < docIds.length; i++) {
    for (let j = i + 1; j < docIds.length; j++) {
      const factsA = byDoc.get(docIds[i]);
      const factsB = byDoc.get(docIds[j]);

      for (const rule of INFERENCE_RULES) {
        const result = rule.condition(factsA, factsB);
        if (result) {
          inferences.push({
            caseId,
            ruleName: rule.name,
            inferenceType: rule.inferenceType,
            severity: rule.severity,
            description: `${rule.description}: ${result.factA.factText.substring(0, 60)} vs ${result.factB.factText.substring(0, 60)}`,
            factAId: result.factA.id,
            factBId: result.factB.id,
            metadata: {
              ruleDescription: rule.description,
              timeDiff: result.timeDiff,
              documentA: docIds[i],
              documentB: docIds[j],
            },
          });
        }
      }
    }
  }

  // Store inferences
  const stored = [];
  for (const inference of inferences) {
    try {
      const record = await prisma.factInference.create({ data: inference });
      stored.push(record);
    } catch (err) {
      console.warn(`[FactReasoning] Store error: ${err.message}`);
    }
  }

  console.log(`[FactReasoning] Generated ${stored.length} inferences for case ${caseId}`);

  return {
    inferences: stored,
    summary: {
      total: stored.length,
      byType: groupBy(stored, 'inferenceType'),
      bySeverity: groupBy(stored, 'severity'),
      byRule: groupBy(stored, 'ruleName'),
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

export async function getCaseInferences(caseId) {
  return prisma.factInference.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
