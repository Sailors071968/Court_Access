// ============================================
// Court Access — Witness Reliability Analysis
// Phase 129: Evaluate witness credibility
//
// Factors: consistency, corroboration, visibility,
// distance, lighting, stress
// Output: credibility_score
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Analyze witness reliability for a case.
 * @param {string} caseId
 * @param {string} witnessName
 * @param {object} [factors] - Optional override factors
 * @returns {object} WitnessReliability record
 */
export async function analyzeWitnessReliability(caseId, witnessName, factors = {}) {
  console.log(`[WitnessReliability] Analyzing reliability for witness "${witnessName}" in case ${caseId}`);

  // Gather witness statements
  const statements = await prisma.transcriptStatement.findMany({
    where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } },
    orderBy: { extractedAt: 'asc' },
  });

  // Gather all facts mentioning this witness
  const facts = await prisma.extractedFact.findMany({
    where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } },
  });

  // Calculate individual scores
  const consistencyScore = factors.consistency ?? calculateConsistency(statements);
  const corroborationScore = factors.corroboration ?? await calculateCorroboration(caseId, facts);
  const visibilityScore = factors.visibility ?? extractVisibilityScore(statements);
  const distanceScore = factors.distance ?? extractDistanceScore(statements);
  const lightingScore = factors.lighting ?? extractLightingScore(statements);
  const stressScore = factors.stress ?? extractStressScore(statements);

  // Composite credibility score (weighted average)
  const weights = {
    consistency: 0.25,
    corroboration: 0.25,
    visibility: 0.15,
    distance: 0.10,
    lighting: 0.10,
    stress: 0.15,
  };

  const credibilityScore = Math.round((
    consistencyScore * weights.consistency +
    corroborationScore * weights.corroboration +
    visibilityScore * weights.visibility +
    distanceScore * weights.distance +
    lightingScore * weights.lighting +
    stressScore * weights.stress
  ) * 100) / 100;

  const record = await prisma.witnessReliability.create({
    data: {
      caseId,
      witnessName,
      consistencyScore,
      corroborationScore,
      visibilityScore,
      distanceScore,
      lightingScore,
      stressScore,
      credibilityScore,
      factorsUsed: weights,
      evidenceSources: statements.map(s => ({ statementId: s.id, transcriptId: s.transcriptId })),
      metadata: {
        statementCount: statements.length,
        factCount: facts.length,
      },
    },
  });

  console.log(`[WitnessReliability] Witness "${witnessName}" credibility: ${credibilityScore}`);
  return record;
}

function calculateConsistency(statements) {
  if (statements.length < 2) return 0.5;

  // Check for contradictions within same witness's statements
  let contradictions = 0;
  const OPPOSING = [
    ['left', 'entered'], ['before', 'after'], ['yes', 'no'],
    ['saw', 'did not see'], ['heard', 'did not hear'],
  ];

  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      const a = statements[i].statementText.toLowerCase();
      const b = statements[j].statementText.toLowerCase();
      for (const [termA, termB] of OPPOSING) {
        if ((a.includes(termA) && b.includes(termB)) || (a.includes(termB) && b.includes(termA))) {
          contradictions++;
        }
      }
    }
  }

  const maxPairs = (statements.length * (statements.length - 1)) / 2;
  return Math.max(0, 1 - (contradictions / Math.max(maxPairs, 1)));
}

async function calculateCorroboration(caseId, witnessFacts) {
  if (witnessFacts.length === 0) return 0.5;

  const allFacts = await prisma.extractedFact.findMany({ where: { caseId } });
  let corroborated = 0;

  for (const wFact of witnessFacts) {
    const hasCorroboration = allFacts.some(f =>
      f.id !== wFact.id &&
      f.documentId !== wFact.documentId &&
      f.normalizedValue === wFact.normalizedValue
    );
    if (hasCorroboration) corroborated++;
  }

  return witnessFacts.length > 0 ? corroborated / witnessFacts.length : 0.5;
}

function extractVisibilityScore(statements) {
  const text = statements.map(s => s.statementText.toLowerCase()).join(' ');
  if (text.includes('clearly') || text.includes('close') || text.includes('face to face')) return 0.9;
  if (text.includes('partially') || text.includes('side view')) return 0.6;
  if (text.includes('far') || text.includes('glimpse') || text.includes('brief')) return 0.3;
  return 0.5;
}

function extractDistanceScore(statements) {
  const text = statements.map(s => s.statementText.toLowerCase()).join(' ');
  const distMatch = text.match(/(\d+)\s*(?:feet|ft|yards|meters|m)\s*(?:away)?/);
  if (distMatch) {
    const dist = parseInt(distMatch[1], 10);
    if (dist <= 10) return 0.95;
    if (dist <= 30) return 0.8;
    if (dist <= 100) return 0.5;
    if (dist <= 300) return 0.3;
    return 0.1;
  }
  return 0.5;
}

function extractLightingScore(statements) {
  const text = statements.map(s => s.statementText.toLowerCase()).join(' ');
  if (text.includes('daylight') || text.includes('well lit') || text.includes('bright')) return 0.9;
  if (text.includes('streetlight') || text.includes('dim')) return 0.5;
  if (text.includes('dark') || text.includes('night') || text.includes('no light')) return 0.2;
  return 0.5;
}

function extractStressScore(statements) {
  const text = statements.map(s => s.statementText.toLowerCase()).join(' ');
  // Higher stress = lower reliability
  if (text.includes('calm') || text.includes('relaxed')) return 0.9;
  if (text.includes('nervous') || text.includes('anxious')) return 0.5;
  if (text.includes('terrified') || text.includes('panic') || text.includes('gun') || text.includes('weapon')) return 0.2;
  return 0.5;
}

export async function getCaseWitnessReliability(caseId) {
  return prisma.witnessReliability.findMany({
    where: { caseId },
    orderBy: { credibilityScore: 'desc' },
  });
}

export async function getWitnessReliability(caseId, witnessName) {
  return prisma.witnessReliability.findFirst({
    where: { caseId, witnessName },
    orderBy: { createdAt: 'desc' },
  });
}
