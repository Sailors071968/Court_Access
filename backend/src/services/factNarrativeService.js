// ============================================
// Court Access — Fact-Based Narrative Comparison
// Phase H: Compare narratives against verified facts
// to identify unsupported claims
// ============================================

import prisma from './prismaClient.js';

/**
 * Compare a narrative against the verified fact base.
 * @param {string} caseId
 * @param {string} narrativeId
 * @returns {{ supported: object[], unsupported: object[], summary: object }}
 */
export async function compareNarrativeToFacts(caseId, narrativeId) {
  console.log(`[FactNarrative] Comparing narrative ${narrativeId} to facts for case ${caseId}`);

  const narrative = await prisma.caseNarrative.findUnique({ where: { id: narrativeId } });
  if (!narrative) throw new Error(`Narrative ${narrativeId} not found`);

  const facts = await prisma.verifiedFact.findMany({
    where: { caseId, verificationStatus: { not: 'merged' } },
  });

  const supported = [];
  const unsupported = [];
  const sections = narrative.sections || [];

  for (const section of sections) {
    const claims = extractClaims(section.content || '');

    for (const claim of claims) {
      const support = findSupportingFacts(claim, facts);

      if (support.length > 0) {
        supported.push({
          section: section.title,
          claim,
          supportingFacts: support.map(f => ({
            id: f.id,
            factText: f.factText,
            confidence: f.confidence,
            verificationStatus: f.verificationStatus,
          })),
          strength: Math.max(...support.map(f => f.confidence)),
        });
      } else {
        unsupported.push({
          section: section.title,
          claim,
          reason: 'No verified facts support this claim',
        });
      }
    }
  }

  // Store comparison
  await prisma.narrativeFactComparison.create({
    data: {
      caseId,
      narrativeId,
      perspective: narrative.perspective,
      supportedClaims: supported,
      unsupportedClaims: unsupported,
      supportRate: (supported.length + unsupported.length) > 0
        ? Math.round((supported.length / (supported.length + unsupported.length)) * 100) / 100
        : 0,
      metadata: { comparedAt: new Date().toISOString() },
    },
  });

  return {
    supported,
    unsupported,
    summary: {
      totalClaims: supported.length + unsupported.length,
      supportedCount: supported.length,
      unsupportedCount: unsupported.length,
      supportRate: (supported.length + unsupported.length) > 0
        ? Math.round((supported.length / (supported.length + unsupported.length)) * 100)
        : 0,
    },
  };
}

function extractClaims(text) {
  if (!text || text.length < 10) return [];

  // Split into sentences and filter meaningful claims
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

  // Filter out meta-statements
  return sentences.filter(s => {
    const lower = s.toLowerCase();
    return !lower.startsWith('no ') &&
           !lower.startsWith('the following') &&
           !lower.includes('available') &&
           !lower.includes('not available');
  });
}

function findSupportingFacts(claim, facts) {
  const claimWords = new Set(claim.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (claimWords.size === 0) return [];

  return facts.filter(fact => {
    const factWords = new Set(fact.factText.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    let overlap = 0;
    for (const w of claimWords) { if (factWords.has(w)) overlap++; }
    const similarity = overlap / Math.max(claimWords.size, 1);
    return similarity > 0.3;
  });
}

export async function getCaseNarrativeFactComparisons(caseId) {
  return prisma.narrativeFactComparison.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
