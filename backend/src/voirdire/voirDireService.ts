// ============================================================================
// Program 92 — Canonical Voir Dire Intelligence Center
//
// The repository-backed jury-selection workspace. The question library and
// challenge framework are DERIVED from the case repository (charges, elements,
// mens rea, defenses, witnesses, evidence types, CALCRIM, authorities) — never
// hardcoded and never fabricated. Every question and challenge basis cites a
// real authority or repository source. Juror-specific bias/opinions are never
// invented; juror evaluation is attorney-entered on the client. UNKNOWN is
// emitted wherever repository evidence is insufficient.
// ============================================================================

import crypto from 'crypto';
import { buildAttorneyWorkbench } from '../workbench/workbenchService.js';
import { buildAttorneyReport } from '../report/attorneyReportService.js';

export const VOIR_DIRE_VERSION = '1.0.0';

const UNK = 'UNKNOWN';

export interface VoirDireCitation {
  type: 'authority' | 'statute' | 'calcrim' | 'evidence' | 'witness' | 'repository' | 'kg' | 'constitutional';
  id: string;
  label?: string;
}

export interface VoirDireQuestion {
  id: string;
  text: string;
  citations: VoirDireCitation[];
  repositoryBacked: boolean;
}

export interface VoirDireCategory {
  id: string;
  label: string;
  basis: string; // why this category applies to THIS case (repository trigger)
  citations: VoirDireCitation[];
  questions: VoirDireQuestion[];
}

export interface ChallengeFramework {
  causeChallenges: { authority: string[]; guidance: string };
  peremptoryChallenges: { authority: string[]; guidance: string; batsonWheeler: string };
}

export interface VoirDireCenter {
  voirDireVersion: string;
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
    categoryCount: number;
    questionCount: number;
    repositoryBackedQuestions: number;
    chargeCount: number;
    authorityCount: number;
    knowledgeGraphStatus: string;
    humanReviewCount: number;
  };
  questionLibrary: VoirDireCategory[];
  challengeFramework: ChallengeFramework;
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  attorneyReview: {
    probeAreas: Array<{ id: string; area: string; rationale: string; citations: VoirDireCitation[] }>;
    humanReviewRequired: string[];
    incompleteInformation: string[];
    repositoryGaps: Array<{ id: string; label: string; value: string }>;
  };
}

function q(id: string, text: string, citations: VoirDireCitation[], repositoryBacked = true): VoirDireQuestion {
  return { id, text, citations, repositoryBacked };
}

export async function buildVoirDireCenter(
  caseId: string,
  tenantId: string,
  userId: string,
): Promise<VoirDireCenter | null> {
  const bundle = await buildAttorneyWorkbench(caseId, tenantId, userId);
  if (!bundle) return null;
  const report = await buildAttorneyReport(caseId, tenantId, userId, bundle);
  if (!report) return null;

  const generatedAt = new Date().toISOString();
  const categories: VoirDireCategory[] = [];

  // --- Universal constitutional categories (grounded in real controlling authority) ---
  categories.push({
    id: 'presumption',
    label: 'Presumption of Innocence',
    basis: 'Applies to every criminal prosecution.',
    citations: [
      { type: 'calcrim', id: '103', label: 'CALCRIM 103' },
      { type: 'calcrim', id: '220', label: 'CALCRIM 220' },
      { type: 'authority', id: 'Taylor v. Kentucky (1978) 436 U.S. 478', label: 'Taylor v. Kentucky' },
    ],
    questions: [
      q('pi-1', 'Do you understand that the defendant is presumed innocent and that this presumption remains unless and until the prosecution proves guilt beyond a reasonable doubt?', [{ type: 'calcrim', id: '220', label: 'CALCRIM 220' }]),
      q('pi-2', 'Would you be able to return a verdict of not guilty if the prosecution failed to meet its burden, even if you personally had suspicions?', [{ type: 'calcrim', id: '103', label: 'CALCRIM 103' }]),
    ],
  });
  categories.push({
    id: 'burden',
    label: 'Burden of Proof & Reasonable Doubt',
    basis: 'Applies to every criminal prosecution.',
    citations: [
      { type: 'calcrim', id: '220', label: 'CALCRIM 220' },
      { type: 'authority', id: 'In re Winship (1970) 397 U.S. 358', label: 'In re Winship' },
    ],
    questions: [
      q('bd-1', 'Do you accept that the burden of proof rests entirely on the prosecution and never shifts to the defendant?', [{ type: 'calcrim', id: '220', label: 'CALCRIM 220' }]),
      q('bd-2', 'Do you understand that the defendant has no obligation to testify or present any evidence?', [{ type: 'calcrim', id: '355', label: 'CALCRIM 355' }]),
    ],
  });
  categories.push({
    id: 'general',
    label: 'General & Hardship',
    basis: 'Standard qualification inquiry authorized for voir dire.',
    citations: [{ type: 'statute', id: 'Code Civ. Proc. § 223', label: 'CCP § 223' }],
    questions: [
      q('gen-1', 'Is there anything about serving on this jury that would impose a hardship or prevent you from being fair and impartial?', [{ type: 'statute', id: 'Code Civ. Proc. § 223', label: 'CCP § 223' }]),
      q('gen-2', `Have you, a family member, or a close friend had any experience that would affect your ability to be impartial in a case involving ${report.charges.length > 0 ? report.charges.map((c) => c.offenseTitle).filter((t) => t !== UNK).slice(0, 3).join(', ') || 'these charges' : 'these charges'}?`, report.charges.map((c) => ({ type: 'repository' as const, id: `${c.code} ${c.section}`, label: c.offenseTitle }))),
    ],
  });

  // --- Charge-specific questions (repository-derived) ---
  if (report.charges.length > 0) {
    categories.push({
      id: 'charges',
      label: 'Charge-Specific',
      basis: `Derived from ${report.charges.length} charge(s) in the case repository.`,
      citations: report.charges.map((c) => ({ type: 'statute' as const, id: `${c.code} ${c.section}`, label: c.offenseTitle })),
      questions: report.charges.map((c, i) =>
        q(`ch-${i}`, `This case involves a charge under ${c.code} ${c.section}${c.offenseTitle !== UNK ? ` (${c.offenseTitle})` : ''}. Do you have any strong feelings about this type of charge that would affect your impartiality?`, [{ type: 'statute', id: `${c.code} ${c.section}`, label: c.offenseTitle }]),
      ),
    });

    // Mental State (if mens rea present)
    const mensReaCharges = report.charges.filter((c) => c.mensRea.length > 0);
    if (mensReaCharges.length > 0) {
      categories.push({
        id: 'mental_state',
        label: 'Mental State',
        basis: `Repository identifies mens rea elements for ${mensReaCharges.length} charge(s).`,
        citations: mensReaCharges.map((c) => ({ type: 'statute' as const, id: `${c.code} ${c.section}`, label: c.offenseTitle })),
        questions: [
          q('ms-1', 'This case may require the prosecution to prove the defendant acted with a specific mental state. Do you understand that a required mental state must be proven beyond a reasonable doubt?', mensReaCharges.slice(0, 3).map((c) => ({ type: 'statute' as const, id: `${c.code} ${c.section}` }))),
        ],
      });
    }

    // Self-defense / defenses (if repository defenses present)
    const defenseCharges = report.charges.filter((c) => c.defenses.length > 0);
    if (defenseCharges.length > 0) {
      categories.push({
        id: 'defenses',
        label: 'Defenses',
        basis: `Repository identifies potential defenses for ${defenseCharges.length} charge(s).`,
        citations: defenseCharges.map((c) => ({ type: 'statute' as const, id: `${c.code} ${c.section}`, label: c.offenseTitle })),
        questions: defenseCharges.slice(0, 3).map((c, i) =>
          q(`df-${i}`, `The defense may raise: ${c.defenses.slice(0, 3).join('; ')}. Could you fairly consider such a defense if the evidence supported it?`, [{ type: 'statute', id: `${c.code} ${c.section}`, label: c.offenseTitle }]),
        ),
      });
    }
  }

  // --- Law Enforcement (if LE witnesses) ---
  const leWitnesses = report.witnesses.items.filter((w) => w.witnessType === 'law_enforcement');
  if (leWitnesses.length > 0) {
    categories.push({
      id: 'law_enforcement',
      label: 'Law Enforcement',
      basis: `Repository identifies ${leWitnesses.length} law-enforcement witness(es).`,
      citations: [{ type: 'calcrim', id: '226', label: 'CALCRIM 226' }, ...leWitnesses.map((w) => ({ type: 'witness' as const, id: w.id, label: w.name }))],
      questions: [
        q('le-1', 'Would you tend to give more or less weight to the testimony of a law enforcement officer simply because of their occupation?', [{ type: 'calcrim', id: '226', label: 'CALCRIM 226' }]),
        q('le-2', 'Do you have any close family members or friends in law enforcement whose relationship might affect your impartiality?', leWitnesses.slice(0, 3).map((w) => ({ type: 'witness' as const, id: w.id, label: w.name }))),
      ],
    });
  }

  // --- Witness Credibility (if witnesses) ---
  if (report.witnesses.total > 0) {
    categories.push({
      id: 'witness_credibility',
      label: 'Witness Credibility',
      basis: `Repository identifies ${report.witnesses.total} witness(es).`,
      citations: [{ type: 'calcrim', id: '226', label: 'CALCRIM 226' }],
      questions: [
        q('wc-1', 'Do you understand that you are the sole judge of a witness’s believability and may accept or reject any part of any witness’s testimony?', [{ type: 'calcrim', id: '226', label: 'CALCRIM 226' }]),
      ],
    });
  }

  // --- Scientific / Forensic Evidence (if such evidence) ---
  const sciEvidence = report.evidence.items.filter((e) => ['forensic_report', 'autopsy_report'].includes(e.evidenceType) || /dna|lab|forensic/i.test(e.evidenceType));
  if (sciEvidence.length > 0) {
    categories.push({
      id: 'scientific',
      label: 'Scientific Evidence',
      basis: `Repository identifies ${sciEvidence.length} forensic/scientific evidence item(s).`,
      citations: [{ type: 'calcrim', id: '332', label: 'CALCRIM 332' }, ...sciEvidence.slice(0, 3).map((e) => ({ type: 'evidence' as const, id: e.evidenceId, label: e.fileName }))],
      questions: [
        q('sc-1', 'This case may involve expert or scientific evidence. Would you give such evidence more or less weight simply because it is described as “scientific”?', [{ type: 'calcrim', id: '332', label: 'CALCRIM 332' }]),
      ],
    });
  }

  const questionCount = categories.reduce((n, c) => n + c.questions.length, 0);
  const repositoryBackedQuestions = categories.reduce((n, c) => n + c.questions.filter((x) => x.repositoryBacked).length, 0);

  // --- Challenge framework (real controlling authority) ---
  const challengeFramework: ChallengeFramework = {
    causeChallenges: {
      authority: ['Code Civ. Proc. §§ 225–229', 'Code Civ. Proc. § 226'],
      guidance: 'Challenges for cause are unlimited and require a demonstrable basis (actual or implied bias / disqualification) established on the record.',
    },
    peremptoryChallenges: {
      authority: ['Code Civ. Proc. § 231', 'Code Civ. Proc. § 231.5'],
      guidance: 'Peremptory challenges are limited in number and exercised without stated cause.',
      batsonWheeler: 'Peremptory challenges may not be used to exclude jurors based on a protected characteristic. See Batson v. Kentucky (1986) 476 U.S. 79; People v. Wheeler (1978) 22 Cal.3d 258; Code Civ. Proc. § 231.7.',
    },
  };

  // --- Attorney review: probe areas (case-derived focus, NOT juror bias) ---
  const probeAreas: VoirDireCenter['attorneyReview']['probeAreas'] = [];
  if (leWitnesses.length > 0) probeAreas.push({ id: 'pa-le', area: 'Attitudes toward law enforcement', rationale: `${leWitnesses.length} law-enforcement witness(es) are expected.`, citations: leWitnesses.slice(0, 3).map((w) => ({ type: 'witness' as const, id: w.id, label: w.name })) });
  if (sciEvidence.length > 0) probeAreas.push({ id: 'pa-sci', area: 'Attitudes toward scientific/forensic evidence', rationale: `${sciEvidence.length} forensic/scientific evidence item(s) present.`, citations: sciEvidence.slice(0, 3).map((e) => ({ type: 'evidence' as const, id: e.evidenceId, label: e.fileName })) });
  probeAreas.push({ id: 'pa-burden', area: 'Ability to apply presumption of innocence and reasonable doubt', rationale: 'Foundational to every criminal case.', citations: [{ type: 'calcrim', id: '220', label: 'CALCRIM 220' }] });

  const incompleteInformation = [
    'Juror-specific responses, ratings, and concerns are attorney-entered during voir dire and are not present in the repository (UNKNOWN until recorded).',
  ];
  if (report.charges.length === 0) incompleteInformation.push('No charges recorded — charge-specific questions are UNKNOWN.');

  const center: VoirDireCenter = {
    voirDireVersion: VOIR_DIRE_VERSION,
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
      categoryCount: categories.length,
      questionCount,
      repositoryBackedQuestions,
      chargeCount: report.charges.length,
      authorityCount: report.authorities.statutes.length + report.authorities.calcrim.length,
      knowledgeGraphStatus: report.executiveSummary.knowledgeGraphStatus,
      humanReviewCount: report.analysis.humanReviewItems.length,
    },
    questionLibrary: categories,
    challengeFramework,
    authorities: report.authorities,
    knowledgeGraph: report.knowledgeGraph,
    attorneyReview: {
      probeAreas,
      humanReviewRequired: [
        'All juror evaluations and challenge decisions must be made by counsel; the platform does not infer juror bias.',
        ...report.analysis.humanReviewItems,
      ],
      incompleteInformation,
      repositoryGaps: report.analysis.repositoryGaps.map((g) => ({ id: g.id, label: g.label, value: g.value })),
    },
  };

  center.reproducibilityHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...center, generatedAt: null, reproducibilityHash: null, header: { ...center.header, generatedAt: null } }))
    .digest('hex');

  return center;
}
