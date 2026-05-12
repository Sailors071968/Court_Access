// ============================================================================
// Phase C.5 — Materiality Scoring
// Scores: LOW | MEDIUM | HIGH | CRITICAL
// Based ONLY on:
//   - Prosecution burden impact
//   - Witness inconsistency
//   - Timeline incompatibility
//   - Evidentiary impossibility
//   - Missing corroboration
// NO legal conclusions. NO innocence/guilt claims.
// ============================================================================

import prisma from '../lib/prisma.js';
import type { Contradiction } from './contradictionEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MaterialityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MaterialityScore {
  level: MaterialityLevel;
  numericScore: number; // 0.0 - 1.0
  factors: MaterialityFactor[];
  summary: string;
}

export interface MaterialityFactor {
  category: string;
  description: string;
  weight: number;
  detected: boolean;
}

export interface ScoredContradiction extends Contradiction {
  materiality: MaterialityScore;
}

export interface ChargeMaterialityResult {
  chargeId: string;
  instructionNumber: number | null;
  elements: ElementMaterialityResult[];
  overallAssessment: {
    totalContradictions: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    highestLevel: MaterialityLevel;
    prosecutionBurdenWeaknesses: string[];
  };
}

export interface ElementMaterialityResult {
  elementId: string;
  elementNumber: number;
  elementLabel: string;
  isEssential: boolean;
  scoredContradictions: ScoredContradiction[];
}

// ---------------------------------------------------------------------------
// Materiality Factor Detectors
// ---------------------------------------------------------------------------

function detectProsecutionBurdenImpact(
  contradiction: Contradiction,
  isEssential: boolean,
): MaterialityFactor {
  const isDirectContradiction = contradiction.contradictionType === 'support_contradiction';
  const detected = isEssential && isDirectContradiction;

  return {
    category: 'prosecution_burden_impact',
    description: detected
      ? `Direct contradiction on essential element "${contradiction.elementLabel}" undermines prosecution burden of proof`
      : 'No direct impact on prosecution burden detected',
    weight: 0.35,
    detected,
  };
}

function detectWitnessInconsistency(contradiction: Contradiction): MaterialityFactor {
  const isSpeakerInconsistency = contradiction.contradictionType === 'speaker_inconsistency';
  const hasDifferentSpeakers =
    contradiction.statementA.speaker !== null &&
    contradiction.statementB.speaker !== null &&
    contradiction.statementA.speaker !== contradiction.statementB.speaker;

  const detected = isSpeakerInconsistency || hasDifferentSpeakers;

  return {
    category: 'witness_inconsistency',
    description: detected
      ? `Witness inconsistency: ${contradiction.statementA.speaker || 'Unknown'} vs ${contradiction.statementB.speaker || 'Unknown'}`
      : 'No witness inconsistency detected',
    weight: 0.25,
    detected,
  };
}

function detectTimelineIncompatibility(contradiction: Contradiction): MaterialityFactor {
  const isTemporal = contradiction.contradictionType === 'temporal_incompatibility';
  const hasTimestamps =
    contradiction.statementA.timestamp !== null && contradiction.statementB.timestamp !== null;

  const detected = isTemporal || (hasTimestamps && contradiction.contradictionType === 'cross_source_contradiction');

  return {
    category: 'timeline_incompatibility',
    description: detected
      ? `Timeline conflict: ${contradiction.statementA.timestamp || 'N/A'} vs ${contradiction.statementB.timestamp || 'N/A'}`
      : 'No timeline incompatibility detected',
    weight: 0.20,
    detected,
  };
}

function detectEvidentiaryImpossibility(contradiction: Contradiction): MaterialityFactor {
  // Look for patterns suggesting physical/logical impossibility
  const textA = contradiction.statementA.rawText.toLowerCase();
  const textB = contradiction.statementB.rawText.toLowerCase();

  const impossibilityPatterns = [
    /\bnot possible\b/,
    /\bimpossible\b/,
    /\bcannot have\b/,
    /\bcould not have\b/,
    /\bphysically impossible\b/,
    /\bcontradicts physical evidence\b/,
    /\bforensic.*inconsistent\b/,
    /\bdna.*excludes?\b/,
    /\bfingerprint.*not match\b/,
  ];

  const detected = impossibilityPatterns.some(
    (p) => p.test(textA) || p.test(textB),
  );

  return {
    category: 'evidentiary_impossibility',
    description: detected
      ? 'Physical or forensic evidence suggests factual impossibility'
      : 'No evidentiary impossibility detected',
    weight: 0.15,
    detected,
  };
}

function detectMissingCorroboration(
  contradiction: Contradiction,
  allLinksForElement: number,
): MaterialityFactor {
  // If there are very few links for this element, the contradiction
  // is more material because there's less corroborating evidence
  const detected = allLinksForElement <= 2 && contradiction.contradictionType !== 'support_contradiction';
  const fewLinks = allLinksForElement <= 3;

  return {
    category: 'missing_corroboration',
    description: fewLinks
      ? `Only ${allLinksForElement} statements linked to this element — limited corroboration available`
      : 'Sufficient corroborating evidence exists for this element',
    weight: 0.05,
    detected,
  };
}

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

function calculateMaterialityScore(factors: MaterialityFactor[]): { level: MaterialityLevel; numericScore: number } {
  let weightedScore = 0;

  for (const factor of factors) {
    if (factor.detected) {
      weightedScore += factor.weight;
    }
  }

  // Normalize to 0-1 range
  const score = Math.min(1.0, Math.max(0.0, weightedScore));

  let level: MaterialityLevel;
  if (score >= 0.7) level = 'CRITICAL';
  else if (score >= 0.45) level = 'HIGH';
  else if (score >= 0.25) level = 'MEDIUM';
  else level = 'LOW';

  return { level, numericScore: Math.round(score * 100) / 100 };
}

function generateSummary(factors: MaterialityFactor[], level: MaterialityLevel): string {
  const detected = factors.filter((f) => f.detected);
  if (detected.length === 0) {
    return 'No significant materiality factors detected.';
  }

  const descriptions = detected.map((f) => f.category.replace(/_/g, ' ')).join(', ');
  return `${level} materiality: ${descriptions}.`;
}

// ---------------------------------------------------------------------------
// Score a Single Contradiction
// ---------------------------------------------------------------------------

export function scoreContradiction(
  contradiction: Contradiction,
  isEssential: boolean,
  totalLinksForElement: number,
): MaterialityScore {
  const factors: MaterialityFactor[] = [
    detectProsecutionBurdenImpact(contradiction, isEssential),
    detectWitnessInconsistency(contradiction),
    detectTimelineIncompatibility(contradiction),
    detectEvidentiaryImpossibility(contradiction),
    detectMissingCorroboration(contradiction, totalLinksForElement),
  ];

  const { level, numericScore } = calculateMaterialityScore(factors);
  const summary = generateSummary(factors, level);

  return { level, numericScore, factors, summary };
}

// ---------------------------------------------------------------------------
// Score All Contradictions for a Charge
// ---------------------------------------------------------------------------

export async function scoreChargeContradictions(
  chargeId: string,
  contradictionResults: {
    instructionNumber: number | null;
    elementResults: Array<{
      elementId: string;
      elementLabel: string;
      contradictions: Contradiction[];
    }>;
  },
): Promise<ChargeMaterialityResult> {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: {
      calcrimInstruction: {
        include: {
          elements: { orderBy: { elementNumber: 'asc' } },
        },
      },
    },
  });

  const elements: ElementMaterialityResult[] = [];
  let totalContradictions = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let highestLevel: MaterialityLevel = 'LOW';
  const weaknesses: string[] = [];

  for (const elemResult of contradictionResults.elementResults) {
    const element = charge?.calcrimInstruction?.elements.find((e) => e.id === elemResult.elementId);
    const isEssential = element?.isEssential ?? true;

    // Count total links for context
    const linkCount = await prisma.elementStatementLink.count({
      where: { chargeId, elementId: elemResult.elementId },
    });

    const scoredContradictions: ScoredContradiction[] = elemResult.contradictions.map((c) => {
      const materiality = scoreContradiction(c, isEssential, linkCount);
      totalContradictions++;

      switch (materiality.level) {
        case 'CRITICAL': criticalCount++; break;
        case 'HIGH': highCount++; break;
        case 'MEDIUM': mediumCount++; break;
        case 'LOW': lowCount++; break;
      }

      if (materiality.level === 'CRITICAL' || materiality.level === 'HIGH') {
        weaknesses.push(
          `Element ${element?.elementNumber ?? '?'} ("${elemResult.elementLabel}"): ${materiality.level} — ${materiality.summary}`,
        );
      }

      return { ...c, materiality };
    });

    elements.push({
      elementId: elemResult.elementId,
      elementNumber: element?.elementNumber ?? 0,
      elementLabel: elemResult.elementLabel,
      isEssential,
      scoredContradictions,
    });
  }

  // Determine highest level
  if (criticalCount > 0) highestLevel = 'CRITICAL';
  else if (highCount > 0) highestLevel = 'HIGH';
  else if (mediumCount > 0) highestLevel = 'MEDIUM';

  return {
    chargeId,
    instructionNumber: contradictionResults.instructionNumber,
    elements,
    overallAssessment: {
      totalContradictions,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      highestLevel,
      prosecutionBurdenWeaknesses: weaknesses,
    },
  };
}
