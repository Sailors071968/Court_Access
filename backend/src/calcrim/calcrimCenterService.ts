// ============================================================================
// Program 91 — Canonical CALCRIM Jury Instruction Intelligence Center
//
// Discovers applicable CALCRIM instructions for a case ONLY from repository-
// backed authorities (per-charge statute intelligence calcrimLinks). Each
// instruction identifies its supporting charge, elements, evidence, and
// authority. Nothing is fabricated: UNKNOWN is emitted wherever repository
// evidence is insufficient. No instructions, elements, or authorities invented.
// ============================================================================

import crypto from 'crypto';
import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';
import { buildAttorneyReport, type AttorneyReport } from '../report/attorneyReportService.js';

export const CALCRIM_CENTER_VERSION = '1.0.0';

const UNK = 'UNKNOWN';

export interface CalcrimCitation {
  type: 'evidence' | 'authority' | 'statute' | 'calcrim' | 'timeline' | 'witness' | 'discovery' | 'repository' | 'kg';
  id: string;
  label?: string;
}

export interface CalcrimElement {
  label: string;
  required: boolean;
  status: string; // established | satisfied | unsatisfied | missing_evidence | unknown ...
  confidence: string;
  supportingEvidence: Array<{ evidenceId: string; fileName: string }>;
}

export interface CalcrimEvidenceMapping {
  evidence: Array<{ evidenceId: string; fileName: string; confidence: string }>;
  witnesses: Array<{ id: string; name: string }>;
  discovery: Array<{ id: string; title: string }>;
  timeline: Array<{ id: string; description: string }>;
}

export interface CalcrimInstruction {
  instructionNumber: string;
  title: string;
  category: string;
  repositoryStatus: 'repository-linked' | 'UNKNOWN';
  confidence: string;
  charge: { chargeId: string; code: string; section: string; offenseTitle: string };
  authorityReferences: string[];
  elements: CalcrimElement[];
  evidenceMapping: CalcrimEvidenceMapping;
}

export interface CalcrimCenter {
  calcrimVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  header: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    repositoryIntegrity: string;
    generatedAt: string;
  };
  dashboard: {
    totalInstructions: number;
    chargesTotal: number;
    chargesWithInstructions: number;
    chargesWithoutInstructions: number;
    elementsTotal: number;
    elementsSatisfied: number;
    elementsUnsupported: number;
    evidenceLinkedElements: number;
    humanReviewCount: number;
  };
  instructions: CalcrimInstruction[];
  authorities: AttorneyReport['authorities'];
  knowledgeGraph: AttorneyReport['knowledgeGraph'];
  attorneyReview: {
    missingElements: Array<{ instruction: string; element: string; reason: string; citations: CalcrimCitation[] }>;
    weakElements: Array<{ instruction: string; element: string; confidence: string }>;
    conflictingEvidence: Array<{ id: string; label: string; value: string; citations: CalcrimCitation[] }>;
    repositoryGaps: Array<{ id: string; label: string; value: string; citations: CalcrimCitation[] }>;
    humanReviewItems: string[];
  };
}

// Standard CALCRIM series categories (numeric organization is factual).
const SERIES: Array<[number, number, string]> = [
  [100, 199, 'Pretrial'],
  [200, 299, 'Evidence'],
  [300, 399, 'Witnesses & Evidence'],
  [400, 499, 'Aiding, Abetting & Inchoate'],
  [500, 599, 'Homicide'],
  [600, 699, 'Homicide (Manslaughter)'],
  [700, 799, 'Homicide (Special Circumstances)'],
  [800, 999, 'Assaultive & Battery Offenses'],
  [1000, 1099, 'Sex Offenses'],
  [1100, 1199, 'Sex Offenses'],
  [1200, 1299, 'Kidnapping'],
  [1300, 1399, 'Criminal Threats & Harassment'],
  [1400, 1499, 'Criminal Street Gangs'],
  [1500, 1599, 'Terrorism & Weapons of Mass Destruction'],
  [1600, 1699, 'Robbery'],
  [1700, 1799, 'Burglary & Receiving'],
  [1800, 1999, 'Theft & Extortion'],
  [2000, 2099, 'Fraud'],
  [2100, 2199, 'Vehicle Offenses'],
  [2200, 2299, 'Vandalism, Loitering, Trespass'],
  [2300, 2399, 'Controlled Substances'],
  [2400, 2499, 'Weapons'],
  [2500, 2599, 'Weapons'],
  [2600, 2699, 'Criminal Justice & Government Integrity'],
  [2700, 2799, 'Crimes Against the Government'],
  [2900, 2999, 'Vandalism & Other'],
  [3000, 3199, 'Enhancements & Sentencing Factors'],
  [3400, 3599, 'Defenses & Insanity'],
];

function categoryFor(instructionNumber: string): string {
  const n = parseInt(instructionNumber.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(n)) return UNK;
  for (const [lo, hi, label] of SERIES) if (n >= lo && n <= hi) return label;
  return `Series ${Math.floor(n / 100) * 100}`;
}

export async function buildCalcrimCenter(
  caseId: string,
  tenantId: string,
  userId: string,
): Promise<CalcrimCenter | null> {
  const bundle = await buildAttorneyWorkbench(caseId, tenantId, userId);
  if (!bundle) return null;
  const report = await buildAttorneyReport(caseId, tenantId, userId, bundle);
  if (!report) return null;

  const generatedAt = new Date().toISOString();
  const evidenceById = new Map(report.evidence.items.map((e) => [e.evidenceId, e]));

  const instructions: CalcrimInstruction[] = [];
  let chargesWithInstructions = 0;
  const missingElements: CalcrimCenter['attorneyReview']['missingElements'] = [];
  const weakElements: CalcrimCenter['attorneyReview']['weakElements'] = [];

  for (const charge of report.charges) {
    const chargeMeta = { chargeId: charge.chargeId, code: charge.code, section: charge.section, offenseTitle: charge.offenseTitle };
    const elements: CalcrimElement[] = charge.elements.map((el) => ({
      label: el.label,
      required: el.required,
      status: el.status,
      confidence: el.confidence,
      supportingEvidence: el.supportingEvidence.map((eid) => ({ evidenceId: eid, fileName: evidenceById.get(eid)?.fileName ?? eid })),
    }));

    // Evidence mapping for this charge: elements' supporting evidence + case corpus context.
    const linkedEvidenceIds = new Set(charge.elements.flatMap((e) => e.supportingEvidence));
    const evidenceMapping: CalcrimEvidenceMapping = {
      evidence: report.evidence.items
        .filter((e) => linkedEvidenceIds.has(e.evidenceId))
        .map((e) => ({ evidenceId: e.evidenceId, fileName: e.fileName, confidence: e.confidence })),
      witnesses: report.witnesses.items.map((w) => ({ id: w.id, name: w.name })),
      discovery: report.discovery.items.map((d) => ({ id: d.id, title: d.title })),
      timeline: report.timeline.events.slice(0, 20).map((t) => ({ id: t.id, description: t.description })),
    };

    const calcrimLinks = charge.calcrim;
    if (calcrimLinks.length > 0) {
      chargesWithInstructions += 1;
      for (const link of calcrimLinks) {
        instructions.push({
          instructionNumber: link.instructionNumber,
          title: link.title,
          category: categoryFor(link.instructionNumber),
          repositoryStatus: 'repository-linked',
          confidence: charge.repositoryConfidence,
          charge: chargeMeta,
          authorityReferences: [`${charge.code} ${charge.section}`, ...charge.authorities.map((a) => a.citation)].slice(0, 8),
          elements,
          evidenceMapping,
        });
      }
    } else {
      // No repository CALCRIM link for this charge → explicit UNKNOWN entry (a gap, not fabricated).
      instructions.push({
        instructionNumber: UNK,
        title: `No repository CALCRIM instruction linked for ${charge.code} ${charge.section}`,
        category: UNK,
        repositoryStatus: 'UNKNOWN',
        confidence: UNK,
        charge: chargeMeta,
        authorityReferences: [`${charge.code} ${charge.section}`],
        elements,
        evidenceMapping,
      });
    }

    // Element review
    for (const el of elements) {
      if (el.status === 'missing_evidence' || el.status === 'unsatisfied' || el.status === 'unknown') {
        missingElements.push({
          instruction: calcrimLinks[0]?.instructionNumber ?? `${charge.code} ${charge.section}`,
          element: el.label,
          reason: el.status,
          citations: el.supportingEvidence.map((e) => ({ type: 'evidence' as const, id: e.evidenceId, label: e.fileName })),
        });
      } else if (el.confidence === 'LOW') {
        weakElements.push({ instruction: calcrimLinks[0]?.instructionNumber ?? `${charge.code} ${charge.section}`, element: el.label, confidence: el.confidence });
      }
    }
  }

  const elementsTotal = instructions.reduce((n, i) => n + i.elements.length, 0);
  const elementsSatisfied = instructions.reduce((n, i) => n + i.elements.filter((e) => e.status === 'established' || e.status === 'satisfied').length, 0);
  const elementsUnsupported = instructions.reduce((n, i) => n + i.elements.filter((e) => e.status === 'missing_evidence' || e.status === 'unsatisfied' || e.status === 'unknown').length, 0);
  const evidenceLinkedElements = instructions.reduce((n, i) => n + i.elements.filter((e) => e.supportingEvidence.length > 0).length, 0);

  const conflictingEvidence = report.analysis.contradictions.map((c) => ({ id: c.id, label: c.label, value: c.value, citations: c.citations.map((x) => ({ type: x.type as CalcrimCitation['type'], id: x.id })) }));
  const repositoryGaps = report.analysis.repositoryGaps.map((c) => ({ id: c.id, label: c.label, value: c.value, citations: c.citations.map((x) => ({ type: x.type as CalcrimCitation['type'], id: x.id })) }));

  const linkedInstructionCount = instructions.filter((i) => i.repositoryStatus === 'repository-linked').length;

  const center: CalcrimCenter = {
    calcrimVersion: CALCRIM_CENTER_VERSION,
    generatedAt,
    caseId,
    tenantId,
    reproducibilityHash: '',
    header: {
      caseTitle: report.executiveSummary.caseTitle,
      caseNumber: report.executiveSummary.caseNumber,
      court: report.executiveSummary.court,
      judge: report.executiveSummary.judge,
      repositoryVersion: report.executiveSummary.repositoryVersion,
      knowledgeGraphStatus: report.executiveSummary.knowledgeGraphStatus,
      repositoryIntegrity: report.executiveSummary.repositoryIntegrity,
      generatedAt,
    },
    dashboard: {
      totalInstructions: linkedInstructionCount,
      chargesTotal: report.charges.length,
      chargesWithInstructions,
      chargesWithoutInstructions: report.charges.length - chargesWithInstructions,
      elementsTotal,
      elementsSatisfied,
      elementsUnsupported,
      evidenceLinkedElements,
      humanReviewCount: report.analysis.humanReviewItems.length,
    },
    instructions,
    authorities: report.authorities,
    knowledgeGraph: report.knowledgeGraph,
    attorneyReview: {
      missingElements,
      weakElements,
      conflictingEvidence,
      repositoryGaps,
      humanReviewItems: report.analysis.humanReviewItems,
    },
  };

  center.reproducibilityHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...center, generatedAt: null, reproducibilityHash: null, header: { ...center.header, generatedAt: null } }))
    .digest('hex');

  return center;
}
