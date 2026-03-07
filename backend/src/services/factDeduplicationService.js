// ============================================
// Court Access — Fact Deduplication Service
// Phase C: Detect and merge duplicate facts
// ============================================

import prisma from './prismaClient.js';

/**
 * Deduplicate facts within a case.
 * @param {string} caseId
 * @returns {{ merged: object[], summary: object }}
 */
export async function deduplicateFacts(caseId) {
  console.log(`[FactDedup] Deduplicating facts for case ${caseId}`);

  const facts = await prisma.verifiedFact.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map();

  for (const fact of facts) {
    const key = `${fact.factType}:${fact.normalizedValue}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fact);
  }

  const merged = [];
  const duplicatesFound = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    // Keep the one with highest confidence as canonical
    group.sort((a, b) => b.confidence - a.confidence);
    const canonical = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      // Only merge if they're truly the same fact
      const similarity = calculateFactSimilarity(canonical, dup);
      if (similarity < 0.7) continue;

      duplicatesFound.push({
        canonicalId: canonical.id,
        duplicateId: dup.id,
        similarity,
        key,
      });

      // Record dedup event
      try {
        await prisma.factDeduplication.create({
          data: {
            caseId,
            canonicalFactId: canonical.id,
            duplicateFactId: dup.id,
            similarity,
            mergeStrategy: 'highest_confidence',
            metadata: {
              canonicalConfidence: canonical.confidence,
              duplicateConfidence: dup.confidence,
              canonicalDocument: canonical.documentId,
              duplicateDocument: dup.documentId,
            },
          },
        });
      } catch (err) {
        if (!err.message.includes('Unique constraint')) {
          console.warn(`[FactDedup] Store error: ${err.message}`);
        }
      }

      // Mark duplicate as merged (don't delete, maintain audit trail)
      await prisma.verifiedFact.update({
        where: { id: dup.id },
        data: {
          verificationStatus: 'merged',
          metadata: { ...dup.metadata, mergedInto: canonical.id },
        },
      });
    }

    if (duplicates.length > 0) {
      merged.push({
        canonicalFact: canonical,
        duplicateCount: duplicates.length,
        key,
      });
    }
  }

  console.log(`[FactDedup] Found ${duplicatesFound.length} duplicates in ${merged.length} groups for case ${caseId}`);

  return {
    merged,
    summary: {
      totalFacts: facts.length,
      uniqueGroups: groups.size,
      duplicatesFound: duplicatesFound.length,
      mergedGroups: merged.length,
      deduplicationRate: facts.length > 0
        ? Math.round((duplicatesFound.length / facts.length) * 100)
        : 0,
    },
  };
}

function calculateFactSimilarity(factA, factB) {
  let score = 0;
  let weights = 0;

  // Normalized value match
  if (factA.normalizedValue === factB.normalizedValue) {
    score += 0.4;
  } else {
    const textSim = jaccardSimilarity(factA.normalizedValue, factB.normalizedValue);
    score += textSim * 0.4;
  }
  weights += 0.4;

  // Fact type match
  if (factA.factType === factB.factType) score += 0.2;
  weights += 0.2;

  // Speaker match
  if (factA.speaker && factB.speaker) {
    if (factA.speaker.toLowerCase() === factB.speaker.toLowerCase()) score += 0.15;
    weights += 0.15;
  }

  // Time proximity
  if (factA.timestamp && factB.timestamp) {
    const timeDiff = Math.abs(new Date(factA.timestamp).getTime() - new Date(factB.timestamp).getTime());
    if (timeDiff < 5 * 60 * 1000) score += 0.15; // Within 5 minutes
    else if (timeDiff < 60 * 60 * 1000) score += 0.08; // Within 1 hour
    weights += 0.15;
  }

  // Statement text similarity
  const textSim = jaccardSimilarity(factA.factText, factB.factText);
  score += textSim * 0.1;
  weights += 0.1;

  return weights > 0 ? Math.round((score / weights) * 100) / 100 : 0;
}

function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) { if (setB.has(w)) intersection++; }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export async function getCaseDeduplicationReport(caseId) {
  return prisma.factDeduplication.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
