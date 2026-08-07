// ============================================================================
// Case lifecycle.
//
// Works out where a case stands from what is on the record, and says what told
// it. Where the record does not settle the question the stage is reported as
// unknown rather than guessed: showing a case as "Trial" because a document
// mentioned the word would put the wrong things in front of counsel at the
// wrong time.
//
// Counsel can always override, and the override sticks — inference never
// overwrites a person's judgement about their own case.
// ============================================================================

import prisma from '../lib/prisma.js';

export const LIFECYCLE_STAGES = [
  'investigation',
  'arrest',
  'booking',
  'bail',
  'arraignment',
  'discovery',
  'preliminary_hearing',
  'information_filed',
  'motion_practice',
  'settlement_conference',
  'readiness_conference',
  'trial',
  'jury_deliberation',
  'verdict',
  'sentencing',
  'appeal',
  'post_conviction_relief',
  'probation',
  'parole',
  'expungement',
  'record_sealing',
  'closed',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  investigation: 'Investigation',
  arrest: 'Arrest',
  booking: 'Booking',
  bail: 'Bail',
  arraignment: 'Arraignment',
  discovery: 'Discovery',
  preliminary_hearing: 'Preliminary hearing',
  information_filed: 'Information filed',
  motion_practice: 'Motion practice',
  settlement_conference: 'Settlement conference',
  readiness_conference: 'Readiness conference',
  trial: 'Trial',
  jury_deliberation: 'Jury deliberation',
  verdict: 'Verdict',
  sentencing: 'Sentencing',
  appeal: 'Appeal',
  post_conviction_relief: 'Post-conviction relief',
  probation: 'Probation',
  parole: 'Parole',
  expungement: 'Expungement',
  record_sealing: 'Record sealing',
  closed: 'Case closed',
  unknown: 'Not determined',
};

/** Plain English for a family member, who should not have to parse "arraignment". */
export const STAGE_PLAIN_ENGLISH: Record<string, string> = {
  investigation: 'The case is being investigated. No charges have been filed yet.',
  arrest: 'An arrest has been made.',
  booking: 'The defendant has been booked.',
  bail: 'Release conditions are being decided.',
  arraignment: 'The first court appearance, where the charges are formally read and a plea is entered.',
  discovery: 'Both sides are exchanging the evidence they hold. This stage often takes months.',
  preliminary_hearing: 'A hearing where a judge decides whether there is enough evidence for the case to go forward.',
  information_filed: 'The prosecution has filed the formal charging document that takes the case towards trial.',
  motion_practice: 'The lawyers are asking the judge to decide legal questions before trial.',
  settlement_conference: 'The parties are discussing whether the case can be resolved without a trial.',
  readiness_conference: 'A hearing to confirm both sides are ready for trial.',
  trial: 'The case is being tried.',
  jury_deliberation: 'The jury is deciding.',
  verdict: 'A verdict has been reached.',
  sentencing: 'The court is deciding the sentence.',
  appeal: 'The case is being appealed to a higher court.',
  post_conviction_relief: 'A challenge to the conviction is being made after the appeal.',
  probation: 'The defendant is serving a period of probation.',
  parole: 'The defendant is on parole.',
  expungement: 'An application is being made to clear the record.',
  record_sealing: 'An application is being made to seal the record.',
  closed: 'The case is closed.',
  unknown: 'The stage of this case has not been determined from what is on file.',
};

export interface StageDetermination {
  stage: LifecycleStage | 'unknown';
  label: string;
  plainEnglish: string;
  source: 'inferred' | 'attorney' | 'none';
  /** What on the record settled it. */
  basis: string;
  /** Everything considered, so the reasoning can be checked. */
  signals: string[];
  determinedAt: Date;
}

/**
 * Work out the stage from the record.
 *
 * Only signals that genuinely settle a stage are used. A hearing on the
 * calendar says a hearing is coming, not that the case is at trial; a filed
 * information says the case has passed the preliminary stage, because that is
 * what filing one means.
 */
export async function determineStage(caseId: string, tenantId: string): Promise<StageDetermination> {
  const signals: string[] = [];

  const [criminalCase, override, charging, evidenceCount, hearings] = await Promise.all([
    prisma.criminalCase.findFirst({
      where: { caseId, tenantId },
      select: { status: true, phase: true, nextHearing: true, createdAt: true },
    }),
    prisma.caseStageEvent.findFirst({
      where: { caseId, source: 'attorney' },
      orderBy: { occurredAt: 'desc' },
    }),
    prisma.chargingDocument.findMany({
      where: { caseId, status: 'filed' },
      orderBy: { filingSequence: 'asc' },
      select: { kind: true, name: true, filedAt: true },
    }).catch(() => []),
    prisma.evidence.count({ where: { caseId } }),
    prisma.caseHearing.findMany({ where: { caseId }, select: { hearingType: true } }).catch(() => []),
  ]);

  if (!criminalCase) {
    return {
      stage: 'unknown',
      label: STAGE_LABELS.unknown,
      plainEnglish: STAGE_PLAIN_ENGLISH.unknown,
      source: 'none',
      basis: 'No such case.',
      signals: [],
      determinedAt: new Date(),
    };
  }

  // Counsel's judgement is not overwritten by inference.
  if (override) {
    return {
      stage: override.stage as LifecycleStage,
      label: STAGE_LABELS[override.stage] ?? override.stage,
      plainEnglish: STAGE_PLAIN_ENGLISH[override.stage] ?? '',
      source: 'attorney',
      basis: override.basis,
      signals: [`Set by counsel on ${override.occurredAt.toDateString()}.`],
      determinedAt: override.occurredAt,
    };
  }

  // --- Signals that settle a stage -----------------------------------------
  if (criminalCase.status === 'closed' || criminalCase.status === 'archived') {
    signals.push(`The case is marked ${criminalCase.status}.`);
    return finish('closed', `The case is marked ${criminalCase.status}.`, signals);
  }

  const kinds = new Set(charging.map((c) => c.kind));
  if (kinds.size > 0) signals.push(`Charging documents on file: ${charging.map((c) => c.name).join(', ')}.`);
  if (evidenceCount > 0) signals.push(`${evidenceCount} item(s) of evidence have been uploaded.`);
  if (hearings.length > 0) signals.push(`${hearings.length} hearing(s) recorded.`);

  // An information means the case has passed the preliminary stage. That is
  // what filing one means, so it settles the question.
  if (kinds.has('information') || kinds.has('amended_information')) {
    return finish(
      'information_filed',
      'An information has been filed, which follows the preliminary hearing stage.',
      signals,
    );
  }

  // A complaint on file means the defendant has been charged.
  if (kinds.has('complaint') || kinds.has('amended_complaint')) {
    // Discovery is the stage a charged case sits in while evidence is exchanged.
    if (evidenceCount > 0) {
      return finish(
        'discovery',
        `A complaint is on file and ${evidenceCount} item(s) of discovery have been received.`,
        signals,
      );
    }
    return finish('arraignment', 'A complaint is on file but no discovery has been received yet.', signals);
  }

  if (evidenceCount > 0) {
    return finish(
      'investigation',
      `No charging document is on file, and ${evidenceCount} item(s) of material have been gathered.`,
      signals,
    );
  }

  // Nothing on the record settles it. Say so.
  return {
    stage: 'unknown',
    label: STAGE_LABELS.unknown,
    plainEnglish: STAGE_PLAIN_ENGLISH.unknown,
    source: 'none',
    basis:
      'Nothing on the record settles the stage: no charging document has been filed and no evidence has been ' +
      'uploaded. Set it by hand if you know where the case stands.',
    signals,
    determinedAt: new Date(),
  };

  function finish(stage: LifecycleStage, basis: string, sig: string[]): StageDetermination {
    return {
      stage,
      label: STAGE_LABELS[stage],
      plainEnglish: STAGE_PLAIN_ENGLISH[stage],
      source: 'inferred',
      basis,
      signals: sig,
      determinedAt: new Date(),
    };
  }
}

/** Record the stage when it moves, so the history is kept. */
export async function recordStage(params: {
  caseId: string;
  tenantId: string;
  stage: string;
  basis: string;
  source: 'inferred' | 'attorney';
  actorId?: string;
}): Promise<boolean> {
  const last = await prisma.caseStageEvent.findFirst({
    where: { caseId: params.caseId },
    orderBy: { occurredAt: 'desc' },
  });
  if (last?.stage === params.stage && last.source === params.source) return false;

  await prisma.caseStageEvent.create({
    data: {
      caseId: params.caseId,
      tenantId: params.tenantId,
      stage: params.stage,
      previousStage: last?.stage ?? null,
      source: params.source,
      basis: params.basis,
      overriddenById: params.source === 'attorney' ? params.actorId : null,
    },
  });
  return true;
}

export async function stageHistory(caseId: string) {
  return prisma.caseStageEvent.findMany({ where: { caseId }, orderBy: { occurredAt: 'asc' } });
}

// ---------------------------------------------------------------------------
// Case evolution
// ---------------------------------------------------------------------------

export interface EvolutionEntry {
  at: Date;
  kind: 'charges' | 'evidence' | 'stage' | 'charge_correction';
  what: string;
  /** What this changed downstream, where that is knowable. */
  consequence: string | null;
  caseId: string;
}

/**
 * What has happened to this case, in order, and what each change meant. Built
 * from records that exist; where a consequence cannot be established from the
 * record it is left null rather than asserted.
 */
export async function caseEvolution(caseId: string, tenantId: string): Promise<EvolutionEntry[]> {
  const entries: EvolutionEntry[] = [];

  const filings = await prisma.chargingDocument
    .findMany({
      where: { caseId, tenantId, status: 'filed' },
      orderBy: { filingSequence: 'asc' },
      include: { charges: true },
    })
    .catch(() => []);

  for (const [i, f] of filings.entries()) {
    entries.push({
      at: f.filedAt,
      kind: 'charges',
      what: `${f.name} filed with ${f.charges.length} count(s).`,
      consequence:
        i === 0
          ? 'The charges the case analysis reads were established by this filing.'
          : 'This became the operative pleading, so CALCRIM, mens rea and the elements analysis moved to its counts.',
      caseId,
    });
  }

  const corrections = await prisma.chargeAuditEvent
    .findMany({ where: { caseId, action: 'edited' }, orderBy: { occurredAt: 'asc' }, take: 50 })
    .catch(() => []);
  for (const c of corrections) {
    entries.push({
      at: c.occurredAt,
      kind: 'charge_correction',
      what: c.description,
      consequence: 'Anything built on this count was rebuilt from the corrected value.',
      caseId,
    });
  }

  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    select: { fileName: true, createdAt: true, processingStatus: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  for (const e of evidence) {
    entries.push({
      at: e.createdAt,
      kind: 'evidence',
      what: `${e.fileName} was added to the case.`,
      consequence:
        e.processingStatus === 'completed'
          ? 'Its text was read, so it can support a finding and be cited.'
          : e.processingStatus === 'failed'
            ? 'Its contents could not be read, so nothing in it is searchable and no finding can cite it.'
            : null,
      caseId,
    });
  }

  const stages = await stageHistory(caseId);
  for (const s of stages) {
    entries.push({
      at: s.occurredAt,
      kind: 'stage',
      what: `The case moved to ${STAGE_LABELS[s.stage] ?? s.stage}${s.previousStage ? ` from ${STAGE_LABELS[s.previousStage] ?? s.previousStage}` : ''}.`,
      consequence: s.basis,
      caseId,
    });
  }

  entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  return entries;
}
