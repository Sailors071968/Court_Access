// ============================================
// Court Access — Logic Query Service
// Phase G: Query the fact graph with logical questions
// ============================================

import prisma from './prismaClient.js';

/**
 * Query verified facts with structured logic.
 * @param {string} caseId
 * @param {object} query
 * @param {string} query.type - 'who', 'what', 'when', 'where', 'how', 'conflicts', 'supports'
 * @param {object} [query.filters]
 * @returns {{ results: object[], answer: string }}
 */
export async function queryFacts(caseId, query) {
  console.log(`[LogicQuery] Query "${query.type}" for case ${caseId}`);

  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, verificationStatus: { not: 'merged' } },
    orderBy: { confidence: 'desc' },
  });

  let results = [];
  let answer = '';

  switch (query.type) {
    case 'who': {
      results = facts.filter(f => f.factType === 'PERSON');
      if (query.filters?.event) {
        const eventFacts = facts.filter(f => f.factType === 'EVENT' && f.factText.toLowerCase().includes(query.filters.event.toLowerCase()));
        const docIds = eventFacts.map(f => f.documentId);
        results = results.filter(f => docIds.includes(f.documentId));
      }
      answer = results.length > 0
        ? `Found ${results.length} persons: ${[...new Set(results.map(r => r.normalizedValue))].join(', ')}`
        : 'No persons found matching query.';
      break;
    }
    case 'what': {
      results = facts.filter(f => f.factType === 'EVENT' || f.factType === 'OBJECT' || f.factType === 'ACTION');
      if (query.filters?.person) {
        results = results.filter(f => f.speaker?.toLowerCase().includes(query.filters.person.toLowerCase()));
      }
      answer = results.length > 0
        ? `Found ${results.length} events/actions: ${results.slice(0, 5).map(r => r.factText.substring(0, 50)).join('; ')}`
        : 'No events found matching query.';
      break;
    }
    case 'when': {
      results = facts.filter(f => (f.factType === 'TIME' || f.factType === 'DATE') && f.timestamp);
      if (query.filters?.event) {
        const eventFacts = facts.filter(f => f.factType === 'EVENT' && f.factText.toLowerCase().includes(query.filters.event.toLowerCase()));
        const docIds = eventFacts.map(f => f.documentId);
        results = results.filter(f => docIds.includes(f.documentId));
      }
      results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      answer = results.length > 0
        ? `Found ${results.length} time references: ${results.slice(0, 5).map(r => r.factText).join('; ')}`
        : 'No time references found matching query.';
      break;
    }
    case 'where': {
      results = facts.filter(f => f.factType === 'LOCATION');
      if (query.filters?.person) {
        results = results.filter(f => f.speaker?.toLowerCase().includes(query.filters.person.toLowerCase()));
      }
      answer = results.length > 0
        ? `Found ${results.length} locations: ${[...new Set(results.map(r => r.normalizedValue))].join(', ')}`
        : 'No locations found matching query.';
      break;
    }
    case 'conflicts': {
      const inferences = await prisma.factInference.findMany({
        where: { caseId, inferenceType: { in: ['contradiction', 'impossibility'] } },
      });
      results = inferences;
      answer = inferences.length > 0
        ? `Found ${inferences.length} conflicts: ${inferences.slice(0, 3).map(i => i.description.substring(0, 80)).join('; ')}`
        : 'No conflicts found.';
      break;
    }
    case 'supports': {
      const corroborations = await prisma.factCorroborationRecord.findMany({
        where: { caseId },
        orderBy: { corroborationStrength: 'desc' },
      });
      results = corroborations;
      answer = corroborations.length > 0
        ? `Found ${corroborations.length} corroborated fact groups with avg strength ${Math.round((corroborations.reduce((s, c) => s + c.corroborationStrength, 0) / corroborations.length) * 100) / 100}`
        : 'No corroborated facts found.';
      break;
    }
    default:
      answer = `Unknown query type: ${query.type}. Supported: who, what, when, where, conflicts, supports`;
  }

  // Store query for audit
  await prisma.factQuery.create({
    data: {
      caseId,
      queryType: query.type,
      queryFilters: query.filters || {},
      resultCount: results.length,
      answer,
      metadata: { queriedAt: new Date().toISOString() },
    },
  });

  return { results, answer, resultCount: results.length };
}

export async function getCaseQueryHistory(caseId) {
  return prisma.factQuery.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
