// ============================================================================
// Program 108 — Evidence-Governed Litigation Assistant
// A DETERMINISTIC question-answering layer over the already-computed attorney
// intelligence bundle + unified search. It does NOT call an LLM and never
// generates free-form legal conclusions: every answer is assembled from real
// case records and returned inside an AI Safety Envelope (Program 118). When
// nothing supports an answer, it returns UNKNOWN — never a guess.
//
// Supported questions:
//   • What evidence supports <X>?
//   • What contradicts <X>?
//   • Which elements remain unsupported?
//   • What authority applies (to <X>)?
//   • What evidence is missing?
//   • Which witnesses discuss <X>?
//   • Which documents mention <X>?
// ============================================================================

import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';
import type { AttorneyWorkbenchBundle, CitationRef } from '../workbench/types.js';
import type { EvidenceRef, IntelligenceFinding, ElementAnalysisRow } from '../intelligence/types.js';
import { searchCaseData } from '../search/searchService.js';
import type { AuthUser } from '../membership/resourceAuthMiddleware.js';
import {
  buildEnvelope,
  unknownEnvelope,
  validateEnvelope,
  type AiSafetyEnvelope,
  type EnvelopeEvidence,
  type EnvelopeAuthority,
  type ConfidenceLevel,
} from '../ai/aiSafetyEnvelope.js';

export const ASSISTANT_VERSION = '1.0.0';

export type AssistantIntent =
  | 'supporting_evidence'
  | 'contradicting_evidence'
  | 'unsupported_elements'
  | 'applicable_authority'
  | 'missing_evidence'
  | 'witnesses'
  | 'documents'
  | 'unrecognized';

export interface AssistantAnswerItem {
  label: string;
  detail: string;
  status?: string;
  citations: Array<{ kind: string; id: string; label?: string }>;
}

export interface AssistantAnswer {
  intent: AssistantIntent;
  subject: string | null;
  summary: string;
  items: AssistantAnswerItem[];
}

export interface AssistantResponse {
  caseId: string;
  question: string;
  intent: AssistantIntent;
  envelope: AiSafetyEnvelope<AssistantAnswer>;
  envelopeValid: boolean;
  envelopeErrors: string[];
}

const SUPPORTED_QUESTIONS = [
  'What evidence supports <subject>?',
  'What contradicts <subject>?',
  'Which elements remain unsupported?',
  'What authority applies to <subject>?',
  'What evidence is missing?',
  'Which witnesses discuss <subject>?',
  'Which documents mention <subject>?',
];

const SUPPORTED_STATUSES = new Set(['established', 'satisfied']);
const CONTRA_STATUSES = new Set(['contradicted', 'disputed']);

// ── Intent classification (deterministic keyword patterns) ───────────────────
interface IntentRule {
  intent: AssistantIntent;
  test: RegExp;
  strip: RegExp;
}
const INTENT_RULES: IntentRule[] = [
  { intent: 'unsupported_elements', test: /\b(unsupported|unproven|which elements|elements? (that )?(remain|are)|missing element)\b/i, strip: /.*/i },
  { intent: 'missing_evidence', test: /\b(missing|gap|absent|what.*(missing|need)|not (yet )?(collected|obtained))\b.*\bevidence|evidence.*\b(missing|gap|absent)\b|what evidence is missing/i, strip: /.*/i },
  { intent: 'contradicting_evidence', test: /\b(contradict|contradicts|conflict|refute|rebut|inconsisten|dispute)\b/i, strip: /\b(what|which|show|list|find)?\s*(evidence|facts?)?\s*(contradicts?|conflicts?( with)?|refutes?|rebuts?|disputes?)\b/i },
  { intent: 'applicable_authority', test: /\b(authority|authorities|statute|case ?law|calcrim|what law|which law|precedent|jury instruction)\b/i, strip: /\b(what|which|show|list|find)?\s*(authority|authorities|statutes?|case ?law|calcrim|law|precedents?|jury instructions?)\s*(applies|apply|applicable|for|to|governs?)?\b/i },
  { intent: 'witnesses', test: /\bwitness(es)?\b/i, strip: /\b(what|which|who|show|list|find)?\s*(witness(es)?)\s*(discuss(es|ed)?|mention(s|ed)?|testif|about|for|to|regarding)?\b/i },
  { intent: 'documents', test: /\b(document|documents|report|reports|file|files|record|records|mention|mentions)\b/i, strip: /\b(what|which|show|list|find)?\s*(documents?|reports?|files?|records?)\s*(mention(s|ed)?|discuss(es|ed)?|reference|about|for|to|contain(s|ing)?)?\b/i },
  { intent: 'supporting_evidence', test: /\b(support|supports|supporting|evidence for|prove|proves|corroborat)\b/i, strip: /\b(what|which|show|list|find)?\s*(evidence|facts?)?\s*(supports?|supporting|for|proves?|corroborates?)\b/i },
];

export function classifyIntent(question: string): { intent: AssistantIntent; subject: string | null } {
  const q = question.trim();
  for (const rule of INTENT_RULES) {
    if (rule.test.test(q)) {
      const subject = extractSubject(q, rule.strip);
      return { intent: rule.intent, subject };
    }
  }
  return { intent: 'unrecognized', subject: null };
}

function extractSubject(question: string, strip: RegExp): string | null {
  let s = question
    .replace(/^[\s"']+|["'?.\s]+$/g, '')
    .replace(strip, ' ')
    .replace(/\b(the|a|an|in|on|of|this|that|case|regarding|about|please|can you|tell me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length >= 2 ? s : null;
}

function subjectMatches(subject: string | null, ...fields: Array<string | null | undefined>): boolean {
  if (!subject) return true;
  const terms = subject.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return terms.some((t) => hay.includes(t));
}

// ── Citation mapping ─────────────────────────────────────────────────────────
function evidenceRefsToEnvelope(refs: EvidenceRef[]): EnvelopeEvidence[] {
  return refs.map((r) => ({ evidenceId: r.evidenceId, role: r.role, excerpt: r.excerpt }));
}

function citationRefsSplit(cites: CitationRef[]): { evidence: EnvelopeEvidence[]; authorities: EnvelopeAuthority[] } {
  const evidence: EnvelopeEvidence[] = [];
  const authorities: EnvelopeAuthority[] = [];
  for (const c of cites) {
    if (c.type === 'evidence') evidence.push({ evidenceId: c.id, role: 'source', label: c.label });
    else if (c.type === 'authority' || c.type === 'repository') authorities.push({ authorityId: c.id, label: c.label });
    else evidence.push({ evidenceId: c.id, role: 'mentions', label: c.label });
  }
  return { evidence, authorities };
}

function citationList(evidence: EnvelopeEvidence[], authorities: EnvelopeAuthority[]): AssistantAnswerItem['citations'] {
  return [
    ...evidence.map((e) => ({ kind: `evidence:${e.role}`, id: e.evidenceId, label: e.label })),
    ...authorities.map((a) => ({ kind: 'authority', id: a.authorityId ?? `${a.code ?? ''} ${a.section ?? ''}`.trim(), label: a.label })),
  ];
}

function rankConfidence(rows: Array<{ confidence: ConfidenceLevel }>): ConfidenceLevel {
  const order: ConfidenceLevel[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  for (const level of order) if (rows.some((r) => r.confidence === level)) return level;
  return 'UNKNOWN';
}

function allElementRows(bundle: AttorneyWorkbenchBundle): ElementAnalysisRow[] {
  return bundle.elementMatrices.flatMap((m) => m.rows);
}

// ── Intent handlers ──────────────────────────────────────────────────────────
function answerSupportingEvidence(bundle: AttorneyWorkbenchBundle, subject: string | null, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const rows = allElementRows(bundle).filter(
    (r) => r.supportingEvidence.length > 0 && subjectMatches(subject, r.elementLabel, r.code, r.section),
  );
  const evidence: EnvelopeEvidence[] = [];
  const authorities: EnvelopeAuthority[] = [];
  const items: AssistantAnswerItem[] = [];
  for (const r of rows) {
    const ev = evidenceRefsToEnvelope(r.supportingEvidence);
    const auth: EnvelopeAuthority = { code: r.code, section: r.section, elementId: undefined, label: r.elementLabel } as EnvelopeAuthority;
    evidence.push(...ev);
    authorities.push(auth);
    items.push({
      label: `${r.code} ${r.section} — ${r.elementLabel}`,
      detail: `${r.supportingEvidence.length} supporting item(s); status: ${r.status}`,
      status: r.status,
      citations: citationList(ev, [auth]),
    });
  }
  const answer: AssistantAnswer = {
    intent: 'supporting_evidence',
    subject,
    summary: items.length
      ? `Found supporting evidence across ${items.length} element(s).`
      : 'No supporting evidence found for the requested subject.',
    items,
  };
  if (items.length === 0) return unknownEnvelope(answer, 'No element rows carry supporting evidence for the subject.', ['ElementMatrix'], generatedAt);
  return buildEnvelope({
    answer,
    evidence,
    authorities,
    confidence: rankConfidence(rows),
    reasoning: 'Assembled from attorney intelligence element matrices (supportingEvidence).',
    repositorySources: ['ElementMatrix', 'EvidenceRepository'],
    pipelineVersion: ASSISTANT_VERSION,
    generatedAt,
  });
}

function answerContradictingEvidence(bundle: AttorneyWorkbenchBundle, subject: string | null, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const rows = allElementRows(bundle).filter(
    (r) => (r.contradictoryEvidence.length > 0 || CONTRA_STATUSES.has(r.status)) && subjectMatches(subject, r.elementLabel, r.code, r.section),
  );
  const findings = bundle.intelligence.contradictionAnalysis.filter((f) => subjectMatches(subject, f.finding, f.category));
  const evidence: EnvelopeEvidence[] = [];
  const authorities: EnvelopeAuthority[] = [];
  const items: AssistantAnswerItem[] = [];

  for (const r of rows) {
    const ev = evidenceRefsToEnvelope(r.contradictoryEvidence);
    const auth: EnvelopeAuthority = { code: r.code, section: r.section, label: r.elementLabel } as EnvelopeAuthority;
    evidence.push(...ev);
    authorities.push(auth);
    items.push({ label: `${r.code} ${r.section} — ${r.elementLabel}`, detail: `status: ${r.status}; ${r.contradictoryEvidence.length} contradicting item(s)`, status: r.status, citations: citationList(ev, [auth]) });
  }
  for (const f of findings) {
    const ev = evidenceRefsToEnvelope(f.evidence);
    evidence.push(...ev);
    items.push({ label: f.category, detail: f.finding, status: f.status, citations: citationList(ev, []) });
  }

  const answer: AssistantAnswer = {
    intent: 'contradicting_evidence',
    subject,
    summary: items.length ? `Found ${items.length} contradiction(s)/dispute(s).` : 'No contradicting evidence found.',
    items,
  };
  if (items.length === 0) return unknownEnvelope(answer, 'No contradictory evidence or contradiction findings match the subject.', ['ElementMatrix', 'ContradictionAnalysis'], generatedAt);
  return buildEnvelope({
    answer,
    evidence,
    authorities,
    confidence: rankConfidence(rows.length ? rows : [{ confidence: 'MEDIUM' }]),
    reasoning: 'Assembled from element contradictoryEvidence and contradiction analysis findings.',
    repositorySources: ['ElementMatrix', 'ContradictionAnalysis'],
    pipelineVersion: ASSISTANT_VERSION,
    requireHumanReview: true,
    generatedAt,
  });
}

function answerUnsupportedElements(bundle: AttorneyWorkbenchBundle, subject: string | null, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const rows = allElementRows(bundle).filter(
    (r) => !SUPPORTED_STATUSES.has(r.status) && subjectMatches(subject, r.elementLabel, r.code, r.section),
  );
  const authorities: EnvelopeAuthority[] = rows.map((r) => ({ code: r.code, section: r.section, label: r.elementLabel }) as EnvelopeAuthority);
  const items: AssistantAnswerItem[] = rows.map((r) => ({
    label: `${r.code} ${r.section} — ${r.elementLabel}`,
    detail: r.missingEvidenceReason ?? `No supporting evidence found (status: ${r.status}).`,
    status: r.status,
    citations: citationList([], [{ code: r.code, section: r.section, label: r.elementLabel }]),
  }));
  const answer: AssistantAnswer = {
    intent: 'unsupported_elements',
    subject,
    summary: rows.length
      ? `${rows.length} charged element(s) are not yet supported by evidence and require attention.`
      : 'All analyzed charged elements currently have supporting evidence.',
    items,
  };
  // The FINDING that an element is unsupported is itself backed by the element
  // analysis + the statute defining the element (authority). Never fabricates.
  if (rows.length === 0) {
    return buildEnvelope({
      answer,
      authorities: bundle.elementMatrices.map((m) => ({ code: m.code, section: m.section, label: 'charge' }) as EnvelopeAuthority),
      confidence: 'MEDIUM',
      reasoning: 'No unsupported element rows found across element matrices.',
      repositorySources: ['ElementMatrix', 'CaliforniaCodes'],
      pipelineVersion: ASSISTANT_VERSION,
      generatedAt,
    });
  }
  return buildEnvelope({
    answer,
    authorities,
    confidence: 'MEDIUM',
    reasoning: 'Element rows whose status is not established/satisfied, with the defining statute cited as authority.',
    repositorySources: ['ElementMatrix', 'CaliforniaCodes'],
    pipelineVersion: ASSISTANT_VERSION,
    requireHumanReview: true,
    generatedAt,
  });
}

function findingsToItems(findings: IntelligenceFinding[]): { items: AssistantAnswerItem[]; evidence: EnvelopeEvidence[]; authorities: EnvelopeAuthority[] } {
  const items: AssistantAnswerItem[] = [];
  const evidence: EnvelopeEvidence[] = [];
  const authorities: EnvelopeAuthority[] = [];
  for (const f of findings) {
    const ev = evidenceRefsToEnvelope(f.evidence);
    const auth = f.authority ? [{ code: f.authority.code, section: f.authority.section, calcrimId: f.authority.calcrimId, authorityId: f.authority.authorityId } as EnvelopeAuthority] : [];
    evidence.push(...ev);
    authorities.push(...auth);
    items.push({ label: f.category, detail: f.finding, status: f.status, citations: citationList(ev, auth) });
  }
  return { items, evidence, authorities };
}

function answerApplicableAuthority(bundle: AttorneyWorkbenchBundle, subject: string | null, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const findings = [...bundle.intelligence.authorityMatrix, ...bundle.intelligence.calcrimAnalysis].filter((f) => subjectMatches(subject, f.finding, f.category, f.authority?.code, f.authority?.section));
  const { items, evidence, authorities } = findingsToItems(findings);

  // Also include applicable statutes/authorities/calcrim from offense analysis.
  for (const charge of bundle.intelligence.offenseAnalysis) {
    if (!subjectMatches(subject, charge.code, charge.section)) continue;
    for (const a of [...charge.applicableAuthorities, ...charge.applicableStatutes]) {
      authorities.push({ code: a.code, section: a.section, authorityId: a.authorityId, calcrimId: a.calcrimId });
      items.push({ label: `${a.code} ${a.section}`.trim(), detail: `Applicable to charge ${charge.code} ${charge.section}`, citations: citationList([], [{ code: a.code, section: a.section }]) });
    }
  }

  const answer: AssistantAnswer = {
    intent: 'applicable_authority',
    subject,
    summary: authorities.length ? `Identified ${authorities.length} applicable authority citation(s).` : 'No applicable authority found for the subject.',
    items,
  };
  if (authorities.length === 0 && evidence.length === 0) return unknownEnvelope(answer, 'No authority matrix / offense analysis entry matches the subject.', ['AuthorityMatrix', 'CaliforniaCodes', 'CALCRIM'], generatedAt);
  return buildEnvelope({
    answer,
    evidence,
    authorities,
    confidence: 'MEDIUM',
    reasoning: 'Assembled from authority matrix, CALCRIM analysis, and offense analysis applicable authorities.',
    repositorySources: ['AuthorityMatrix', 'CaliforniaCodes', 'CALCRIM'],
    pipelineVersion: ASSISTANT_VERSION,
    generatedAt,
  });
}

function answerMissingEvidence(bundle: AttorneyWorkbenchBundle, subject: string | null, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const inv = bundle.investigation;
  const findings = [...inv.evidenceGaps, ...inv.missingRecords, ...inv.chainOfCustodyGaps].filter((f) => subjectMatches(subject, f.finding, f.category));
  const { items, evidence, authorities } = findingsToItems(findings);
  for (const m of bundle.evidenceWorkbench.missing) {
    if (!subjectMatches(subject, m)) continue;
    items.push({ label: 'Missing evidence', detail: m, citations: [] });
  }
  const answer: AssistantAnswer = {
    intent: 'missing_evidence',
    subject,
    summary: items.length ? `${items.length} evidence gap(s)/missing record(s) identified.` : 'No evidence gaps identified for the subject.',
    items,
  };
  if (items.length === 0) return unknownEnvelope(answer, 'No evidence-gap findings match the subject.', ['InvestigativeAnalysis', 'EvidenceGapDetection'], generatedAt);
  // Gaps derived from analysis of present evidence/timeline; require review.
  return buildEnvelope({
    answer,
    evidence,
    authorities,
    confidence: evidence.length ? 'MEDIUM' : 'LOW',
    reasoning: 'Assembled from investigative evidence-gap, missing-record, and chain-of-custody findings.',
    repositorySources: ['InvestigativeAnalysis', 'EvidenceGapDetection'],
    pipelineVersion: ASSISTANT_VERSION,
    requireHumanReview: true,
    generatedAt,
  });
}

function answerWitnesses(bundle: AttorneyWorkbenchBundle, subject: string | null, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const evidence: EnvelopeEvidence[] = [];
  const authorities: EnvelopeAuthority[] = [];
  const items: AssistantAnswerItem[] = [];
  for (const w of bundle.trialPreparation.witnessList) {
    if (!subjectMatches(subject, w.title, w.detail)) continue;
    const split = citationRefsSplit(w.citations);
    evidence.push(...split.evidence);
    authorities.push(...split.authorities);
    items.push({ label: w.title, detail: w.detail, status: w.confidence, citations: citationList(split.evidence, split.authorities) });
  }
  const answer: AssistantAnswer = {
    intent: 'witnesses',
    subject,
    summary: items.length ? `${items.length} witness(es) identified from case records.` : 'No witnesses matched the subject in current case records.',
    items,
  };
  if (items.length === 0) return unknownEnvelope(answer, 'No witness-list entries (derived from timeline actors) match the subject.', ['TrialPreparation', 'CaseTimeline'], generatedAt);
  return buildEnvelope({
    answer,
    evidence,
    authorities,
    confidence: items.length ? 'MEDIUM' : 'UNKNOWN',
    reasoning: 'Assembled from trial-preparation witness list (derived from cited timeline actors).',
    repositorySources: ['TrialPreparation', 'CaseTimeline'],
    pipelineVersion: ASSISTANT_VERSION,
    generatedAt,
  });
}

async function answerDocuments(user: AuthUser, caseId: string, subject: string | null, generatedAt: string): Promise<AiSafetyEnvelope<AssistantAnswer>> {
  const query = subject ?? '';
  const search = query ? await searchCaseData(user, query, { caseId, types: ['evidence', 'ocr_text'] }) : { results: [] as Array<{ id: string; type: string; title: string; snippet: string; contentHash?: string }> };
  const evidence: EnvelopeEvidence[] = search.results.map((r) => ({ evidenceId: r.id, role: 'mentions' as const, label: r.title, excerpt: r.snippet }));
  const items: AssistantAnswerItem[] = search.results.map((r) => ({ label: r.title, detail: r.snippet, status: r.type, citations: [{ kind: `search:${r.type}`, id: r.id, label: r.title }] }));
  const answer: AssistantAnswer = {
    intent: 'documents',
    subject,
    summary: items.length ? `${items.length} document/OCR match(es) mention the subject.` : 'No documents mention the subject.',
    items,
  };
  if (!query) return unknownEnvelope(answer, 'No subject provided to search documents for.', ['EvidenceRepository', 'OCRIndex'], generatedAt);
  if (items.length === 0) return unknownEnvelope(answer, 'Unified search over evidence and OCR text returned no matches.', ['EvidenceRepository', 'OCRIndex'], generatedAt);
  return buildEnvelope({
    answer,
    evidence,
    confidence: 'MEDIUM',
    reasoning: 'Assembled from unified case search over evidence metadata and OCR/extracted text.',
    repositorySources: ['EvidenceRepository', 'OCRIndex'],
    pipelineVersion: ASSISTANT_VERSION,
    generatedAt,
  });
}

function answerUnrecognized(question: string, generatedAt: string): AiSafetyEnvelope<AssistantAnswer> {
  const answer: AssistantAnswer = {
    intent: 'unrecognized',
    subject: null,
    summary: 'The question was not recognized. The assistant only answers evidence-governed questions it can support with citations.',
    items: SUPPORTED_QUESTIONS.map((q) => ({ label: 'Supported question', detail: q, citations: [] })),
  };
  return unknownEnvelope(answer, `Unrecognized question intent: "${question.slice(0, 120)}".`, ['LitigationAssistant'], generatedAt);
}

/** Main entry point — always returns a validated AI Safety Envelope. */
export async function askLitigationAssistant(user: AuthUser, caseId: string, question: string): Promise<AssistantResponse | null> {
  const generatedAt = new Date().toISOString();
  const { intent, subject } = classifyIntent(question);

  let envelope: AiSafetyEnvelope<AssistantAnswer>;
  if (intent === 'unrecognized') {
    envelope = answerUnrecognized(question, generatedAt);
  } else if (intent === 'documents') {
    envelope = await answerDocuments(user, caseId, subject, generatedAt);
  } else {
    const bundle = await buildAttorneyWorkbench(caseId, user.tenantId, user.userId);
    if (!bundle) return null;
    switch (intent) {
      case 'supporting_evidence': envelope = answerSupportingEvidence(bundle, subject, generatedAt); break;
      case 'contradicting_evidence': envelope = answerContradictingEvidence(bundle, subject, generatedAt); break;
      case 'unsupported_elements': envelope = answerUnsupportedElements(bundle, subject, generatedAt); break;
      case 'applicable_authority': envelope = answerApplicableAuthority(bundle, subject, generatedAt); break;
      case 'missing_evidence': envelope = answerMissingEvidence(bundle, subject, generatedAt); break;
      case 'witnesses': envelope = answerWitnesses(bundle, subject, generatedAt); break;
      default: envelope = answerUnrecognized(question, generatedAt);
    }
  }

  const validation = validateEnvelope(envelope);
  return { caseId, question, intent, envelope, envelopeValid: validation.valid, envelopeErrors: validation.errors };
}
