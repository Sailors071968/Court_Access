// ============================================================================
// Program 93 — Canonical Sentencing, Enhancement & Criminal Exposure Center
//
// Surfaces ONLY repository-backed sentencing information: offense classification
// and verbatim statutory penalty provisions from the repository, plus
// enhancement references detected within real repository text (each cited).
// The repository does NOT provide structured sentencing terms (lower/middle/
// upper/mandatory minimums) or a computable exposure range — those are reported
// as UNKNOWN. Criminal exposure is NEVER estimated from unsupported data.
// ============================================================================

import crypto from 'crypto';
import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';
import { buildAttorneyReport } from '../report/attorneyReportService.js';

export const SENTENCING_VERSION = '1.0.0';

const UNK = 'UNKNOWN';

export interface SentencingCitation {
  type: 'statute' | 'authority' | 'calcrim' | 'repository' | 'kg';
  id: string;
  label?: string;
}

export interface OffenseSentencing {
  chargeId: string;
  code: string;
  section: string;
  offenseTitle: string;
  offenseId: string | null;
  classification: string; // felony | misdemeanor | infraction | wobbler | UNKNOWN
  classificationConfidence: string;
  isFelony: boolean;
  isMisdemeanor: boolean;
  isInfraction: boolean;
  isWobbler: boolean;
  isStraight: boolean;
  penaltyProvision: string; // verbatim repository text or UNKNOWN
  penaltyConfidence: string;
  // Structured terms — repository does not provide these → UNKNOWN
  baseTerm: string;
  lowerTerm: string;
  middleTerm: string;
  upperTerm: string;
  mandatoryMinimum: string;
  probationEligibility: string;
  diversionEligibility: string;
  alternativeSentencing: string;
  repositoryConfidence: string;
  citations: SentencingCitation[];
}

export interface EnhancementFinding {
  category: string;
  status: 'repository-referenced' | 'UNKNOWN';
  detail: string;
  citations: SentencingCitation[];
}

export interface SentencingCenter {
  sentencingVersion: string;
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
    generatedAt: string;
  };
  dashboard: {
    chargeCount: number;
    felonies: number;
    misdemeanors: number;
    infractions: number;
    wobblers: number;
    unknownClassification: number;
    enhancementsReferenced: number;
    repositoryConfidence: string;
    humanReviewCount: number;
  };
  offenses: OffenseSentencing[];
  enhancements: EnhancementFinding[];
  defenseAnalysis: {
    defenses: Array<{ text: string; citations: SentencingCitation[] }>;
    exceptions: Array<{ text: string; citations: SentencingCitation[] }>;
    immunities: Array<{ text: string; citations: SentencingCitation[] }>;
  };
  exposure: {
    minimum: string;
    maximum: string;
    mandatoryTerms: string[];
    consecutiveTerms: string[];
    concurrentTerms: string[];
    repositoryConfidence: string;
    penaltyProvisions: Array<{ charge: string; provision: string; citations: SentencingCitation[] }>;
    note: string;
  };
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  attorneyReview: {
    repositoryGaps: string[];
    incompleteSentencingData: string[];
    manualReviewRequired: string[];
    unknownExposure: boolean;
    repositoryCoverage: string;
  };
}

const ENHANCEMENT_PATTERNS: Array<{ category: string; re: RegExp }> = [
  { category: 'Firearm', re: /\bfirearm|12022\.5|12022\.53|\bgun\b|discharge.*weapon/i },
  { category: 'Great Bodily Injury', re: /great bodily injury|\bg\.?b\.?i\.?\b|12022\.7|12022\.8/i },
  { category: 'Prior Prison', re: /prior prison|667\.5(?!\s*\(c\))|prison prior/i },
  { category: 'Prior Strike', re: /\bstrike\b|667\((?:b|c|d|e)\)|1170\.12|three strikes/i },
  { category: 'Gang', re: /\bgang\b|186\.22/i },
  { category: 'Hate Crime', re: /hate crime|422\.7|422\.75/i },
  { category: 'Drug', re: /controlled substance|\bdrug\b|11370|11351|11352|health (?:and|&) safety/i },
  { category: 'Sex Registration', re: /\b290\b|sex offender registration|register as a sex/i },
  { category: 'Serious Felony', re: /serious felony|1192\.7/i },
  { category: 'Violent Felony', re: /violent felony|667\.5\(c\)/i },
];

function fv(f: { value?: unknown; confidence?: string } | null | undefined): { value: string; confidence: string } {
  if (!f || f.value == null) return { value: UNK, confidence: UNK };
  const v = String(f.value);
  return { value: v === 'unknown' || v === '' ? UNK : v, confidence: f.confidence ?? UNK };
}

export async function buildSentencingCenter(
  caseId: string,
  tenantId: string,
  userId: string,
): Promise<SentencingCenter | null> {
  const bundle = await buildAttorneyWorkbench(caseId, tenantId, userId);
  if (!bundle) return null;
  const report = await buildAttorneyReport(caseId, tenantId, userId, bundle);
  if (!report) return null;

  const generatedAt = new Date().toISOString();

  const offenses: OffenseSentencing[] = [];
  const defenses: SentencingCenter['defenseAnalysis']['defenses'] = [];
  const exceptions: SentencingCenter['defenseAnalysis']['exceptions'] = [];
  // Gather repository text per charge for enhancement detection.
  const enhancementText: Array<{ charge: string; chargeId: string; text: string }> = [];

  for (const ch of report.charges) {
    const analysis = bundle.offenseAnalysis.find(
      (a) => a.code === ch.code && a.section.replace(/\.+$/, '') === ch.section.replace(/\.+$/, ''),
    );
    const si = analysis?.statuteIntelligence ?? null;
    const chargeLabel = `${ch.code} ${ch.section}`;
    const statuteCite: SentencingCitation = { type: 'statute', id: chargeLabel, label: ch.offenseTitle };

    // Classification (repository)
    const classFromRecord = si?.classification ? fv((si.classification as unknown as { classification?: { value?: unknown; confidence?: string } }).classification) : { value: UNK, confidence: UNK };
    const classification = classFromRecord.value !== UNK ? classFromRecord.value : (ch.classification && ch.classification !== UNK ? ch.classification : UNK);
    const cl = classification.toLowerCase();
    const isWobbler = /wobble/.test(cl);
    const isFelony = /felony/.test(cl) && !isWobbler;
    const isMisdemeanor = /misdemeanor/.test(cl) && !isWobbler;
    const isInfraction = /infraction/.test(cl);

    // Penalty provision (verbatim repository text)
    const offenseRec = (si?.offenses ?? []).find((o) => {
      const on = fv((o as unknown as { penalty?: unknown }).penalty as never);
      return on.value !== UNK;
    }) ?? (si?.offenses ?? [])[0] ?? null;
    const penalty = offenseRec ? fv((offenseRec as unknown as { penalty?: { value?: unknown; confidence?: string } }).penalty) : { value: UNK, confidence: UNK };

    offenses.push({
      chargeId: ch.chargeId,
      code: ch.code,
      section: ch.section,
      offenseTitle: ch.offenseTitle,
      offenseId: ch.offenseId,
      classification: classification === UNK ? UNK : classification,
      classificationConfidence: classFromRecord.confidence,
      isFelony,
      isMisdemeanor,
      isInfraction,
      isWobbler,
      isStraight: !isWobbler && (isFelony || isMisdemeanor || isInfraction),
      penaltyProvision: penalty.value,
      penaltyConfidence: penalty.confidence,
      baseTerm: UNK,
      lowerTerm: UNK,
      middleTerm: UNK,
      upperTerm: UNK,
      mandatoryMinimum: UNK,
      probationEligibility: UNK,
      diversionEligibility: UNK,
      alternativeSentencing: isWobbler ? 'Wobbler — may be charged/sentenced as felony or misdemeanor (repository classification)' : UNK,
      repositoryConfidence: ch.repositoryConfidence,
      citations: [statuteCite],
    });

    // Collect defenses / exceptions (repository)
    for (const dtext of ch.defenses) defenses.push({ text: dtext, citations: [statuteCite] });
    for (const etext of ch.exceptions) exceptions.push({ text: etext, citations: [statuteCite] });

    // Enhancement text corpus: penalty + explicit repository enhancements
    const parts = [penalty.value !== UNK ? penalty.value : '', ...ch.enhancements].filter(Boolean).join(' \n ');
    if (parts.trim()) enhancementText.push({ charge: chargeLabel, chargeId: ch.chargeId, text: parts });
  }

  // Enhancement detection (repository-referenced only; never fabricated)
  const enhancements: EnhancementFinding[] = ENHANCEMENT_PATTERNS.map(({ category, re }) => {
    const hits = enhancementText.filter((t) => re.test(t.text));
    if (hits.length === 0) {
      return { category, status: 'UNKNOWN' as const, detail: 'No repository reference found for this enhancement.', citations: [] };
    }
    return {
      category,
      status: 'repository-referenced' as const,
      detail: hits.map((h) => `${h.charge}: ${h.text.slice(0, 140)}`).join(' · '),
      citations: hits.map((h) => ({ type: 'statute' as const, id: h.charge })),
    };
  });

  const enhancementsReferenced = enhancements.filter((e) => e.status === 'repository-referenced').length;

  // Exposure — NEVER estimated. Repository lacks structured terms → UNKNOWN.
  const penaltyProvisions = offenses
    .filter((o) => o.penaltyProvision !== UNK)
    .map((o) => ({ charge: `${o.code} ${o.section}`, provision: o.penaltyProvision, citations: o.citations }));

  const exposure: SentencingCenter['exposure'] = {
    minimum: UNK,
    maximum: UNK,
    mandatoryTerms: [],
    consecutiveTerms: [],
    concurrentTerms: [],
    repositoryConfidence: penaltyProvisions.length > 0 ? 'partial (verbatim provisions only)' : UNK,
    penaltyProvisions,
    note:
      'The repository does not provide structured sentencing terms (lower/middle/upper, mandatory minimums, consecutive/concurrent rules). A numeric exposure range is therefore UNKNOWN and is not estimated. Verbatim statutory penalty provisions are listed as the repository-backed basis; counsel must compute exposure.',
  };

  const felonies = offenses.filter((o) => o.isFelony).length;
  const misdemeanors = offenses.filter((o) => o.isMisdemeanor).length;
  const infractions = offenses.filter((o) => o.isInfraction).length;
  const wobblers = offenses.filter((o) => o.isWobbler).length;
  const unknownClassification = offenses.filter((o) => o.classification === UNK).length;

  const incompleteSentencingData: string[] = [];
  if (offenses.every((o) => o.penaltyProvision === UNK)) incompleteSentencingData.push('No repository penalty provisions available for any charge.');
  if (unknownClassification > 0) incompleteSentencingData.push(`${unknownClassification} charge(s) have UNKNOWN classification.`);
  incompleteSentencingData.push('Structured sentencing terms (lower/middle/upper, mandatory minimums) are not present in the repository (UNKNOWN).');

  const coveragePct = report.charges.length > 0 ? Math.round(((report.charges.length - unknownClassification) / report.charges.length) * 100) : 0;

  const center: SentencingCenter = {
    sentencingVersion: SENTENCING_VERSION,
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
      generatedAt,
    },
    dashboard: {
      chargeCount: report.charges.length,
      felonies,
      misdemeanors,
      infractions,
      wobblers,
      unknownClassification,
      enhancementsReferenced,
      repositoryConfidence: report.charges.length === 0 ? UNK : unknownClassification === 0 ? 'classification available' : 'partial',
      humanReviewCount: report.analysis.humanReviewItems.length,
    },
    offenses,
    enhancements,
    defenseAnalysis: {
      defenses,
      exceptions,
      immunities: [], // Not represented in the repository → UNKNOWN in the UI.
    },
    exposure,
    authorities: report.authorities,
    knowledgeGraph: report.knowledgeGraph,
    attorneyReview: {
      repositoryGaps: report.analysis.repositoryGaps.map((g) => g.value),
      incompleteSentencingData,
      manualReviewRequired: [
        'All sentencing exposure and enhancement applicability must be computed and verified by counsel.',
        ...report.analysis.humanReviewItems,
      ],
      unknownExposure: exposure.minimum === UNK && exposure.maximum === UNK,
      repositoryCoverage: report.charges.length === 0 ? UNK : `${coveragePct}% of charges classified`,
    },
  };

  center.reproducibilityHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...center, generatedAt: null, reproducibilityHash: null, header: { ...center.header, generatedAt: null } }))
    .digest('hex');

  return center;
}
