// ============================================
// Court Access — Evidence Correlation Engine
// Phase 125: Cross-reference facts across evidence
//
// Detects: matching events, duplicate mentions,
// timeline inconsistencies, location conflicts.
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Run correlation analysis across all facts in a case.
 * @param {string} caseId
 * @returns {{ correlations: object[], summary: object }}
 */
export async function correlateEvidence(caseId) {
  console.log(`[CorrelationEngine] Correlating evidence for case ${caseId}`);

  const facts = await prisma.extractedFact.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });

  const correlations = [];
  correlations.push(...detectMatchingEvents(facts));
  correlations.push(...detectDuplicateMentions(facts));
  correlations.push(...detectTimelineInconsistencies(facts));
  correlations.push(...detectLocationConflicts(facts));

  const stored = [];
  for (const corr of correlations) {
    try {
      const record = await prisma.factCorrelation.create({
        data: {
          caseId,
          factAId: corr.factAId,
          factBId: corr.factBId,
          correlationType: corr.correlationType,
          confidenceScore: corr.confidenceScore,
          description: corr.description,
          metadata: corr.metadata || {},
        },
      });
      stored.push(record);
    } catch (err) {
      if (!err.message.includes('Unique constraint')) {
        console.warn(`[CorrelationEngine] Store error: ${err.message}`);
      }
    }
  }

  console.log(`[CorrelationEngine] Found ${stored.length} correlations for case ${caseId}`);

  return {
    correlations: stored,
    summary: {
      total: stored.length,
      matching_events: correlations.filter(c => c.correlationType === 'matching_event').length,
      duplicate_mentions: correlations.filter(c => c.correlationType === 'duplicate_mention').length,
      timeline_inconsistencies: correlations.filter(c => c.correlationType === 'timeline_inconsistency').length,
      location_conflicts: correlations.filter(c => c.correlationType === 'location_conflict').length,
    },
  };
}

function detectMatchingEvents(facts) {
  const correlations = [];
  const events = facts.filter(f => f.factType === 'EVENT');

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[i].documentId === events[j].documentId) continue;
      const similarity = textSimilarity(events[i].normalizedValue, events[j].normalizedValue);
      if (similarity > 0.6) {
        correlations.push({
          factAId: events[i].id,
          factBId: events[j].id,
          correlationType: 'matching_event',
          confidenceScore: similarity,
          description: `Similar event in different documents: "${events[i].statementText.substring(0, 60)}" and "${events[j].statementText.substring(0, 60)}"`,
          metadata: { similarity },
        });
      }
    }
  }
  return correlations;
}

function detectDuplicateMentions(facts) {
  const correlations = [];
  const byNormalized = new Map();

  for (const fact of facts) {
    if (!fact.normalizedValue) continue;
    const key = `${fact.factType}:${fact.normalizedValue}`;
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key).push(fact);
  }

  for (const [, group] of byNormalized) {
    if (group.length < 2) continue;
    const docs = [...new Set(group.map(f => f.documentId))];
    if (docs.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].documentId === group[j].documentId) continue;
        correlations.push({
          factAId: group[i].id,
          factBId: group[j].id,
          correlationType: 'duplicate_mention',
          confidenceScore: 0.85,
          description: `"${group[i].statementText}" mentioned in multiple documents`,
          metadata: { factType: group[i].factType },
        });
      }
    }
  }
  return correlations;
}

function detectTimelineInconsistencies(facts) {
  const correlations = [];
  const times = facts.filter(f => f.factType === 'TIME' || f.factType === 'DATE');

  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      if (times[i].documentId === times[j].documentId) continue;
      if (times[i].normalizedValue !== times[j].normalizedValue) {
        const contextSim = textSimilarity(JSON.stringify(times[i].metadata), JSON.stringify(times[j].metadata));
        if (contextSim > 0.5) {
          correlations.push({
            factAId: times[i].id,
            factBId: times[j].id,
            correlationType: 'timeline_inconsistency',
            confidenceScore: 0.65,
            description: `Time discrepancy: "${times[i].statementText}" vs "${times[j].statementText}"`,
            metadata: { contextSimilarity: contextSim },
          });
        }
      }
    }
  }
  return correlations;
}

function detectLocationConflicts(facts) {
  const correlations = [];
  const locations = facts.filter(f => f.factType === 'LOCATION');

  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      if (locations[i].documentId === locations[j].documentId) continue;
      if (locations[i].normalizedValue !== locations[j].normalizedValue) {
        const contextSim = textSimilarity(JSON.stringify(locations[i].metadata), JSON.stringify(locations[j].metadata));
        if (contextSim > 0.5) {
          correlations.push({
            factAId: locations[i].id,
            factBId: locations[j].id,
            correlationType: 'location_conflict',
            confidenceScore: 0.6,
            description: `Location conflict: "${locations[i].statementText}" vs "${locations[j].statementText}"`,
            metadata: { contextSimilarity: contextSim },
          });
        }
      }
    }
  }
  return correlations;
}

function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) { if (setB.has(w)) intersection++; }
  return intersection / Math.max(setA.size, setB.size);
}

export async function getCaseCorrelations(caseId, type = null) {
  const where = { caseId };
  if (type) where.correlationType = type;
  return prisma.factCorrelation.findMany({ where, orderBy: { createdAt: 'desc' } });
}
