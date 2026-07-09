// ============================================================================
// Program 89 — Canonical Motion Builder & Motion Intelligence Engine
//
// Generates repository-backed motion drafts. Every factual statement is tied
// to real repository evidence/timeline; every legal statement is tied to a
// real authority. Nothing is fabricated. Where repository evidence is
// insufficient, sections are explicitly marked UNKNOWN (attorney input
// required) rather than invented.
// ============================================================================

import crypto from 'crypto';
import { buildAttorneyReport, type AttorneyReport, type ReportFinding } from '../report/attorneyReportService.js';

export const MOTION_BUILDER_VERSION = '1.0.0';

export type MotionTypeId =
  | 'suppress'
  | 'dismiss'
  | 'in_limine'
  | 'pitchess'
  | 'brady'
  | 'discovery'
  | 'continuance'
  | 'severance'
  | 'protective_order'
  | 'expert'
  | 'preservation'
  | 'research_memo'
  | 'custom';

export interface MotionCitation {
  type: 'evidence' | 'authority' | 'statute' | 'calcrim' | 'timeline' | 'witness' | 'discovery' | 'repository' | 'kg' | 'audit';
  id: string;
  label?: string;
}

export interface MotionParagraph {
  text: string;
  citations: MotionCitation[];
  unknown?: boolean; // true → attorney input required (no repository support)
}

export interface MotionSection {
  id: string;
  title: string;
  paragraphs: MotionParagraph[];
}

export interface MotionSupportItem {
  id: string;
  label: string;
  detail?: string;
  citations: MotionCitation[];
}

export interface MotionTypeMeta {
  id: MotionTypeId;
  label: string;
  category: string;
  description: string;
  statutoryBasis: string[]; // standard controlling authority for the motion type
  repositorySupport: 'supported' | 'partial' | 'unknown';
  supportSummary: string;
}

export interface MotionDraft {
  motionVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  motionType: MotionTypeId;

  header: {
    motionTitle: string;
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    attorney: string;
    repositoryStatus: string;
    knowledgeGraphStatus: string;
    generatedAt: string;
    repositoryVersion: string;
  };

  repositoryAnalysis: {
    supportingEvidence: MotionSupportItem[];
    supportingAuthorities: MotionSupportItem[];
    supportingTimeline: MotionSupportItem[];
    supportingWitnesses: MotionSupportItem[];
    supportingDiscovery: MotionSupportItem[];
    supportingRepositoryRecords: MotionSupportItem[];
    supportingCalcrim: MotionSupportItem[];
  };

  draft: { sections: MotionSection[] };

  authorityPanel: {
    statutes: Array<{ code: string; section: string; title: string }>;
    courtListener: Array<{ citation: string; status: string }>;
    cap: Array<{ citation: string; status: string }>;
    openLaws: Array<{ citation: string; status: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
  };

  evidencePanel: {
    evidence: AttorneyReport['evidence']['items'];
    witnesses: AttorneyReport['witnesses']['items'];
    discovery: AttorneyReport['discovery']['items'];
    timeline: AttorneyReport['timeline']['events'];
    knowledgeGraph: AttorneyReport['knowledgeGraph'];
    repositoryReferences: Array<{ code: string; section: string; title: string }>;
  };

  attorneyReview: {
    repositoryConfidence: ReportFinding;
    humanReviewRequired: string[];
    repositoryGaps: ReportFinding[];
    unknownEvidence: string[];
    contradictions: ReportFinding[];
    missingAuthorities: string[];
    missingEvidence: ReportFinding[];
  };

  attorneyNotesHint: string;
}

interface MotionTypeDef {
  id: MotionTypeId;
  label: string;
  category: string;
  description: string;
  statutoryBasis: string[];
  prayer: string;
  // Which repository signals make this motion repository-supported
  relevance: (r: AttorneyReport) => { evidenceIds: Set<string>; note: string };
}

const UNK = 'UNKNOWN';

const MOTION_DEFS: Record<MotionTypeId, MotionTypeDef> = {
  suppress: {
    id: 'suppress',
    label: 'Motion to Suppress',
    category: 'Evidentiary',
    description: 'Exclude evidence obtained in violation of the defendant’s constitutional rights.',
    statutoryBasis: ['Cal. Penal Code § 1538.5', 'U.S. Const. amend. IV', 'Cal. Const. art. I, § 13'],
    prayer: 'suppress the challenged evidence and any fruits thereof',
    relevance: (r) => {
      const evidenceIds = new Set(
        r.evidence.items
          .filter((e) => ['bodycam', 'dashcam', 'police_report', 'forensic_report', 'dispatch_log'].includes(e.evidenceType) || e.chainOfCustody === 'unknown' || !e.sha256)
          .map((e) => e.evidenceId),
      );
      return { evidenceIds, note: 'Search/seizure-related evidence and chain-of-custody gaps.' };
    },
  },
  dismiss: {
    id: 'dismiss',
    label: 'Motion to Dismiss',
    category: 'Dispositive',
    description: 'Dismiss the charges for insufficiency of the evidence or legal defect.',
    statutoryBasis: ['Cal. Penal Code § 995', 'Cal. Penal Code § 1385', 'Cal. Penal Code § 1118'],
    prayer: 'dismiss the charges identified herein',
    relevance: (r) => ({ evidenceIds: new Set(r.evidence.items.map((e) => e.evidenceId)), note: 'Element sufficiency across all charges.' }),
  },
  in_limine: {
    id: 'in_limine',
    label: 'Motion in Limine',
    category: 'Evidentiary',
    description: 'Obtain a pretrial ruling excluding or limiting specific evidence at trial.',
    statutoryBasis: ['Cal. Evid. Code § 402', 'Cal. Evid. Code § 352', 'People v. Kelly (1976) 17 Cal.3d 24'],
    prayer: 'exclude or limit the evidence identified herein at trial',
    relevance: (r) => ({ evidenceIds: new Set(r.evidence.items.map((e) => e.evidenceId)), note: 'Contested or prejudicial evidence.' }),
  },
  pitchess: {
    id: 'pitchess',
    label: 'Pitchess Motion',
    category: 'Discovery',
    description: 'Seek discovery of peace officer personnel records relevant to the defense.',
    statutoryBasis: ['Cal. Evid. Code §§ 1043–1045', 'Pitchess v. Superior Court (1974) 11 Cal.3d 531', 'Cal. Penal Code § 832.7'],
    prayer: 'order in camera review and disclosure of the identified peace officer personnel records',
    relevance: (r) => {
      const officerWitnessAgencies = new Set(r.witnesses.items.filter((w) => w.witnessType === 'law_enforcement').map((w) => w.id));
      const ids = new Set(r.evidence.items.filter((e) => ['bodycam', 'dashcam', 'police_report', 'dispatch_log'].includes(e.evidenceType)).map((e) => e.evidenceId));
      return { evidenceIds: ids, note: `Law-enforcement witnesses (${officerWitnessAgencies.size}) and officer-generated evidence.` };
    },
  },
  brady: {
    id: 'brady',
    label: 'Brady Motion',
    category: 'Discovery',
    description: 'Compel disclosure of exculpatory or impeachment material in the prosecution’s possession.',
    statutoryBasis: ['Brady v. Maryland (1963) 373 U.S. 83', 'Giglio v. United States (1972) 405 U.S. 150', 'Cal. Penal Code § 1054.1(e)'],
    prayer: 'compel disclosure of all favorable material evidence',
    relevance: (r) => ({ evidenceIds: new Set(), note: `Discovery flagged Brady (${r.discovery.bradyCount}) / Giglio (${r.discovery.giglioCount}).` }),
  },
  discovery: {
    id: 'discovery',
    label: 'Discovery Motion',
    category: 'Discovery',
    description: 'Compel statutory discovery the prosecution has failed to produce.',
    statutoryBasis: ['Cal. Penal Code § 1054.1', 'Cal. Penal Code § 1054.5'],
    prayer: 'compel the outstanding statutory discovery identified herein',
    relevance: (r) => ({ evidenceIds: new Set(), note: `Discovery items on file: ${r.discovery.total}; pending review: ${r.discovery.humanReviewRequired}.` }),
  },
  continuance: {
    id: 'continuance',
    label: 'Continuance Motion',
    category: 'Procedural',
    description: 'Request a continuance of a scheduled proceeding for good cause.',
    statutoryBasis: ['Cal. Penal Code § 1050'],
    prayer: 'continue the currently scheduled proceeding',
    relevance: () => ({ evidenceIds: new Set(), note: 'Good cause must be established by counsel.' }),
  },
  severance: {
    id: 'severance',
    label: 'Severance Motion',
    category: 'Procedural',
    description: 'Sever counts or defendants for separate trial to avoid prejudice.',
    statutoryBasis: ['Cal. Penal Code § 954', 'Cal. Penal Code § 1098'],
    prayer: 'sever the counts or defendants identified herein',
    relevance: (r) => ({ evidenceIds: new Set(), note: `Charge count: ${r.charges.length}.` }),
  },
  protective_order: {
    id: 'protective_order',
    label: 'Protective Order',
    category: 'Procedural',
    description: 'Seek or oppose a protective order governing discovery materials.',
    statutoryBasis: ['Cal. Penal Code § 1054.7'],
    prayer: 'enter the protective order identified herein',
    relevance: (r) => ({ evidenceIds: new Set(), note: `Sensitive discovery items: ${r.discovery.total}.` }),
  },
  expert: {
    id: 'expert',
    label: 'Expert Motion',
    category: 'Trial',
    description: 'Appoint or authorize expert assistance, or address expert testimony.',
    statutoryBasis: ['Cal. Evid. Code § 730', 'Cal. Evid. Code § 801', 'Cal. Penal Code § 987.9'],
    prayer: 'authorize the requested expert assistance',
    relevance: (r) => ({ evidenceIds: new Set(r.evidence.items.filter((e) => ['forensic_report', 'autopsy_report'].includes(e.evidenceType)).map((e) => e.evidenceId)), note: 'Forensic/technical evidence requiring expert analysis.' }),
  },
  preservation: {
    id: 'preservation',
    label: 'Preservation Motion',
    category: 'Evidentiary',
    description: 'Compel preservation of evidence and prevent spoliation.',
    statutoryBasis: ['California v. Trombetta (1984) 467 U.S. 479', 'Arizona v. Youngblood (1988) 488 U.S. 51'],
    prayer: 'order preservation of the identified evidence',
    relevance: (r) => ({ evidenceIds: new Set(r.evidence.items.map((e) => e.evidenceId)), note: 'All evidence subject to preservation obligations.' }),
  },
  research_memo: {
    id: 'research_memo',
    label: 'Repository Research Memo',
    category: 'Research',
    description: 'A repository-backed legal research memorandum for the case.',
    statutoryBasis: [],
    prayer: 'consider the repository-backed authorities compiled herein',
    relevance: (r) => ({ evidenceIds: new Set(r.evidence.items.map((e) => e.evidenceId)), note: 'Repository authorities across all charges.' }),
  },
  custom: {
    id: 'custom',
    label: 'Custom Motion',
    category: 'Custom',
    description: 'An attorney-defined motion assembled from repository intelligence.',
    statutoryBasis: [],
    prayer: 'grant the relief identified by counsel',
    relevance: (r) => ({ evidenceIds: new Set(r.evidence.items.map((e) => e.evidenceId)), note: 'Attorney must define the legal basis.' }),
  },
};

export function listMotionTypeDefs(): MotionTypeDef[] {
  return Object.values(MOTION_DEFS);
}

function supportLevel(r: AttorneyReport, def: MotionTypeDef): { level: 'supported' | 'partial' | 'unknown'; summary: string } {
  const rel = def.relevance(r);
  const hasEvidence = rel.evidenceIds.size > 0 || r.evidence.total > 0;
  const hasAuthorities = r.authorities.statutes.length > 0 || def.statutoryBasis.length > 0;
  const specific = rel.evidenceIds.size;
  if (specific > 0 && hasAuthorities) return { level: 'supported', summary: `${specific} relevant evidence item(s); ${rel.note}` };
  if (hasEvidence || hasAuthorities) return { level: 'partial', summary: rel.note };
  return { level: 'unknown', summary: 'No repository evidence currently supports this motion — attorney input required.' };
}

export async function buildMotionTypeCatalog(
  caseId: string,
  tenantId: string,
  userId: string,
): Promise<{ caseId: string; generatedAt: string; motionTypes: MotionTypeMeta[] } | null> {
  const report = await buildAttorneyReport(caseId, tenantId, userId);
  if (!report) return null;
  const motionTypes: MotionTypeMeta[] = listMotionTypeDefs().map((def) => {
    const s = supportLevel(report, def);
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      description: def.description,
      statutoryBasis: def.statutoryBasis,
      repositorySupport: s.level,
      supportSummary: s.summary,
    };
  });
  return { caseId, generatedAt: new Date().toISOString(), motionTypes };
}

export async function buildMotionDraft(
  caseId: string,
  tenantId: string,
  userId: string,
  motionType: MotionTypeId,
): Promise<MotionDraft | null> {
  const def = MOTION_DEFS[motionType];
  if (!def) return null;
  const report = await buildAttorneyReport(caseId, tenantId, userId);
  if (!report) return null;

  const generatedAt = new Date().toISOString();
  const rel = def.relevance(report);
  const clientName = report.caseOverview.client && report.caseOverview.client !== UNK ? report.caseOverview.client : 'the Defendant';

  // ---- Repository analysis (supporting items, all from real data) ----
  const relevantEvidence = report.evidence.items.filter((e) => rel.evidenceIds.has(e.evidenceId));
  const evidenceForSupport = relevantEvidence.length > 0 ? relevantEvidence : report.evidence.items;

  const supportingEvidence: MotionSupportItem[] = evidenceForSupport.map((e) => ({
    id: e.evidenceId,
    label: e.fileName,
    detail: `${e.evidenceType} · ${e.sha256 ? 'hash ' + e.sha256.slice(0, 10) + '…' : 'hash UNKNOWN'} · chain: ${e.chainOfCustody}`,
    citations: [{ type: 'evidence', id: e.evidenceId, label: e.fileName }],
  }));

  const supportingAuthorities: MotionSupportItem[] = [
    ...def.statutoryBasis.map((c, i) => ({
      id: `basis-${i}`,
      label: c,
      detail: 'Standard controlling authority for this motion type — counsel must confirm applicability.',
      citations: [{ type: 'authority' as const, id: c, label: c }],
    })),
    ...report.authorities.statutes.map((s) => ({
      id: `${s.code}-${s.section}`,
      label: `${s.code} ${s.section}`,
      detail: s.title,
      citations: [{ type: 'statute' as const, id: `${s.code} ${s.section}`, label: s.title }],
    })),
  ];

  const supportingTimeline: MotionSupportItem[] = report.timeline.events.map((t) => ({
    id: t.id,
    label: t.timestamp ? new Date(t.timestamp).toLocaleString() : (t.timeText || UNK),
    detail: t.description,
    citations: [{ type: 'timeline', id: t.id }],
  }));

  const supportingWitnesses: MotionSupportItem[] = report.witnesses.items.map((w) => ({
    id: w.id,
    label: w.name,
    detail: `${w.witnessType}${w.agency ? ' · ' + w.agency : ''} · credibility: ${w.credibilityStatus}`,
    citations: [{ type: 'witness', id: w.id, label: w.name }],
  }));

  const supportingDiscovery: MotionSupportItem[] = report.discovery.items.map((d) => ({
    id: d.id,
    label: d.title,
    detail: `${d.category}${d.bradyFlag ? ' · Brady' : ''}${d.giglioFlag ? ' · Giglio' : ''}${d.jencksFlag ? ' · Jencks' : ''}`,
    citations: [{ type: 'discovery', id: d.id, label: d.title }],
  }));

  const supportingRepositoryRecords: MotionSupportItem[] = report.charges.map((c) => ({
    id: c.chargeId,
    label: `${c.code} ${c.section}`,
    detail: `${c.offenseTitle} · repository confidence: ${c.repositoryConfidence}`,
    citations: [{ type: 'repository', id: `${c.code} ${c.section}`, label: c.offenseTitle }],
  }));

  const supportingCalcrim: MotionSupportItem[] = report.authorities.calcrim.map((c) => ({
    id: c.instructionNumber,
    label: `CALCRIM ${c.instructionNumber}`,
    detail: c.title,
    citations: [{ type: 'calcrim', id: c.instructionNumber, label: c.title }],
  }));

  // ---- Draft sections (repository-backed; UNKNOWN where unsupported) ----
  const sections: MotionSection[] = [];

  // Introduction
  sections.push({
    id: 'introduction',
    title: 'I. Introduction',
    paragraphs: [
      {
        text: `${clientName}, by and through counsel, respectfully submits this ${def.label} in the matter of ${report.executiveSummary.caseTitle}${report.executiveSummary.caseNumber !== UNK ? `, Case No. ${report.executiveSummary.caseNumber}` : ''}. ${def.description}`,
        citations: def.statutoryBasis.map((c) => ({ type: 'authority' as const, id: c, label: c })),
      },
      def.statutoryBasis.length > 0
        ? { text: `This motion is brought pursuant to ${def.statutoryBasis.join('; ')}. Counsel must confirm the applicability of each authority to the facts of this case.`, citations: def.statutoryBasis.map((c) => ({ type: 'authority' as const, id: c, label: c })) }
        : { text: 'The legal basis for this motion must be supplied by counsel; the repository does not prescribe a fixed statutory basis for this motion type.', citations: [], unknown: true },
    ],
  });

  // Statement of Facts — ONLY from repository timeline + evidence
  const factParagraphs: MotionParagraph[] = [];
  if (report.timeline.events.length > 0) {
    for (const t of report.timeline.events.slice(0, 40)) {
      const when = t.timestamp ? new Date(t.timestamp).toLocaleString() : t.timeText;
      factParagraphs.push({
        text: `${when ? when + ': ' : ''}${t.description}${t.location ? ` (${t.location})` : ''}.`,
        citations: [{ type: 'timeline', id: t.id }],
      });
    }
  }
  if (report.evidence.items.length > 0) {
    factParagraphs.push({
      text: `The following evidence is on file and forms part of the record: ${report.evidence.items.map((e) => e.fileName).slice(0, 20).join('; ')}.`,
      citations: report.evidence.items.slice(0, 20).map((e) => ({ type: 'evidence' as const, id: e.evidenceId, label: e.fileName })),
    });
  }
  if (factParagraphs.length === 0) {
    factParagraphs.push({
      text: 'No repository-backed facts (timeline events or evidence) are currently available for this case. Counsel must supply the statement of facts.',
      citations: [],
      unknown: true,
    });
  }
  sections.push({ id: 'statement-of-facts', title: 'II. Statement of Facts', paragraphs: factParagraphs });

  // Procedural History — from case metadata
  const procParagraphs: MotionParagraph[] = [];
  const filing = report.caseOverview.filingDate ? new Date(report.caseOverview.filingDate).toLocaleDateString() : null;
  if (filing || report.charges.length > 0) {
    procParagraphs.push({
      text: `${filing ? `This matter was filed on ${filing}. ` : ''}${report.charges.length > 0 ? `The operative charges are: ${report.charges.map((c) => `${c.code} ${c.section} (${c.offenseTitle})`).join('; ')}.` : 'No charges are recorded in the repository (UNKNOWN).'}`,
      citations: report.charges.map((c) => ({ type: 'repository' as const, id: `${c.code} ${c.section}` })),
      unknown: report.charges.length === 0 && !filing,
    });
    if (report.caseOverview.nextHearing) {
      procParagraphs.push({ text: `The next scheduled hearing is ${new Date(report.caseOverview.nextHearing).toLocaleString()}.`, citations: [] });
    }
  } else {
    procParagraphs.push({ text: 'Procedural history is not available from the repository. Counsel must supply the procedural history.', citations: [], unknown: true });
  }
  sections.push({ id: 'procedural-history', title: 'III. Procedural History', paragraphs: procParagraphs });

  // Applicable Law — statutory basis + repository authorities + CALCRIM
  const lawParagraphs: MotionParagraph[] = [];
  if (def.statutoryBasis.length > 0) {
    lawParagraphs.push({
      text: `The controlling authority for a ${def.label} is: ${def.statutoryBasis.join('; ')}. Counsel must confirm current applicability and jurisdiction.`,
      citations: def.statutoryBasis.map((c) => ({ type: 'authority' as const, id: c, label: c })),
    });
  }
  if (report.authorities.statutes.length > 0) {
    lawParagraphs.push({
      text: `Repository-verified statutes applicable to the charges: ${report.authorities.statutes.map((s) => `${s.code} ${s.section} (${s.title})`).join('; ')}.`,
      citations: report.authorities.statutes.map((s) => ({ type: 'statute' as const, id: `${s.code} ${s.section}`, label: s.title })),
    });
  }
  if (report.authorities.calcrim.length > 0) {
    lawParagraphs.push({
      text: `Applicable jury instructions: ${report.authorities.calcrim.map((c) => `CALCRIM ${c.instructionNumber} (${c.title})`).join('; ')}.`,
      citations: report.authorities.calcrim.map((c) => ({ type: 'calcrim' as const, id: c.instructionNumber, label: c.title })),
    });
  }
  if (lawParagraphs.length === 0) {
    lawParagraphs.push({ text: 'No repository-backed authorities are available. Counsel must supply the applicable law.', citations: [], unknown: true });
  }
  sections.push({ id: 'applicable-law', title: 'IV. Applicable Law', paragraphs: lawParagraphs });

  // Analysis — ties motion purpose to repository findings; UNKNOWN if none
  const analysisParagraphs: MotionParagraph[] = [];
  const contradictions = report.analysis.contradictions;
  const missingElements = report.analysis.missingElements;
  const repoGaps = report.analysis.repositoryGaps;
  if (motionType === 'brady' || motionType === 'discovery') {
    const flagged = report.discovery.items.filter((d) => d.bradyFlag || d.giglioFlag || d.jencksFlag);
    if (flagged.length > 0) {
      analysisParagraphs.push({
        text: `The following discovery items have been flagged as potentially disclosable material requiring production: ${flagged.map((d) => d.title).join('; ')}. These flags reflect attorney classification and require human review.`,
        citations: flagged.map((d) => ({ type: 'discovery' as const, id: d.id, label: d.title })),
      });
    }
  }
  if (contradictions.length > 0) {
    analysisParagraphs.push({
      text: `The repository has identified ${contradictions.length} contradiction(s) in the record that support this motion: ${contradictions.map((c) => c.value).slice(0, 5).join('; ')}.`,
      citations: contradictions.flatMap((c) => c.citations).slice(0, 12).map((c) => ({ type: (c.type as MotionCitation['type']), id: c.id })),
    });
  }
  if ((motionType === 'dismiss' || motionType === 'suppress') && missingElements.length > 0) {
    analysisParagraphs.push({
      text: `The following elements are not currently satisfied by the repository evidence, supporting the requested relief: ${missingElements.map((m) => m.label).slice(0, 8).join('; ')}.`,
      citations: missingElements.flatMap((m) => m.citations).slice(0, 12).map((c) => ({ type: (c.type as MotionCitation['type']), id: c.id })),
    });
  }
  if (repoGaps.length > 0) {
    analysisParagraphs.push({
      text: `Repository gaps relevant to this motion: ${repoGaps.map((g) => g.value).slice(0, 5).join('; ')}.`,
      citations: repoGaps.flatMap((g) => g.citations).slice(0, 12).map((c) => ({ type: (c.type as MotionCitation['type']), id: c.id })),
    });
  }
  if (analysisParagraphs.length === 0) {
    analysisParagraphs.push({
      text: `The repository does not currently contain findings that independently support this ${def.label}. Counsel must supply the legal argument and identify the supporting facts and authorities.`,
      citations: [],
      unknown: true,
    });
  }
  sections.push({ id: 'analysis', title: 'V. Analysis', paragraphs: analysisParagraphs });

  // Conclusion
  sections.push({
    id: 'conclusion',
    title: 'VI. Conclusion',
    paragraphs: [
      {
        text: `For the foregoing repository-supported reasons, ${clientName} respectfully requests that this Court ${def.prayer}. Counsel affirms that the factual assertions herein are drawn from the case repository and that any matters marked UNKNOWN require independent verification before filing.`,
        citations: [],
      },
    ],
  });

  // Prayer
  sections.push({
    id: 'prayer',
    title: 'VII. Prayer for Relief',
    paragraphs: [
      { text: `WHEREFORE, ${clientName} respectfully prays that this Court ${def.prayer}, and grant such other and further relief as the Court deems just and proper.`, citations: [] },
    ],
  });

  // Certificate of Service (attorney completes)
  sections.push({
    id: 'certificate',
    title: 'VIII. Certificate of Service',
    paragraphs: [
      { text: 'I hereby certify that on [DATE — UNKNOWN], a true and correct copy of the foregoing was served upon [RECIPIENT — UNKNOWN] by [METHOD — UNKNOWN]. Counsel must complete this certificate before filing.', citations: [], unknown: true },
    ],
  });

  // ---- Authority panel ----
  const authorityPanel = {
    statutes: report.authorities.statutes,
    courtListener: report.authorities.citations.filter((c) => /courtlistener/i.test(c.type)).map((c) => ({ citation: c.citation, status: 'repository' })),
    cap: [] as Array<{ citation: string; status: string }>,
    openLaws: [] as Array<{ citation: string; status: string }>,
    calcrim: report.authorities.calcrim,
    citations: report.authorities.citations,
    providerAvailability: report.authorities.providerAvailability,
  };

  // ---- Attorney review ----
  const s = supportLevel(report, def);
  const missingAuthorities: string[] = [];
  if (report.authorities.statutes.length === 0) missingAuthorities.push('No repository-verified statutes linked to the charges.');
  if (report.authorities.calcrim.length === 0) missingAuthorities.push('No CALCRIM instructions linked.');
  const unknownEvidence = report.evidence.items.filter((e) => !e.sha256).map((e) => `${e.fileName} — hash UNKNOWN`);

  const repositoryConfidence: ReportFinding = {
    id: 'motion-confidence',
    label: 'Repository Confidence',
    value: s.level === 'supported' ? 'Repository-supported' : s.level === 'partial' ? 'Partial repository support' : 'UNKNOWN — no repository support',
    status: s.level,
    confidence: s.level === 'supported' ? 'MEDIUM' : s.level === 'partial' ? 'LOW' : 'UNKNOWN',
    citations: [],
    note: s.summary,
  };

  const draft: MotionDraft = {
    motionVersion: MOTION_BUILDER_VERSION,
    generatedAt,
    caseId,
    tenantId,
    reproducibilityHash: '',
    motionType,
    header: {
      motionTitle: def.label,
      caseTitle: report.executiveSummary.caseTitle,
      caseNumber: report.executiveSummary.caseNumber,
      court: report.executiveSummary.court,
      judge: report.executiveSummary.judge,
      attorney: report.caseOverview.defenseTeam[0] || UNK,
      repositoryStatus: report.executiveSummary.repositoryIntegrity,
      knowledgeGraphStatus: report.executiveSummary.knowledgeGraphStatus,
      generatedAt,
      repositoryVersion: report.executiveSummary.repositoryVersion,
    },
    repositoryAnalysis: {
      supportingEvidence,
      supportingAuthorities,
      supportingTimeline,
      supportingWitnesses,
      supportingDiscovery,
      supportingRepositoryRecords,
      supportingCalcrim,
    },
    draft: { sections },
    authorityPanel,
    evidencePanel: {
      evidence: report.evidence.items,
      witnesses: report.witnesses.items,
      discovery: report.discovery.items,
      timeline: report.timeline.events,
      knowledgeGraph: report.knowledgeGraph,
      repositoryReferences: report.authorities.statutes,
    },
    attorneyReview: {
      repositoryConfidence,
      humanReviewRequired: [
        'All legal analysis and authority applicability must be verified by counsel before filing.',
        ...report.analysis.humanReviewItems,
      ],
      repositoryGaps: report.analysis.repositoryGaps,
      unknownEvidence,
      contradictions: report.analysis.contradictions,
      missingAuthorities,
      missingEvidence: report.recommendations.additionalEvidence,
    },
    attorneyNotesHint: 'Attorney notes are private to your account and are not included in exports unless added to the draft.',
  };

  draft.reproducibilityHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...draft, generatedAt: null, reproducibilityHash: null, header: { ...draft.header, generatedAt: null } }))
    .digest('hex');

  return draft;
}
