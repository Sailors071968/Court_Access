// ============================================
// Court Access — Misidentification Risk Engine
// Phase 130: Evaluate witness identification reliability
//
// Factors: distance, lighting, observation time, stress,
// lineup fairness, similar individuals
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Evaluate misidentification risk for a witness.
 * @param {string} caseId
 * @param {string} witnessName
 * @param {object} factors - Risk factors
 * @returns {object} MisidentificationRisk record
 */
export async function evaluateMisidentificationRisk(caseId, witnessName, factors = {}) {
  console.log(`[MisidentificationRisk] Evaluating risk for "${witnessName}" in case ${caseId}`);

  const distanceScore = factors.distance ?? 0.5;
  const lightingScore = factors.lighting ?? 0.5;
  const observationTimeScore = factors.observationTime ?? 0.5;
  const stressScore = factors.stress ?? 0.5;
  const lineupFairnessScore = factors.lineupFairness ?? 0.5;
  const similarIndividualsScore = factors.similarIndividuals ?? 0.5;

  // Weighted risk calculation (higher = more risk)
  const weights = {
    distance: 0.20,
    lighting: 0.20,
    observationTime: 0.15,
    stress: 0.15,
    lineupFairness: 0.15,
    similarIndividuals: 0.15,
  };

  const overallRiskScore = Math.round((
    (1 - distanceScore) * weights.distance +
    (1 - lightingScore) * weights.lighting +
    (1 - observationTimeScore) * weights.observationTime +
    (1 - stressScore) * weights.stress +
    (1 - lineupFairnessScore) * weights.lineupFairness +
    (1 - similarIndividualsScore) * weights.similarIndividuals
  ) * 100) / 100;

  let riskLevel = 'low';
  if (overallRiskScore >= 0.75) riskLevel = 'critical';
  else if (overallRiskScore >= 0.55) riskLevel = 'high';
  else if (overallRiskScore >= 0.35) riskLevel = 'medium';

  const record = await prisma.misidentificationRisk.create({
    data: {
      caseId,
      witnessName,
      distanceScore,
      lightingScore,
      observationTimeScore,
      stressScore,
      lineupFairnessScore,
      similarIndividualsScore,
      overallRiskScore,
      riskLevel,
      factors: weights,
      metadata: {
        evaluatedAt: new Date().toISOString(),
        inputFactors: factors,
      },
    },
  });

  console.log(`[MisidentificationRisk] Witness "${witnessName}" risk: ${riskLevel} (${overallRiskScore})`);
  return record;
}

/**
 * Auto-evaluate misidentification risk from case data.
 * @param {string} caseId
 * @param {string} witnessName
 * @returns {object} MisidentificationRisk record
 */
export async function autoEvaluateMisidentificationRisk(caseId, witnessName) {
  const statements = await prisma.transcriptStatement.findMany({
    where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } },
  });

  const text = statements.map(s => s.statementText.toLowerCase()).join(' ');

  const factors = {
    distance: inferDistance(text),
    lighting: inferLighting(text),
    observationTime: inferObservationTime(text),
    stress: inferStress(text),
    lineupFairness: inferLineupFairness(text),
    similarIndividuals: inferSimilarIndividuals(text),
  };

  return evaluateMisidentificationRisk(caseId, witnessName, factors);
}

function inferDistance(text) {
  const distMatch = text.match(/(\d+)\s*(?:feet|ft|yards|meters)/);
  if (distMatch) {
    const d = parseInt(distMatch[1], 10);
    if (d <= 10) return 0.95;
    if (d <= 50) return 0.7;
    if (d <= 150) return 0.4;
    return 0.15;
  }
  if (text.includes('close') || text.includes('next to')) return 0.85;
  if (text.includes('across the street') || text.includes('far')) return 0.3;
  return 0.5;
}

function inferLighting(text) {
  if (text.includes('daylight') || text.includes('well-lit') || text.includes('bright')) return 0.9;
  if (text.includes('streetlight') || text.includes('dim')) return 0.5;
  if (text.includes('dark') || text.includes('night') || text.includes('no light')) return 0.15;
  return 0.5;
}

function inferObservationTime(text) {
  const timeMatch = text.match(/(\d+)\s*(?:seconds?|minutes?|mins?)/);
  if (timeMatch) {
    const val = parseInt(timeMatch[1], 10);
    const unit = timeMatch[2].toLowerCase();
    const seconds = unit.startsWith('min') ? val * 60 : val;
    if (seconds >= 60) return 0.9;
    if (seconds >= 15) return 0.6;
    if (seconds >= 5) return 0.3;
    return 0.1;
  }
  if (text.includes('briefly') || text.includes('glimpse') || text.includes('flash')) return 0.2;
  if (text.includes('watched') || text.includes('observed')) return 0.7;
  return 0.5;
}

function inferStress(text) {
  if (text.includes('calm') || text.includes('relaxed')) return 0.9;
  if (text.includes('nervous')) return 0.5;
  if (text.includes('weapon') || text.includes('gun') || text.includes('knife') || text.includes('terrified')) return 0.15;
  return 0.5;
}

function inferLineupFairness(text) {
  if (text.includes('photo array') || text.includes('lineup')) {
    if (text.includes('double-blind') || text.includes('sequential')) return 0.85;
    if (text.includes('simultaneous')) return 0.5;
    if (text.includes('show-up') || text.includes('suggestive')) return 0.15;
  }
  return 0.5;
}

function inferSimilarIndividuals(text) {
  if (text.includes('distinctive') || text.includes('unique') || text.includes('tattoo') || text.includes('scar')) return 0.85;
  if (text.includes('similar') || text.includes('common') || text.includes('average')) return 0.3;
  return 0.5;
}

export async function getCaseMisidentificationRisks(caseId) {
  return prisma.misidentificationRisk.findMany({
    where: { caseId },
    orderBy: { overallRiskScore: 'desc' },
  });
}
