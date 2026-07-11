// ============================================================================
// Program 90 — Canonical Trial Preparation Command Center
//
// Repository-backed trial preparation. Every readiness metric, exhibit,
// witness-prep item, and checklist entry is derived from the case repository.
// Nothing is fabricated: UNKNOWN is emitted wherever repository evidence is
// insufficient. No trial strategy, testimony, exhibits, or authorities are
// invented.
// ============================================================================

import crypto from 'crypto';
import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';
import { buildAttorneyReport, type AttorneyReport } from '../report/attorneyReportService.js';

export const TRIAL_PREP_VERSION = '1.0.0';

const UNK = 'UNKNOWN';

export interface TrialCitation {
  type: 'evidence' | 'authority' | 'statute' | 'calcrim' | 'timeline' | 'witness' | 'discovery' | 'repository' | 'kg' | 'audit';
  id: string;
  label?: string;
}

export interface TrialReadinessMetric {
  id: string;
  label: string;
  value: string;
  score: number | null; // 0..100 or null=UNKNOWN
  status: 'ready' | 'partial' | 'incomplete' | 'unknown';
  note: string;
}

export interface TrialWitnessPrep {
  id: string;
  name: string;
  witnessType: string;
  role: string;
  statementStatus: string;
  interviewStatus: string;
  credibilityStatus: string;
  evidenceLinks: string[];
  timelineLinks: string[];
  knowledgeGraphLinked: boolean;
  potentialImpeachment: Array<{ text: string; citations: TrialCitation[] }>;
  priorStatements: string;
  crossExaminationNotes: Array<{ text: string; citations: TrialCitation[] }>;
}

export interface TrialExhibit {
  exhibitNumber: string;
  evidenceItem: string;
  repositoryId: string;
  evidenceType: string;
  hashVerification: string;
  chainOfCustody: string;
  ocrStatus: string;
  admissionStatus: string; // UNKNOWN — attorney/court determined
  relatedWitnesses: string[];
  relatedTimelineEvents: string[];
  knowledgeGraphLinked: boolean;
}

export interface TrialTimelineEvent {
  id: string;
  bucket: 'incident' | 'investigation' | 'discovery' | 'court' | 'evidence' | 'witness' | 'other';
  timestamp: string | null;
  timeText: string | null;
  description: string;
  actor: string | null;
  citations: TrialCitation[];
}

export interface TrialChecklistItem {
  id: string;
  label: string;
  status: 'ready' | 'incomplete' | 'unknown';
  detail: string;
  citations: TrialCitation[];
}

export interface TrialNotebookItem {
  id: string;
  title: string;
  detail: string;
  confidence: string;
  citations: TrialCitation[];
}

export interface TrialPrepReport {
  trialPrepVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;

  header: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    attorney: string;
    trialDate: string | null;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    repositoryIntegrity: string;
    generatedAt: string;
  };

  dashboard: {
    caseReadiness: TrialReadinessMetric;
    evidenceReadiness: TrialReadinessMetric;
    witnessReadiness: TrialReadinessMetric;
    motionReadiness: TrialReadinessMetric;
    discoveryStatus: TrialReadinessMetric;
    repositoryCoverage: TrialReadinessMetric;
    knowledgeGraphHealth: TrialReadinessMetric;
    timelineCompleteness: TrialReadinessMetric;
    humanReview: TrialReadinessMetric;
  };

  witnessPrep: TrialWitnessPrep[];
  exhibits: TrialExhibit[];
  trialTimeline: {
    buckets: Record<string, number>;
    events: TrialTimelineEvent[];
  };
  authorities: AttorneyReport['authorities'];
  checklist: TrialChecklistItem[];
  notebook: {
    issueList: TrialNotebookItem[];
    voirDire: TrialNotebookItem[];
    opening: TrialNotebookItem[];
    closing: TrialNotebookItem[];
    directExamination: TrialNotebookItem[];
    crossExamination: TrialNotebookItem[];
    objections: TrialNotebookItem[];
    trialNotebook: TrialNotebookItem[];
  };
  knowledgeGraph: AttorneyReport['knowledgeGraph'];
}

function metric(id: string, label: string, score: number | null, valueLabel: string | undefined, note: string): TrialReadinessMetric {
  if (score == null || Number.isNaN(score)) {
    return { id, label, value: UNK, score: null, status: 'unknown', note: note || 'Insufficient repository evidence to compute.' };
  }
  const status = score >= 80 ? 'ready' : score >= 50 ? 'partial' : 'incomplete';
  return { id, label, value: `${valueLabel ?? String(score)} (${score}/100)`, score, status, note };
}

function classifyTimeline(sourceType: string | null, description: string): TrialTimelineEvent['bucket'] {
  const s = `${sourceType ?? ''} ${description}`.toLowerCase();
  if (/discovery|produced|disclosure|brady|giglio|jencks/.test(s)) return 'discovery';
  if (/court|hearing|arraign|motion|trial|plea|sentenc/.test(s)) return 'court';
  if (/investigat|interview|search|warrant|forensic|lab/.test(s)) return 'investigation';
  if (/witness|statement|testimony/.test(s)) return 'witness';
  if (/evidence|photo|video|bodycam|dashcam|report|exhibit/.test(s)) return 'evidence';
  if (/incident|offense|arrest|scene|911|dispatch/.test(s)) return 'incident';
  return 'other';
}

export async function buildTrialPrep(
  caseId: string,
  tenantId: string,
  userId: string,
): Promise<TrialPrepReport | null> {
  const bundle = await buildAttorneyWorkbench(caseId, tenantId, userId);
  if (!bundle) return null;
  const report = await buildAttorneyReport(caseId, tenantId, userId, bundle);
  if (!report) return null;

  const generatedAt = new Date().toISOString();
  const cc = bundle.commandCenter;
  const tp = bundle.trialPreparation;

  // ---- Dashboard (Phase 2) ----
  const evidenceAnalyzed = report.evidence.items.filter((e) => e.analysisStatus === 'completed' || e.processingStatus === 'analyzed').length;
  const witnessInterviewed = report.witnesses.items.filter((w) => w.interviewStatus === 'completed').length;
  const discoveryReviewed = report.discovery.items.filter((d) => d.reviewStatus === 'completed').length;

  const dashboard = {
    caseReadiness: metric('rd-case', 'Case Readiness', cc?.caseHealth?.score ?? null, cc?.caseHealth?.label, (cc?.caseHealth?.factors ?? []).join('; ')),
    evidenceReadiness: metric(
      'rd-ev', 'Evidence Readiness',
      report.evidence.total > 0 ? Math.round((evidenceAnalyzed / report.evidence.total) * 100) : null,
      `${evidenceAnalyzed}/${report.evidence.total} analyzed`,
      `Hash coverage: ${report.evidence.hashCoverage}; pending: ${report.evidence.processingPending}.`,
    ),
    witnessReadiness: metric(
      'rd-wit', 'Witness Readiness',
      report.witnesses.total > 0 ? Math.round((witnessInterviewed / report.witnesses.total) * 100) : null,
      `${witnessInterviewed}/${report.witnesses.total} interviewed`,
      report.witnesses.total === 0 ? 'No witnesses recorded.' : `${report.witnesses.gaps.length} witness gap(s) flagged.`,
    ),
    motionReadiness: metric('rd-mot', 'Motion Readiness', null, undefined, `${report.recommendations.potentialMotionTopics.length} potential motion topic(s); motion filing status is not tracked in the repository (UNKNOWN).`),
    discoveryStatus: metric(
      'rd-disc', 'Discovery Status',
      report.discovery.total > 0 ? Math.round((discoveryReviewed / report.discovery.total) * 100) : null,
      `${discoveryReviewed}/${report.discovery.total} reviewed`,
      `Brady ${report.discovery.bradyCount} · Giglio ${report.discovery.giglioCount} · Jencks ${report.discovery.jencksCount}.`,
    ),
    repositoryCoverage: metric('rd-cov', 'Repository Coverage', cc?.legalCoverage?.score ?? null, cc?.legalCoverage?.label, `${cc?.legalCoverage?.offensesCovered ?? 0}/${cc?.legalCoverage?.offensesTotal ?? 0} offenses covered.`),
    knowledgeGraphHealth: metric(
      'rd-kg', 'Knowledge Graph Health',
      report.knowledgeGraph.status === 'generated' ? Math.min(100, report.knowledgeGraph.nodeCount * 5) : report.knowledgeGraph.status === 'empty' ? 0 : null,
      report.knowledgeGraph.status,
      `${report.knowledgeGraph.nodeCount} nodes · ${report.knowledgeGraph.edgeCount} edges.`,
    ),
    timelineCompleteness: metric('rd-tl', 'Timeline Completeness', cc?.timelineCoverage?.score ?? null, cc?.timelineCoverage?.label, `${report.timeline.eventCount} event(s) · ${report.timeline.conflictCount} conflict(s).`),
    humanReview: metric('rd-hr', 'Human Review', report.analysis.humanReviewItems.length === 0 ? 100 : 0, report.analysis.humanReviewItems.length === 0 ? 'No open items' : `${report.analysis.humanReviewItems.length} open`, report.analysis.humanReviewItems.slice(0, 5).join('; ') || 'No repository items flagged for human review.'),
  };

  // ---- Witness Preparation (Phase 3) ----
  const impeachmentByWitness = tp.impeachmentOpportunities ?? [];
  const crossTopics = tp.crossExaminationTopics ?? [];
  const witnessPrep: TrialWitnessPrep[] = report.witnesses.items.map((w) => {
    const nameLc = w.name.toLowerCase();
    const timelineLinks = report.timeline.events.filter((t) => (t.actor ?? '').toLowerCase() === nameLc).map((t) => t.id);
    const relImpeach = impeachmentByWitness
      .filter((i) => i.title.toLowerCase().includes(nameLc) || i.detail.toLowerCase().includes(nameLc))
      .map((i) => ({ text: i.detail || i.title, citations: (i.citations ?? []).map((c) => ({ type: c.type as TrialCitation['type'], id: c.id, label: c.label })) }));
    const relCross = crossTopics
      .filter((i) => i.title.toLowerCase().includes(nameLc) || i.detail.toLowerCase().includes(nameLc))
      .map((i) => ({ text: i.detail || i.title, citations: (i.citations ?? []).map((c) => ({ type: c.type as TrialCitation['type'], id: c.id, label: c.label })) }));
    return {
      id: w.id,
      name: w.name,
      witnessType: w.witnessType,
      role: w.role,
      statementStatus: w.status,
      interviewStatus: w.interviewStatus,
      credibilityStatus: w.credibilityStatus,
      evidenceLinks: [],
      timelineLinks,
      knowledgeGraphLinked: report.knowledgeGraph.byType['witness'] != null,
      potentialImpeachment: relImpeach,
      priorStatements: UNK,
      crossExaminationNotes: relCross,
    };
  });

  // ---- Exhibit Manager (Phase 4) ----
  const exhibits: TrialExhibit[] = report.evidence.items.map((e, i) => ({
    exhibitNumber: String(i + 1),
    evidenceItem: e.fileName,
    repositoryId: e.evidenceId,
    evidenceType: e.evidenceType,
    hashVerification: e.sha256 ? `SHA-256 ${e.sha256.slice(0, 16)}…` : UNK,
    chainOfCustody: e.chainOfCustody,
    ocrStatus: e.processingStatus,
    admissionStatus: UNK,
    relatedWitnesses: [],
    relatedTimelineEvents: e.timelineLinked ? ['linked'] : [],
    knowledgeGraphLinked: report.knowledgeGraph.byType['evidence'] != null,
  }));

  // ---- Trial Timeline (Phase 5) ----
  const events: TrialTimelineEvent[] = report.timeline.events.map((t) => ({
    id: t.id,
    bucket: classifyTimeline(t.sourceType, t.description),
    timestamp: t.timestamp,
    timeText: t.timeText,
    description: t.description,
    actor: t.actor,
    citations: [{ type: 'timeline', id: t.id }],
  }));
  const buckets: Record<string, number> = {};
  for (const e of events) buckets[e.bucket] = (buckets[e.bucket] ?? 0) + 1;

  // ---- Trial Checklist (Phase 7) ----
  const ck = (id: string, label: string, ready: boolean | null, detail: string, citations: TrialCitation[] = []): TrialChecklistItem => ({
    id, label, status: ready == null ? 'unknown' : ready ? 'ready' : 'incomplete', detail, citations,
  });
  const checklist: TrialChecklistItem[] = [
    ck('ck-ev', 'Evidence Ready', report.evidence.total > 0 ? report.evidence.processingPending === 0 : null, report.evidence.total === 0 ? 'No evidence uploaded (UNKNOWN).' : `${evidenceAnalyzed}/${report.evidence.total} analyzed; ${report.evidence.processingPending} pending.`, report.evidence.items.slice(0, 5).map((e) => ({ type: 'evidence' as const, id: e.evidenceId, label: e.fileName }))),
    ck('ck-wit', 'Witness Ready', report.witnesses.total > 0 ? witnessInterviewed === report.witnesses.total : null, report.witnesses.total === 0 ? 'No witnesses recorded (UNKNOWN).' : `${witnessInterviewed}/${report.witnesses.total} interviewed.`, report.witnesses.items.slice(0, 5).map((w) => ({ type: 'witness' as const, id: w.id, label: w.name }))),
    ck('ck-disc', 'Discovery Reviewed', report.discovery.total > 0 ? discoveryReviewed === report.discovery.total : null, report.discovery.total === 0 ? 'No discovery recorded (UNKNOWN).' : `${discoveryReviewed}/${report.discovery.total} reviewed.`, report.discovery.items.slice(0, 5).map((d) => ({ type: 'discovery' as const, id: d.id, label: d.title }))),
    ck('ck-mot', 'Motions Filed', null, 'Motion filing status is not tracked in the repository (UNKNOWN). Use the Motion Builder to draft motions.', []),
    ck('ck-auth', 'Authorities Reviewed', report.authorities.statutes.length > 0 ? true : null, report.authorities.statutes.length > 0 ? `${report.authorities.statutes.length} repository-verified statute(s).` : 'No repository authorities linked (UNKNOWN).', report.authorities.statutes.slice(0, 5).map((s) => ({ type: 'statute' as const, id: `${s.code} ${s.section}`, label: s.title }))),
    ck('ck-calcrim', 'CALCRIM Reviewed', report.authorities.calcrim.length > 0 ? true : null, report.authorities.calcrim.length > 0 ? `${report.authorities.calcrim.length} instruction(s) linked.` : 'No CALCRIM linked (UNKNOWN).', report.authorities.calcrim.slice(0, 5).map((c) => ({ type: 'calcrim' as const, id: c.instructionNumber, label: c.title }))),
    ck('ck-repo', 'Repository Complete', cc?.legalCoverage?.score != null ? cc.legalCoverage.score >= 80 : null, `Coverage: ${cc?.legalCoverage?.label ?? UNK}.`, []),
    ck('ck-hr', 'Human Review', report.analysis.humanReviewItems.length === 0 ? true : false, report.analysis.humanReviewItems.length === 0 ? 'No open human-review items.' : `${report.analysis.humanReviewItems.length} item(s) require review.`, []),
  ];

  // ---- Trial Notebook (Phase 8) ----
  const nb = (arr: typeof tp.trialNotebook): TrialNotebookItem[] =>
    (arr ?? []).map((i) => ({ id: i.id, title: i.title, detail: i.detail, confidence: i.confidence, citations: (i.citations ?? []).map((c) => ({ type: c.type as TrialCitation['type'], id: c.id, label: c.label })) }));
  const issueList: TrialNotebookItem[] = [
    ...report.analysis.contradictions.map((c) => ({ id: `iss-${c.id}`, title: 'Contradiction', detail: c.value, confidence: c.confidence ?? 'UNKNOWN', citations: c.citations.map((x) => ({ type: x.type as TrialCitation['type'], id: x.id })) })),
    ...report.analysis.missingElements.map((c) => ({ id: `iss-${c.id}`, title: 'Missing Element', detail: c.label, confidence: c.confidence ?? 'UNKNOWN', citations: c.citations.map((x) => ({ type: x.type as TrialCitation['type'], id: x.id })) })),
  ];

  const trialPrep: TrialPrepReport = {
    trialPrepVersion: TRIAL_PREP_VERSION,
    generatedAt,
    caseId,
    tenantId,
    reproducibilityHash: '',
    header: {
      caseTitle: report.executiveSummary.caseTitle,
      caseNumber: report.executiveSummary.caseNumber,
      court: report.executiveSummary.court,
      judge: report.executiveSummary.judge,
      attorney: report.caseOverview.defenseTeam[0] || UNK,
      trialDate: report.caseOverview.trialDate,
      repositoryVersion: report.executiveSummary.repositoryVersion,
      knowledgeGraphStatus: report.executiveSummary.knowledgeGraphStatus,
      repositoryIntegrity: report.executiveSummary.repositoryIntegrity,
      generatedAt,
    },
    dashboard,
    witnessPrep,
    exhibits,
    trialTimeline: { buckets, events },
    authorities: report.authorities,
    checklist,
    notebook: {
      issueList,
      voirDire: nb(tp.voirDireNotes),
      opening: nb(tp.openingOutline),
      closing: nb(tp.closingOutline),
      directExamination: nb(tp.witnessList),
      crossExamination: nb(tp.crossExaminationTopics),
      objections: nb(tp.impeachmentOpportunities),
      trialNotebook: nb(tp.trialNotebook),
    },
    knowledgeGraph: report.knowledgeGraph,
  };

  trialPrep.reproducibilityHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...trialPrep, generatedAt: null, reproducibilityHash: null, header: { ...trialPrep.header, generatedAt: null } }))
    .digest('hex');

  return trialPrep;
}
