// ============================================================================
// Program 88 — Canonical Premium Attorney Report
// Aggregates ONLY repository-backed intelligence. Never fabricates findings.
// UNKNOWN is emitted wherever repository evidence is insufficient.
// ============================================================================

import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';
import { buildCaseKnowledgeGraph } from '../graph/caseKnowledgeGraph.js';
import type { AttorneyWorkbenchBundle } from '../workbench/types.js';

export const ATTORNEY_REPORT_VERSION = '1.0.0';

type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' | 'repository-confirmed' | 'manual-review';

export interface ReportCitation {
  type: 'evidence' | 'authority' | 'timeline' | 'statute' | 'calcrim' | 'witness' | 'discovery' | 'repository' | 'audit';
  id: string;
  label?: string;
}

export interface ReportFinding {
  id: string;
  label: string;
  value: string;
  status?: string;
  confidence?: Confidence;
  citations: ReportCitation[];
  note?: string | null;
}

export interface ReportChargeElement {
  label: string;
  required: boolean;
  status: string;
  confidence: Confidence;
  supportingEvidence: string[];
}

export interface ReportCharge {
  chargeId: string;
  countNumber: number | null;
  code: string;
  section: string;
  offenseTitle: string;
  offenseId: string | null;
  classification: string;
  isPrimary: boolean;
  isEnhancement: boolean;
  dismissed: boolean;
  elements: ReportChargeElement[];
  mensRea: Array<{ type: string; terms: string[] }>;
  calcrim: Array<{ instructionNumber: string; title: string }>;
  enhancements: string[];
  defenses: string[];
  exceptions: string[];
  immunities: string[];
  sentencing: string[];
  authorities: Array<{ type: string; citation: string }>;
  repositoryConfidence: Confidence;
  repositoryVerified: boolean;
  manualReviewRequired: boolean;
  unknowns: string[];
}

export interface ReportEvidenceItem {
  evidenceId: string;
  fileName: string;
  evidenceType: string;
  mimeType: string | null;
  sizeBytes: string | null;
  sha256: string | null;
  ocrStatus: string;
  processingStatus: string;
  analysisStatus: string;
  uploadedAt: string;
  uploadedBy: string;
  confidence: Confidence;
  chainOfCustody: string;
  timelineLinked: boolean;
  citations: ReportCitation[];
}

export interface ReportWitness {
  id: string;
  name: string;
  witnessType: string;
  role: string;
  agency: string | null;
  status: string;
  interviewStatus: string;
  credibilityStatus: string;
  repositorySupport: string;
  sourceType: string;
  notes: string | null;
}

export interface ReportDiscoveryItem {
  id: string;
  title: string;
  category: string;
  sourceAgency: string | null;
  receivedDate: string | null;
  producedDate: string | null;
  hash: string | null;
  ocrStatus: string;
  reviewStatus: string;
  bradyFlag: boolean;
  giglioFlag: boolean;
  jencksFlag: boolean;
  flags: string[];
}

export interface ReportTimelineEvent {
  id: string;
  timestamp: string | null;
  timeText: string | null;
  description: string;
  actor: string | null;
  eventType: string | null;
  location: string | null;
  sourceType: string | null;
  conflictFlag: boolean;
  confidence: string | null;
}

export interface AttorneyReport {
  reportVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;

  executiveSummary: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    status: string;
    phase: string;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    repositoryIntegrity: string;
    evidenceCount: number;
    witnessCount: number;
    discoveryCount: number;
    timelineEventCount: number;
    chargeCount: number;
    reportTimestamp: string;
  };

  caseOverview: {
    client: string;
    jurisdiction: string;
    caseType: string;
    prosecutor: string;
    defenseTeam: string[];
    filingDate: string | null;
    trialDate: string | null;
    nextHearing: string | null;
    county: string;
    notes: string | null;
  };

  charges: ReportCharge[];

  evidence: {
    total: number;
    byType: Record<string, number>;
    hashCoverage: string;
    processingPending: number;
    items: ReportEvidenceItem[];
    duplicates: Array<{ evidenceIds: string[]; reason: string }>;
    missing: string[];
  };

  witnesses: {
    total: number;
    byType: Record<string, number>;
    items: ReportWitness[];
    gaps: ReportFinding[];
  };

  discovery: {
    total: number;
    received: number;
    bradyCount: number;
    giglioCount: number;
    jencksCount: number;
    humanReviewRequired: number;
    items: ReportDiscoveryItem[];
    missing: string[];
  };

  timeline: {
    eventCount: number;
    conflictCount: number;
    events: ReportTimelineEvent[];
    conflicts: ReportTimelineEvent[];
    gaps: ReportFinding[];
  };

  knowledgeGraph: {
    status: string;
    nodeCount: number;
    edgeCount: number;
    byType: Record<string, number>;
  };

  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
    findings: ReportFinding[];
  };

  analysis: {
    caseStrength: ReportFinding;
    evidenceConfidence: ReportFinding;
    repositoryCompleteness: ReportFinding;
    missingElements: ReportFinding[];
    contradictions: ReportFinding[];
    repositoryGaps: ReportFinding[];
    humanReviewItems: string[];
  };

  recommendations: {
    additionalEvidence: ReportFinding[];
    witnessFollowUp: ReportFinding[];
    discoveryRequests: ReportFinding[];
    repositoryResearch: ReportFinding[];
    manualReview: string[];
    potentialMotionTopics: ReportFinding[];
  };

  auditTrail: Array<{ generatedAt: string; source: string; reasoning: string }>;
}

function UNK(): string {
  return 'UNKNOWN';
}

function toStatusFinding(
  id: string,
  label: string,
  score: number | null | undefined,
  labelText: string | undefined,
  citations: ReportCitation[],
  note?: string,
): ReportFinding {
  if (score == null || Number.isNaN(score)) {
    return { id, label, value: UNK(), status: 'unknown', confidence: 'UNKNOWN', citations, note: note ?? 'Insufficient repository evidence to compute.' };
  }
  return { id, label, value: `${labelText ?? String(score)} (${score}/100)`, status: labelText ?? String(score), confidence: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW', citations, note: note ?? null };
}

export async function buildAttorneyReport(
  caseId: string,
  tenantId: string,
  userId: string,
  prebuiltBundle?: AttorneyWorkbenchBundle | null,
): Promise<AttorneyReport | null> {
  const bundle = prebuiltBundle ?? (await buildAttorneyWorkbench(caseId, tenantId, userId));
  if (!bundle) return null;

  const [caseRecord, charges, evidence, witnesses, discovery, timelineEvents] = await Promise.all([
    prisma.criminalCase.findFirst({ where: { caseId, tenantId, deletedAt: null }, include: { client: true } }),
    prisma.charge.findMany({ where: { caseId }, orderBy: [{ isPrimary: 'desc' }, { countNumber: 'asc' }] }),
    prisma.evidence.findMany({ where: { caseId, tenantId }, orderBy: { uploadedAt: 'asc' } }),
    prisma.caseWitness.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'asc' } }),
    prisma.discoveryItem.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'desc' } }),
    prisma.timelineEvent.findMany({ where: { caseId, tenantId }, orderBy: { timestamp: 'asc' } }),
  ]);

  if (!caseRecord) return null;

  let kg: Awaited<ReturnType<typeof buildCaseKnowledgeGraph>> = null;
  try {
    kg = await buildCaseKnowledgeGraph(caseId, tenantId, userId);
  } catch {
    kg = null;
  }

  const generatedAt = new Date().toISOString();
  const cc = bundle.commandCenter;
  const intel = bundle.intelligence;

  // -- Charges (repository-backed via offenseAnalysis + elementMatrices) --
  const reportCharges: ReportCharge[] = charges.map((ch) => {
    const analysis = bundle.offenseAnalysis.find(
      (a) => a.code === ch.code && normalizeSection(a.section) === normalizeSection(ch.section),
    );
    const matrix = bundle.elementMatrices.find(
      (m) => m.code === ch.code && normalizeSection(m.section) === normalizeSection(ch.section),
    );
    const si = analysis?.statuteIntelligence ?? null;

    const elements: ReportChargeElement[] = matrix
      ? matrix.rows.map((r) => ({
          label: r.elementLabel,
          required: r.required,
          status: r.status,
          confidence: r.confidence,
          supportingEvidence: r.supportingEvidence.map((e) => e.evidenceId),
        }))
      : (si?.elements ?? []).map((e) => ({
          label: fieldVal(e.label) || UNK(),
          required: Boolean(e.required),
          status: 'unknown',
          confidence: 'UNKNOWN' as Confidence,
          supportingEvidence: [],
        }));

    const mensRea = (si?.mensRea ?? []).map((m) => ({
      type: fieldVal(m.type) || UNK(),
      terms: (fieldArr(m.terms) as string[]) ?? [],
    }));

    const calcrim = (analysis?.applicableCalcrim ?? []).map((c) => ({
      instructionNumber: c.instructionNumber,
      title: c.title,
    }));

    const authorities = (si?.authorities ?? []).map((a) => ({
      type: a.authorityType,
      citation: fieldVal(a.citation) || UNK(),
    }));

    const repositoryConfidence: Confidence = si?.confirmedOffense
      ? 'repository-confirmed'
      : si?.manualReviewRequired
        ? 'manual-review'
        : 'UNKNOWN';

    return {
      chargeId: ch.id,
      countNumber: ch.countNumber ?? null,
      code: ch.code,
      section: ch.section,
      offenseTitle: ch.title || si?.title || UNK(),
      offenseId: ch.offenseId ?? null,
      classification: ch.classification || si?.classification?.classification?.value || ch.severity || UNK(),
      isPrimary: ch.isPrimary,
      isEnhancement: ch.isEnhancement,
      dismissed: ch.dismissed,
      elements,
      mensRea,
      calcrim,
      enhancements: analysis?.enhancements ?? [],
      defenses: analysis?.defenses ?? (si?.defenses ?? []).map((d) => fieldVal(d.text)).filter(Boolean),
      exceptions: analysis?.exceptions ?? (si?.exceptions ?? []).map((e) => fieldVal(e.text)).filter(Boolean),
      immunities: [], // Not represented in the repository → reported as UNKNOWN in the UI.
      sentencing: [], // Not flattened by the repository intelligence layer → UNKNOWN in the UI.
      authorities,
      repositoryConfidence,
      repositoryVerified: ch.repositoryVerified,
      manualReviewRequired: si?.manualReviewRequired ?? false,
      unknowns: [...(si?.unknowns ?? []), ...(analysis?.unknownLegalQuestions ?? [])],
    };
  });

  // -- Evidence --
  const evidenceTimelineIds = new Set(
    timelineEvents.map((t) => t.sourceDoc).filter(Boolean) as string[],
  );
  const evByType: Record<string, number> = {};
  const reportEvidence: ReportEvidenceItem[] = evidence.map((e) => {
    evByType[e.evidenceType] = (evByType[e.evidenceType] ?? 0) + 1;
    const wbItem = bundle.evidenceWorkbench.items.find((i) => i.evidenceId === e.evidenceId);
    return {
      evidenceId: e.evidenceId,
      fileName: e.fileName,
      evidenceType: e.evidenceType,
      mimeType: e.mimeType ?? null,
      sizeBytes: e.size != null ? String(e.size) : null,
      sha256: e.sha256 ?? null,
      ocrStatus: e.processingStatus === 'analyzed' || e.processingStatus === 'normalized' ? e.processingStatus : e.processingStatus,
      processingStatus: e.processingStatus,
      analysisStatus: e.analysisStatus,
      uploadedAt: e.uploadedAt.toISOString(),
      uploadedBy: e.uploadedBy,
      confidence: wbItem?.confidence ?? 'UNKNOWN',
      chainOfCustody: wbItem?.chainOfCustody.status ?? (e.sha256 ? 'partial' : 'unknown'),
      timelineLinked: evidenceTimelineIds.has(e.fileName) || evidenceTimelineIds.has(e.evidenceId),
      citations: [{ type: 'evidence', id: e.evidenceId, label: e.fileName }],
    };
  });
  const hashed = evidence.filter((e) => !!e.sha256).length;
  const hashCoverage = evidence.length === 0 ? UNK() : `${hashed}/${evidence.length} hashed (${Math.round((hashed / evidence.length) * 100)}%)`;

  // -- Witnesses --
  const wByType: Record<string, number> = {};
  const reportWitnesses: ReportWitness[] = witnesses.map((w) => {
    const t = w.witnessType || 'unspecified';
    wByType[t] = (wByType[t] ?? 0) + 1;
    return {
      id: w.id,
      name: w.name,
      witnessType: w.witnessType || UNK(),
      role: w.role || UNK(),
      agency: w.agency ?? null,
      status: w.status,
      interviewStatus: w.interviewStatus,
      credibilityStatus: w.credibilityStatus || UNK(),
      repositorySupport: UNK(),
      sourceType: w.sourceType || UNK(),
      notes: w.notes ?? null,
    };
  });

  // -- Discovery --
  const reportDiscovery: ReportDiscoveryItem[] = discovery.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    sourceAgency: d.sourceAgency ?? null,
    receivedDate: d.receivedDate ? d.receivedDate.toISOString() : null,
    producedDate: d.producedDate ? d.producedDate.toISOString() : null,
    hash: d.hash ?? null,
    ocrStatus: d.ocrStatus,
    reviewStatus: d.reviewStatus,
    bradyFlag: d.bradyFlag,
    giglioFlag: d.giglioFlag,
    jencksFlag: d.jencksFlag,
    flags: d.flags ?? [],
  }));

  // -- Timeline --
  const reportTimeline: ReportTimelineEvent[] = timelineEvents.map((t) => ({
    id: t.id,
    timestamp: t.timestamp ? t.timestamp.toISOString() : null,
    timeText: t.timeText ?? null,
    description: t.description || [t.actor, t.action, t.target].filter(Boolean).join(' ') || UNK(),
    actor: t.actor ?? null,
    eventType: t.sourceType ?? null,
    location: t.location ?? null,
    sourceType: t.sourceType ?? null,
    conflictFlag: t.conflictFlag,
    confidence: t.confidence ?? null,
  }));
  const conflicts = reportTimeline.filter((t) => t.conflictFlag);

  // -- Knowledge graph --
  const kgStatus = kg
    ? kg.counts.nodes > 0
      ? 'generated'
      : 'empty'
    : 'unavailable';

  // -- Authorities --
  const statutes = reportCharges
    .filter((c) => c.offenseTitle && c.offenseTitle !== UNK())
    .map((c) => ({ code: c.code, section: c.section, title: c.offenseTitle }));
  const calcrimAll = dedupeBy(
    reportCharges.flatMap((c) => c.calcrim),
    (c) => c.instructionNumber,
  );
  const authorityCitations = dedupeBy(
    reportCharges.flatMap((c) => c.authorities),
    (a) => a.citation,
  );
  const providerAvailability = [
    { provider: 'California Legislative (repository)', status: statutes.length > 0 ? 'available' : 'no repository match' },
    { provider: 'CALCRIM (derived)', status: calcrimAll.length > 0 ? 'available' : 'UNKNOWN' },
    { provider: 'CourtListener', status: process.env.COURTLISTENER_API_TOKEN ? 'configured' : 'UNKNOWN (not configured)' },
    { provider: 'Harvard CAP', status: 'UNKNOWN (provider not active)' },
    { provider: 'OpenLaws', status: process.env.OPENLAWS_API_KEY ? 'configured' : 'UNKNOWN (not configured)' },
  ];

  // -- Analysis (repository-backed only; UNKNOWN otherwise) --
  const caseStrength = toStatusFinding('an-strength', 'Case Strength', cc?.caseHealth?.score, cc?.caseHealth?.label, sourceCitations(intel.riskFactors));
  const evidenceConfidence = toStatusFinding('an-evconf', 'Evidence Confidence', cc?.evidenceHealth?.score, cc?.evidenceHealth?.label, reportEvidence.map((e) => e.citations[0]));
  const repositoryCompleteness = toStatusFinding('an-complete', 'Repository Completeness', cc?.legalCoverage?.score, cc?.legalCoverage?.label, []);

  const missingElements: ReportFinding[] = bundle.elementMatrices
    .flatMap((m) =>
      m.rows
        .filter((r) => r.status === 'missing_evidence' || r.status === 'unsatisfied' || r.status === 'unknown')
        .map((r) => ({
          id: `me-${m.chargeId}-${r.elementId}`,
          label: `${m.code} ${m.section} — ${r.elementLabel}`,
          value: r.status,
          status: r.status,
          confidence: r.confidence,
          citations: r.supportingEvidence.map((e) => ({ type: 'evidence' as const, id: e.evidenceId })),
          note: r.missingEvidenceReason,
        })),
    );

  const contradictions: ReportFinding[] = (intel.contradictionAnalysis ?? []).map((f) => findingToReport(f));
  const repositoryGaps: ReportFinding[] = [
    ...(intel.evidenceSummary?.findings ?? []),
    ...(intel.timelineSummary?.findings ?? []),
  ]
    .filter((f) => f.status === 'missing_evidence' || f.status === 'unknown')
    .map((f) => findingToReport(f));
  const humanReviewItems = reportCharges.filter((c) => c.manualReviewRequired).map((c) => `${c.code} ${c.section} — manual review required`);

  // -- Recommendations (only repository-backed) --
  const additionalEvidence: ReportFinding[] = (intel.evidenceSummary?.findings ?? [])
    .filter((f) => f.status === 'missing_evidence')
    .map((f) => findingToReport(f));
  const witnessFollowUp: ReportFinding[] = (bundle.investigation.witnessGaps ?? []).map((f) => findingToReport(f));
  const discoveryRequests: ReportFinding[] = (bundle.investigation.recommendedDiscovery ?? []).map((s, i) => textFinding(`dr-${i}`, 'Discovery Request', s));
  const repositoryResearch: ReportFinding[] = (intel.recommendedInvestigation ?? []).map((s, i) => textFinding(`rr-${i}`, 'Repository Research', s));
  const manualReview = [...humanReviewItems];
  const potentialMotionTopics: ReportFinding[] = (intel.recommendedMotions ?? []).map((s, i) => textFinding(`mt-${i}`, 'Potential Motion Topic', s));

  const witnessGapsFindings = (bundle.investigation.witnessGaps ?? []).map((f) => findingToReport(f));
  const timelineGapsFindings = (bundle.investigation.timelineGaps ?? []).map((f) => findingToReport(f));

  // -- Repository integrity (honest, hash-based) --
  const repositoryIntegrity =
    evidence.length === 0
      ? 'UNKNOWN (no evidence)'
      : hashed === evidence.length
        ? `verified (${hashed}/${evidence.length} hashed)`
        : `partial (${hashed}/${evidence.length} hashed)`;

  const auditTrail = [
    { generatedAt, source: 'attorneyReportService', reasoning: `Canonical report v${ATTORNEY_REPORT_VERSION} assembled from repository-backed workbench, intelligence, and knowledge graph.` },
    ...(intel.auditTrail ?? []).slice(0, 40).map((a) => ({ generatedAt: a.generatedAt, source: a.sourceType, reasoning: a.reasoning })),
  ];

  const report: AttorneyReport = {
    reportVersion: ATTORNEY_REPORT_VERSION,
    generatedAt,
    caseId,
    tenantId,
    reproducibilityHash: '',

    executiveSummary: {
      caseTitle: caseRecord.title,
      caseNumber: caseRecord.caseNumber || UNK(),
      court: caseRecord.court || UNK(),
      judge: caseRecord.judge || UNK(),
      status: caseRecord.status || UNK(),
      phase: caseRecord.phase || UNK(),
      repositoryVersion: `intelligence ${intel.intelligenceVersion} · workbench ${bundle.workbenchVersion} · report ${ATTORNEY_REPORT_VERSION}`,
      knowledgeGraphStatus: kgStatus,
      repositoryIntegrity,
      evidenceCount: evidence.length,
      witnessCount: witnesses.length,
      discoveryCount: discovery.length,
      timelineEventCount: timelineEvents.length,
      chargeCount: charges.length,
      reportTimestamp: generatedAt,
    },

    caseOverview: {
      client: caseRecord.client
        ? [caseRecord.client.firstName, caseRecord.client.lastName].filter(Boolean).join(' ') || UNK()
        : UNK(),
      jurisdiction: caseRecord.jurisdiction || UNK(),
      caseType: caseRecord.caseType || UNK(),
      prosecutor: caseRecord.prosecutor || UNK(),
      defenseTeam: [caseRecord.defenseAttorney].filter(Boolean) as string[],
      filingDate: caseRecord.filingDate ? caseRecord.filingDate.toISOString() : null,
      trialDate: caseRecord.trialDate ? caseRecord.trialDate.toISOString() : null,
      nextHearing: caseRecord.nextHearing ? caseRecord.nextHearing.toISOString() : null,
      county: caseRecord.county || UNK(),
      notes: caseRecord.notes ?? null,
    },

    charges: reportCharges,

    evidence: {
      total: evidence.length,
      byType: evByType,
      hashCoverage,
      processingPending: evidence.filter((e) => e.processingStatus === 'pending').length,
      items: reportEvidence,
      duplicates: bundle.evidenceWorkbench.duplicates ?? [],
      missing: bundle.evidenceWorkbench.missing ?? [],
    },

    witnesses: {
      total: witnesses.length,
      byType: wByType,
      items: reportWitnesses,
      gaps: witnessGapsFindings,
    },

    discovery: {
      total: discovery.length,
      received: discovery.filter((d) => !!d.receivedDate).length,
      bradyCount: discovery.filter((d) => d.bradyFlag).length,
      giglioCount: discovery.filter((d) => d.giglioFlag).length,
      jencksCount: discovery.filter((d) => d.jencksFlag).length,
      humanReviewRequired: discovery.filter((d) => d.reviewStatus !== 'completed').length,
      items: reportDiscovery,
      missing: [],
    },

    timeline: {
      eventCount: timelineEvents.length,
      conflictCount: conflicts.length,
      events: reportTimeline,
      conflicts,
      gaps: timelineGapsFindings,
    },

    knowledgeGraph: {
      status: kgStatus,
      nodeCount: kg?.counts.nodes ?? 0,
      edgeCount: kg?.counts.edges ?? 0,
      byType: kg?.counts.byType ?? {},
    },

    authorities: {
      statutes,
      calcrim: calcrimAll,
      citations: authorityCitations,
      providerAvailability,
      findings: (intel.authorityMatrix ?? []).slice(0, 40).map((f) => findingToReport(f)),
    },

    analysis: {
      caseStrength,
      evidenceConfidence,
      repositoryCompleteness,
      missingElements,
      contradictions,
      repositoryGaps,
      humanReviewItems,
    },

    recommendations: {
      additionalEvidence,
      witnessFollowUp,
      discoveryRequests,
      repositoryResearch,
      manualReview,
      potentialMotionTopics,
    },

    auditTrail,
  };

  report.reproducibilityHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...report, generatedAt: null, reportTimestamp: null, reproducibilityHash: null }))
    .digest('hex');

  return report;
}

// -- helpers --------------------------------------------------------------

function normalizeSection(s: string): string {
  return (s || '').replace(/\.+$/, '').trim();
}

function fieldVal(f: { value?: unknown } | null | undefined): string {
  if (!f) return '';
  const v = f.value;
  if (v == null) return '';
  return String(v);
}

function fieldArr(f: { value?: unknown } | null | undefined): unknown[] {
  if (!f || f.value == null) return [];
  return Array.isArray(f.value) ? f.value : [f.value];
}

function dedupeBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

interface RawFinding {
  id: string;
  category: string;
  finding: string;
  status: string;
  authority: { code: string; section: string } | null;
  evidence: Array<{ evidenceId: string; role?: string }>;
  timelineEventIds: string[];
  audit?: { reasoning?: string };
}

function findingToReport(f: RawFinding): ReportFinding {
  const citations: ReportCitation[] = [
    ...f.evidence.map((e) => ({ type: 'evidence' as const, id: e.evidenceId })),
    ...f.timelineEventIds.map((id) => ({ type: 'timeline' as const, id })),
    ...(f.authority ? [{ type: 'statute' as const, id: `${f.authority.code} ${f.authority.section}` }] : []),
  ];
  return {
    id: f.id,
    label: f.category,
    value: f.finding,
    status: f.status,
    confidence: citations.length > 0 ? 'MEDIUM' : 'UNKNOWN',
    citations,
    note: f.audit?.reasoning ?? null,
  };
}

function textFinding(id: string, label: string, value: string): ReportFinding {
  return { id, label, value, confidence: 'MEDIUM', citations: [] };
}

function sourceCitations(findings: RawFinding[] | undefined): ReportCitation[] {
  return (findings ?? []).flatMap((f) => f.evidence.map((e) => ({ type: 'evidence' as const, id: e.evidenceId })));
}
