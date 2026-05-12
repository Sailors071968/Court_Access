// ============================================================================
// Phase C.6 — Defense Intelligence Output
// Element-centric defense analysis reports.
// Every output MUST include: exact citations, pages, timestamps, speakers,
// linked CALCRIM element, contradiction explanation, materiality score.
// NO unsupported AI summaries.
// ============================================================================

import prisma from '../lib/prisma.js';
import { analyzeChargeContradictions } from './contradictionEngine.js';
import { scoreChargeContradictions, type ChargeMaterialityResult } from './materialityScoring.js';
import { getElementCoverage } from './elementMappingEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DefenseReport {
  reportId: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  chargeId: string;
  chargeSummary: {
    code: string;
    section: string;
    title: string | null;
    instructionNumber: number | null;
    instructionTitle: string | null;
    intentType: string | null;
  };
  elementAnalysis: ElementAnalysis[];
  contradictionSummary: {
    totalContradictions: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    highestLevel: string;
  };
  prosecutionWeaknesses: string[];
  defensePriorities: DefensePriority[];
}

export interface ElementAnalysis {
  elementNumber: number;
  label: string;
  prosecutionBurden: string;
  isEssential: boolean;
  coverage: 'covered' | 'partially_covered' | 'uncovered';
  supportingEvidence: CitedEvidence[];
  contradictingEvidence: CitedEvidence[];
  contradictions: CitedContradiction[];
  defenseOpportunity: string | null;
}

export interface CitedEvidence {
  statementId: string;
  sourceDocumentId: string;
  page: number | null;
  lineStart: number | null;
  lineEnd: number | null;
  timestamp: string | null;
  speaker: string | null;
  rawText: string;
  confidence: number;
  matchMethod: string;
}

export interface CitedContradiction {
  contradictionType: string;
  materialityLevel: string;
  materialityScore: number;
  factualDomain: string;
  explanation: string;
  statementA: {
    statementId: string;
    sourceDocumentId: string;
    page: number | null;
    lineStart: number | null;
    lineEnd: number | null;
    timestamp: string | null;
    speaker: string | null;
    rawText: string;
  };
  statementB: {
    statementId: string;
    sourceDocumentId: string;
    page: number | null;
    lineStart: number | null;
    lineEnd: number | null;
    timestamp: string | null;
    speaker: string | null;
    rawText: string;
  };
}

export interface DefensePriority {
  priority: number;
  elementNumber: number;
  elementLabel: string;
  reason: string;
  materialityLevel: string;
  contradictionCount: number;
  actionableInsight: string;
}

// ---------------------------------------------------------------------------
// Defense Opportunity Identification
// ---------------------------------------------------------------------------

function identifyDefenseOpportunity(
  elementLabel: string,
  isEssential: boolean,
  coverage: string,
  contradictingCount: number,
  supportingCount: number,
): string | null {
  if (!isEssential) return null;

  if (coverage === 'uncovered') {
    return `Element "${elementLabel}" has NO supporting evidence — prosecution cannot meet burden of proof for this element.`;
  }

  if (contradictingCount > 0 && supportingCount === 0) {
    return `Element "${elementLabel}" has ONLY contradicting evidence — prosecution evidence directly undermines this required element.`;
  }

  if (contradictingCount > supportingCount) {
    return `Element "${elementLabel}" has more contradicting (${contradictingCount}) than supporting (${supportingCount}) evidence — prosecution burden weakened.`;
  }

  if (contradictingCount > 0) {
    return `Element "${elementLabel}" has ${contradictingCount} contradicting statement(s) — cross-examination opportunity.`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Generate Defense Priorities
// ---------------------------------------------------------------------------

function generatePriorities(
  elements: ElementAnalysis[],
  materialityResult: ChargeMaterialityResult,
): DefensePriority[] {
  const priorities: DefensePriority[] = [];

  for (const elem of elements) {
    if (!elem.isEssential) continue;

    const materialityElem = materialityResult.elements.find(
      (e) => e.elementNumber === elem.elementNumber,
    );

    let highestMateriality = 'LOW';
    let highestScore = 0;
    const contradictionCount = elem.contradictions.length;

    if (materialityElem) {
      for (const sc of materialityElem.scoredContradictions) {
        if (sc.materiality.numericScore > highestScore) {
          highestScore = sc.materiality.numericScore;
          highestMateriality = sc.materiality.level;
        }
      }
    }

    let reason = '';
    let actionableInsight = '';

    if (elem.coverage === 'uncovered') {
      reason = 'Essential element has no supporting prosecution evidence';
      actionableInsight = 'Move for dismissal — prosecution cannot prove this element';
    } else if (contradictionCount > 0 && highestMateriality === 'CRITICAL') {
      reason = `Critical contradiction(s) found on essential element`;
      actionableInsight = 'Prepare impeachment material using cited contradictions';
    } else if (contradictionCount > 0 && highestMateriality === 'HIGH') {
      reason = 'High-materiality contradiction weakens prosecution case on this element';
      actionableInsight = 'Use contradiction evidence in cross-examination';
    } else if (elem.contradictingEvidence.length > elem.supportingEvidence.length) {
      reason = 'More contradicting than supporting evidence';
      actionableInsight = 'Challenge prosecution evidence reliability';
    } else if (contradictionCount > 0) {
      reason = 'Contradiction detected — potential cross-examination opportunity';
      actionableInsight = 'Review source documents for additional inconsistencies';
    } else {
      continue; // No defense opportunity
    }

    priorities.push({
      priority: 0, // Will be sorted
      elementNumber: elem.elementNumber,
      elementLabel: elem.label,
      reason,
      materialityLevel: highestMateriality,
      contradictionCount,
      actionableInsight,
    });
  }

  // Sort by materiality level (CRITICAL > HIGH > MEDIUM > LOW), then by contradiction count
  const levelOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  priorities.sort((a, b) => {
    const levelDiff = (levelOrder[b.materialityLevel] ?? 0) - (levelOrder[a.materialityLevel] ?? 0);
    if (levelDiff !== 0) return levelDiff;
    return b.contradictionCount - a.contradictionCount;
  });

  // Assign priority numbers
  priorities.forEach((p, i) => { p.priority = i + 1; });

  return priorities;
}

// ---------------------------------------------------------------------------
// Main: Generate Defense Intelligence Report for a Charge
// ---------------------------------------------------------------------------

export async function generateDefenseReport(
  caseId: string,
  chargeId: string,
  tenantId: string,
): Promise<DefenseReport> {
  // Load charge info
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: {
      calcrimInstruction: {
        include: {
          elements: {
            orderBy: { elementNumber: 'asc' },
            include: { aliases: true, keywords: true },
          },
        },
      },
    },
  });

  if (!charge) throw new Error(`Charge ${chargeId} not found`);

  // Run contradiction analysis
  const contradictionResult = await analyzeChargeContradictions(chargeId);

  // Run materiality scoring
  const materialityResult = await scoreChargeContradictions(chargeId, contradictionResult);

  // Get element coverage
  const coverage = await getElementCoverage(chargeId);

  // Load all statement links for this charge
  const allLinks = await prisma.elementStatementLink.findMany({
    where: { chargeId },
    include: {
      statement: true,
      element: true,
    },
  });

  // Build element analysis
  const elementAnalysis: ElementAnalysis[] = [];

  if (charge.calcrimInstruction) {
    for (const element of charge.calcrimInstruction.elements) {
      const elemLinks = allLinks.filter((l) => l.elementId === element.id);
      const coverageInfo = coverage.elements.find((e) => e.elementNumber === element.elementNumber);

      const supportingEvidence: CitedEvidence[] = elemLinks
        .filter((l) => l.supportType === 'supports')
        .map((l) => ({
          statementId: l.statement.id,
          sourceDocumentId: l.statement.sourceDocumentId,
          page: l.statement.page,
          lineStart: l.statement.lineStart,
          lineEnd: l.statement.lineEnd,
          timestamp: l.statement.timestamp,
          speaker: l.statement.speaker,
          rawText: l.statement.rawText,
          confidence: l.confidence,
          matchMethod: l.matchMethod,
        }));

      const contradictingEvidence: CitedEvidence[] = elemLinks
        .filter((l) => l.supportType === 'contradicts')
        .map((l) => ({
          statementId: l.statement.id,
          sourceDocumentId: l.statement.sourceDocumentId,
          page: l.statement.page,
          lineStart: l.statement.lineStart,
          lineEnd: l.statement.lineEnd,
          timestamp: l.statement.timestamp,
          speaker: l.statement.speaker,
          rawText: l.statement.rawText,
          confidence: l.confidence,
          matchMethod: l.matchMethod,
        }));

      // Get contradictions for this element from materiality results
      const elemMateriality = materialityResult.elements.find(
        (e) => e.elementNumber === element.elementNumber,
      );

      const citedContradictions: CitedContradiction[] = (elemMateriality?.scoredContradictions ?? []).map(
        (sc) => ({
          contradictionType: sc.contradictionType,
          materialityLevel: sc.materiality.level,
          materialityScore: sc.materiality.numericScore,
          factualDomain: sc.factualDomain,
          explanation: sc.explanation,
          statementA: {
            statementId: sc.statementAId,
            sourceDocumentId: sc.statementA.sourceDocumentId,
            page: sc.statementA.page,
            lineStart: sc.statementA.lineStart,
            lineEnd: sc.statementA.lineEnd,
            timestamp: sc.statementA.timestamp,
            speaker: sc.statementA.speaker,
            rawText: sc.statementA.rawText,
          },
          statementB: {
            statementId: sc.statementBId,
            sourceDocumentId: sc.statementB.sourceDocumentId,
            page: sc.statementB.page,
            lineStart: sc.statementB.lineStart,
            lineEnd: sc.statementB.lineEnd,
            timestamp: sc.statementB.timestamp,
            speaker: sc.statementB.speaker,
            rawText: sc.statementB.rawText,
          },
        }),
      );

      const defenseOpportunity = identifyDefenseOpportunity(
        element.label,
        element.isEssential,
        coverageInfo?.coverage ?? 'uncovered',
        contradictingEvidence.length,
        supportingEvidence.length,
      );

      elementAnalysis.push({
        elementNumber: element.elementNumber,
        label: element.label,
        prosecutionBurden: element.prosecutionBurden,
        isEssential: element.isEssential,
        coverage: coverageInfo?.coverage ?? 'uncovered',
        supportingEvidence,
        contradictingEvidence,
        contradictions: citedContradictions,
        defenseOpportunity,
      });
    }
  }

  // Generate defense priorities
  const defensePriorities = generatePriorities(elementAnalysis, materialityResult);

  return {
    reportId: `defense-${chargeId}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    caseId,
    tenantId,
    chargeId,
    chargeSummary: {
      code: charge.code,
      section: charge.section,
      title: charge.title,
      instructionNumber: charge.calcrimInstruction?.instructionNumber ?? null,
      instructionTitle: charge.calcrimInstruction?.title ?? null,
      intentType: charge.calcrimInstruction?.intentType ?? null,
    },
    elementAnalysis,
    contradictionSummary: materialityResult.overallAssessment,
    prosecutionWeaknesses: materialityResult.overallAssessment.prosecutionBurdenWeaknesses,
    defensePriorities,
  };
}

// ---------------------------------------------------------------------------
// Generate Defense Report for All Charges in a Case
// ---------------------------------------------------------------------------

export async function generateCaseDefenseReport(
  caseId: string,
  tenantId: string,
): Promise<{
  caseId: string;
  generatedAt: string;
  chargeCount: number;
  reports: DefenseReport[];
}> {
  const charges = await prisma.charge.findMany({
    where: { caseId },
    include: { calcrimInstruction: true },
  });

  const reports: DefenseReport[] = [];
  for (const charge of charges) {
    if (charge.calcrimInstructionId) {
      const report = await generateDefenseReport(caseId, charge.id, tenantId);
      reports.push(report);
    }
  }

  return {
    caseId,
    generatedAt: new Date().toISOString(),
    chargeCount: reports.length,
    reports,
  };
}
