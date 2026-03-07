// ============================================
// Court Access — Fact Corroboration Service
// Phase D: Determine which facts are corroborated
// by independent evidence sources
// ============================================

import prisma from './prismaClient.js';

/**
 * Analyze fact corroboration across a case.
 * @param {string} caseId
 * @returns {{ corroborations: object[], summary: object }}
 */
export async function analyzeFactCorroboration(caseId) {
  console.log(`[FactCorroboration] Analyzing corroboration for case ${caseId}`);

  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, verificationStatus: { not: 'merged' } },
    orderBy: { createdAt: 'asc' },
  });

  // Group facts by normalized value and type
  const groups = new Map();
  for (const fact of facts) {
    const key = `${fact.factType}:${fact.normalizedValue}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fact);
  }

  const corroborations = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    // Check independence: different documents
    const documents = [...new Set(group.map(f => f.documentId))];
    if (documents.length < 2) continue;

    // Check speaker independence
    const speakers = [...new Set(group.filter(f => f.speaker).map(f => f.speaker))];
    const isIndependent = speakers.length >= 2 || documents.length >= 2;

    if (!isIndependent) continue;

    const corroboration = {
      caseId,
      factKey: key,
      factType: group[0].factType,
      normalizedValue: group[0].normalizedValue,
      corroboratingFactIds: group.map(f => f.id),
      sourceCount: documents.length,
      speakerCount: speakers.length,
      isIndependent: true,
      corroborationStrength: calculateCorroborationStrength(group),
      metadata: {
        documents,
        speakers,
        confidences: group.map(f => f.confidence),
        avgConfidence: Math.round((group.reduce((s, f) => s + f.confidence, 0) / group.length) * 100) / 100,
      },
    };

    corroborations.push(corroboration);

    // Store
    try {
      await prisma.factCorroborationRecord.create({ data: corroboration });
    } catch (err) {
      if (!err.message.includes('Unique constraint')) {
        console.warn(`[FactCorroboration] Store error: ${err.message}`);
      }
    }

    // Update verification status for corroborated facts
    for (const fact of group) {
      if (fact.verificationStatus === 'unverified') {
        await prisma.verifiedFact.update({
          where: { id: fact.id },
          data: { verificationStatus: 'corroborated' },
        });
      }
    }
  }

  console.log(`[FactCorroboration] Found ${corroborations.length} corroborated fact groups for case ${caseId}`);

  return {
    corroborations,
    summary: {
      totalFacts: facts.length,
      corroboratedGroups: corroborations.length,
      corroboratedFacts: corroborations.reduce((s, c) => s + c.corroboratingFactIds.length, 0),
      uncorroboratedFacts: facts.length - corroborations.reduce((s, c) => s + c.corroboratingFactIds.length, 0),
      avgCorroborationStrength: corroborations.length > 0
        ? Math.round((corroborations.reduce((s, c) => s + c.corroborationStrength, 0) / corroborations.length) * 100) / 100
        : 0,
    },
  };
}

function calculateCorroborationStrength(factGroup) {
  const sourceCount = [...new Set(factGroup.map(f => f.documentId))].length;
  const speakerCount = [...new Set(factGroup.filter(f => f.speaker).map(f => f.speaker))].length;
  const avgConfidence = factGroup.reduce((s, f) => s + f.confidence, 0) / factGroup.length;

  let strength = 0;
  strength += Math.min(sourceCount * 0.2, 0.4); // Up to 0.4 for multiple sources
  strength += Math.min(speakerCount * 0.15, 0.3); // Up to 0.3 for multiple speakers
  strength += avgConfidence * 0.3; // Up to 0.3 for high confidence

  return Math.round(Math.min(strength, 1) * 100) / 100;
}

export async function getCaseCorroborationReport(caseId) {
  return prisma.factCorroborationRecord.findMany({
    where: { caseId },
    orderBy: { corroborationStrength: 'desc' },
  });
}
