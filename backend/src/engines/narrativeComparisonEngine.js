// ============================================
// Court Access — Narrative Comparison Engine
// Phase 138: Compare defense vs prosecution narratives
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Compare two case narratives (defense vs prosecution).
 * @param {string} caseId
 * @returns {object} NarrativeComparison record
 */
export async function compareNarratives(caseId) {
  console.log(`[NarrativeComparison] Comparing narratives for case ${caseId}`);

  const narratives = await prisma.caseNarrative.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });

  const defense = narratives.find(n => (n.modelVersion || n.metadata?.perspective) === 'defense');
  const prosecution = narratives.find(n => (n.modelVersion || n.metadata?.perspective) === 'prosecution');

  if (!defense || !prosecution) {
    console.warn('[NarrativeComparison] Both defense and prosecution narratives required');
    return null;
  }

  const defenseEvidence = new Set(defense.metadata?.evidenceIds || []);
  const prosecutionEvidence = new Set(prosecution.metadata?.evidenceIds || []);

  const sharedEvidence = [...defenseEvidence].filter(e => prosecutionEvidence.has(e));
  const defenseOnly = [...defenseEvidence].filter(e => !prosecutionEvidence.has(e));
  const prosecutionOnly = [...prosecutionEvidence].filter(e => !defenseEvidence.has(e));

  const defenseSections = defense.metadata?.sections || defense.keyEvents || [];
  const prosecutionSections = prosecution.metadata?.sections || prosecution.keyEvents || [];
  const agreementPoints = findAgreementPoints(defenseSections, prosecutionSections);
  const disagreementPoints = findDisagreementPoints(defenseSections, prosecutionSections);

  const comparison = await prisma.narrativeComparison.create({
    data: {
      caseId,
      defenseNarrativeId: defense.id,
      prosecutionNarrativeId: prosecution.id,
      sharedEvidenceIds: sharedEvidence,
      defenseOnlyEvidenceIds: defenseOnly,
      prosecutionOnlyEvidenceIds: prosecutionOnly,
      agreementPoints,
      disagreementPoints,
      overallAlignment: calculateAlignment(sharedEvidence.length, defenseOnly.length, prosecutionOnly.length),
      metadata: {
        defenseConfidence: defense.metadata?.confidenceScore || 0,
        prosecutionConfidence: prosecution.metadata?.confidenceScore || 0,
        comparedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`[NarrativeComparison] Comparison complete: ${agreementPoints.length} agreements, ${disagreementPoints.length} disagreements`);
  return comparison;
}

function findAgreementPoints(defenseSections, prosecutionSections) {
  const agreements = [];
  if (!Array.isArray(defenseSections) || !Array.isArray(prosecutionSections)) return agreements;

  for (const ds of defenseSections) {
    for (const ps of prosecutionSections) {
      if (ds.title === ps.title) {
        const overlap = contentOverlap(ds.content, ps.content);
        if (overlap > 0.3) {
          agreements.push({
            section: ds.title,
            overlapScore: overlap,
            description: `Both narratives agree on "${ds.title}" content (${Math.round(overlap * 100)}% overlap)`,
          });
        }
      }
    }
  }
  return agreements;
}

function findDisagreementPoints(defenseSections, prosecutionSections) {
  const disagreements = [];
  if (!Array.isArray(defenseSections) || !Array.isArray(prosecutionSections)) return disagreements;

  for (const ds of defenseSections) {
    for (const ps of prosecutionSections) {
      if (ds.title === ps.title) {
        const overlap = contentOverlap(ds.content, ps.content);
        if (overlap < 0.3 && ds.content.length > 20 && ps.content.length > 20) {
          disagreements.push({
            section: ds.title,
            overlapScore: overlap,
            defensePosition: ds.content.substring(0, 200),
            prosecutionPosition: ps.content.substring(0, 200),
            description: `Narratives diverge on "${ds.title}" (only ${Math.round(overlap * 100)}% overlap)`,
          });
        }
      }
    }
  }
  return disagreements;
}

function contentOverlap(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  let overlap = 0;
  for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

function calculateAlignment(shared, defenseOnly, prosecutionOnly) {
  const total = shared + defenseOnly + prosecutionOnly;
  if (total === 0) return 0.5;
  return Math.round((shared / total) * 100) / 100;
}

export async function getCaseNarrativeComparisons(caseId) {
  return prisma.narrativeComparison.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
}
