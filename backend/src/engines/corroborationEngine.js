// ============================================
// Court Access — Corroboration Matrix Engine
// Phase 136: Build corroboration matrix showing
// which evidence supports/contradicts other evidence
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Build a corroboration matrix for all evidence in a case.
 * @param {string} caseId
 * @returns {{ matrix: object[], summary: object }}
 */
export async function buildCorroborationMatrix(caseId) {
  console.log(`[Corroboration] Building matrix for case ${caseId}`);

  const evidence = await prisma.evidenceRegistry.findMany({ where: { caseId } });
  const facts = await prisma.extractedFact.findMany({ where: { caseId } });
  const correlations = await prisma.factCorrelation.findMany({ where: { caseId } });

  // Group facts by document
  const factsByDoc = new Map();
  for (const fact of facts) {
    if (!factsByDoc.has(fact.documentId)) factsByDoc.set(fact.documentId, []);
    factsByDoc.get(fact.documentId).push(fact);
  }

  const matrix = [];

  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const evA = evidence[i];
      const evB = evidence[j];

      const factsA = factsByDoc.get(evA.evidenceId) || [];
      const factsB = factsByDoc.get(evB.evidenceId) || [];

      let supports = 0;
      let contradicts = 0;
      let neutral = 0;

      // Compare facts between two evidence items
      for (const fA of factsA) {
        for (const fB of factsB) {
          if (fA.factType !== fB.factType) continue;
          if (fA.normalizedValue === fB.normalizedValue) {
            supports++;
          } else if (fA.factType === 'TIME' || fA.factType === 'LOCATION') {
            // Different time/location for same context may be contradictory
            const contextSim = simpleOverlap(fA.statementText, fB.statementText);
            if (contextSim > 0.3) contradicts++;
            else neutral++;
          } else {
            neutral++;
          }
        }
      }

      // Check correlations between these two documents
      const relatedCorrs = correlations.filter(c => {
        const factIds = [...factsA.map(f => f.id), ...factsB.map(f => f.id)];
        return factIds.includes(c.factAId) && factIds.includes(c.factBId);
      });

      for (const corr of relatedCorrs) {
        if (corr.correlationType === 'matching_event' || corr.correlationType === 'duplicate_mention') supports++;
        if (corr.correlationType === 'timeline_inconsistency' || corr.correlationType === 'location_conflict') contradicts++;
      }

      let relationship = 'neutral';
      if (supports > contradicts && supports > 0) relationship = 'supporting';
      if (contradicts > supports && contradicts > 0) relationship = 'contradicting';
      if (supports > 0 && contradicts > 0) relationship = 'mixed';

      const strength = Math.round(Math.max(supports, contradicts) / Math.max(supports + contradicts + neutral, 1) * 100) / 100;

      matrix.push({
        caseId,
        evidenceAId: evA.evidenceId,
        evidenceBId: evB.evidenceId,
        relationship,
        supportingFactCount: supports,
        contradictingFactCount: contradicts,
        neutralFactCount: neutral,
        strength,
        correlationIds: relatedCorrs.map(c => c.id),
        metadata: {
          evidenceAType: evA.evidenceType,
          evidenceBType: evB.evidenceType,
        },
      });
    }
  }

  // Store matrix entries
  const stored = [];
  for (const entry of matrix) {
    try {
      const record = await prisma.corroborationMatrix.create({ data: entry });
      stored.push(record);
    } catch (err) {
      console.warn(`[Corroboration] Store error: ${err.message}`);
    }
  }

  console.log(`[Corroboration] Built matrix with ${stored.length} relationships for case ${caseId}`);

  return {
    matrix: stored,
    summary: {
      totalRelationships: stored.length,
      supporting: stored.filter(m => m.relationship === 'supporting').length,
      contradicting: stored.filter(m => m.relationship === 'contradicting').length,
      mixed: stored.filter(m => m.relationship === 'mixed').length,
      neutral: stored.filter(m => m.relationship === 'neutral').length,
      avgStrength: stored.length > 0
        ? Math.round((stored.reduce((s, m) => s + m.strength, 0) / stored.length) * 100) / 100
        : 0,
    },
  };
}

function simpleOverlap(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  let overlap = 0;
  for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

export async function getCaseCorroborationMatrix(caseId) {
  return prisma.corroborationMatrix.findMany({
    where: { caseId },
    orderBy: { strength: 'desc' },
  });
}
