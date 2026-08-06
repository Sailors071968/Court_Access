// ============================================================================
// Charge lifecycle.
//
// A charging document is drafted, reviewed, and finalised. Once it is filed it
// becomes operative and everything built on the charges follows it. Once
// anything in the case relies on it, it locks: it can be superseded or its
// counts dismissed, but it cannot be removed, because a motion already argues
// against what it says.
//
// Every manual correction is recorded with an author and a time. Charges drive
// the whole analysis, so a silent edit would change what a case is about with
// nothing to show who did it.
// ============================================================================

import prisma from '../lib/prisma.js';
import { syncOperativeCharges } from './chargingService.js';

export interface Actor {
  userId: string;
  role: string;
  tenantId: string;
}

/** Record a change to a charge. Never allowed to fail the operation it logs. */
export async function audit(entry: {
  caseId: string;
  tenantId: string;
  actor: Actor;
  action: string;
  description: string;
  chargingDocumentId?: string | null;
  filedChargeId?: string | null;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  await prisma.chargeAuditEvent
    .create({
      data: {
        caseId: entry.caseId,
        tenantId: entry.tenantId,
        chargingDocumentId: entry.chargingDocumentId ?? null,
        filedChargeId: entry.filedChargeId ?? null,
        action: entry.action,
        field: entry.field ?? null,
        previousValue: entry.previousValue ?? null,
        newValue: entry.newValue ?? null,
        description: entry.description,
        actorId: entry.actor.userId,
        actorRole: entry.actor.role,
      },
    })
    .catch(() => {
      // Audit must never take down the work it is recording.
    });
}

export async function auditTrail(caseId: string) {
  return prisma.chargeAuditEvent.findMany({
    where: { caseId },
    orderBy: { occurredAt: 'desc' },
    take: 500,
  });
}

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

/**
 * A filing locks as soon as anything in the case relies on it. Once counsel has
 * argued against a pleading, that pleading is part of the litigation record.
 */
export async function lockIfReferenced(chargingDocumentId: string, reason: string): Promise<boolean> {
  const doc = await prisma.chargingDocument.findUnique({ where: { chargingDocumentId } });
  if (!doc || doc.lockedAt) return false;

  await prisma.chargingDocument.update({
    where: { chargingDocumentId },
    data: { lockedAt: new Date(), lockedReason: reason },
  });
  return true;
}

/** Whether anything in the case already relies on this filing. */
export async function referencesTo(caseId: string, chargingDocumentId: string): Promise<string[]> {
  const reasons: string[] = [];

  const laterFilings = await prisma.chargingDocument.count({
    where: { caseId, filingSequence: { gt: (await prisma.chargingDocument.findUnique({ where: { chargingDocumentId }, select: { filingSequence: true } }))?.filingSequence ?? 0 } },
  });
  if (laterFilings > 0) {
    reasons.push(`${laterFilings} later filing(s) are measured against it`);
  }

  const evidence = await prisma.evidence.count({ where: { caseId } });
  if (evidence > 0) reasons.push(`${evidence} item(s) of evidence have been analysed against the charges`);

  return reasons;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/**
 * Finalise a draft. Only at this point does it become operative and supersede
 * what came before, so an attorney can build a pleading over several sittings
 * without the case analysis lurching after each edit.
 */
export async function finalizeDraft(chargingDocumentId: string, actor: Actor) {
  const doc = await prisma.chargingDocument.findUnique({
    where: { chargingDocumentId },
    include: { charges: true },
  });
  if (!doc) return { ok: false as const, status: 404, message: 'No such charging document.' };
  if (doc.tenantId !== actor.tenantId) return { ok: false as const, status: 404, message: 'No such charging document.' };
  if (doc.status === 'filed') {
    return { ok: false as const, status: 409, message: 'This document has already been filed.' };
  }
  if (doc.charges.length === 0) {
    return {
      ok: false as const,
      status: 422,
      message: 'A charging document cannot be filed with no counts. Add at least one count first.',
    };
  }

  await prisma.chargingDocument.update({
    where: { chargingDocumentId },
    data: { status: 'filed' },
  });

  // Everything filed before it is superseded, and kept.
  await prisma.chargingDocument.updateMany({
    where: {
      caseId: doc.caseId,
      status: 'filed',
      filingSequence: { lt: doc.filingSequence },
      supersededAt: null,
    },
    data: { supersededAt: new Date() },
  });

  // Earlier filings are now part of the litigation record.
  const earlier = await prisma.chargingDocument.findMany({
    where: { caseId: doc.caseId, filingSequence: { lt: doc.filingSequence } },
    select: { chargingDocumentId: true },
  });
  for (const e of earlier) {
    await lockIfReferenced(e.chargingDocumentId, 'A later charging document has been filed against it.');
  }

  const synced = await syncOperativeCharges(doc.caseId);

  await audit({
    caseId: doc.caseId,
    tenantId: doc.tenantId,
    actor,
    action: 'finalized',
    chargingDocumentId,
    description:
      `${doc.name} was filed with ${doc.charges.length} count(s). It is now the operative charging document; ` +
      `${synced.synced} count(s) drive the case analysis.`,
  });

  return { ok: true as const, synced: synced.synced };
}

/**
 * Start a new filing from an existing one. Amendments usually change a little
 * and repeat the rest, so retyping the whole pleading invites transcription
 * errors in the parts that did not change.
 */
export async function duplicateFiling(params: {
  sourceChargingDocumentId: string;
  kind: string;
  name: string;
  filedAt: Date;
  actor: Actor;
}) {
  const source = await prisma.chargingDocument.findUnique({
    where: { chargingDocumentId: params.sourceChargingDocumentId },
    include: { charges: { include: { defendants: true } } },
  });
  if (!source || source.tenantId !== params.actor.tenantId) {
    return { ok: false as const, status: 404, message: 'No such charging document.' };
  }

  const last = await prisma.chargingDocument.findFirst({
    where: { caseId: source.caseId },
    orderBy: { filingSequence: 'desc' },
    select: { filingSequence: true },
  });

  const created = await prisma.chargingDocument.create({
    data: {
      caseId: source.caseId,
      tenantId: source.tenantId,
      uploadedById: params.actor.userId,
      kind: params.kind,
      name: params.name,
      filedAt: params.filedAt,
      court: source.court,
      courtCaseNumber: source.courtCaseNumber,
      filingSequence: (last?.filingSequence ?? 0) + 1,
      // A duplicate starts as a draft so it can be edited before it takes effect.
      status: 'draft',
    },
  });

  for (const c of source.charges) {
    const copy = await prisma.filedCharge.create({
      data: {
        chargingDocumentId: created.chargingDocumentId,
        caseId: source.caseId,
        countNumber: c.countNumber,
        code: c.code,
        section: c.section,
        subdivision: c.subdivision,
        verbatimText: c.verbatimText,
        normalizedCitation: c.normalizedCitation,
        officialStatuteId: c.officialStatuteId,
        statuteNote: c.statuteNote,
        status: c.status === 'dismissed' ? 'dismissed' : 'active',
        enhancements: c.enhancements ?? undefined,
        attempt: c.attempt,
        strikeAllegation: c.strikeAllegation,
        seriousFelony: c.seriousFelony,
        violentFelony: c.violentFelony,
        gangAllegation: c.gangAllegation,
        firearmAllegation: c.firearmAllegation,
        greatBodilyInjury: c.greatBodilyInjury,
        specialCircumstance: c.specialCircumstance,
        threeStrikes: c.threeStrikes,
        sexRegistration: c.sexRegistration,
        priorConvictions: c.priorConvictions ?? undefined,
        drugWeight: c.drugWeight,
        restitution: c.restitution,
        maximumExposure: c.maximumExposure,
      },
    });

    for (const d of c.defendants) {
      await prisma.chargeDefendant
        .create({
          data: {
            filedChargeId: copy.filedChargeId,
            defendantName: d.defendantName,
            clientId: d.clientId,
            status: d.status,
            note: d.note,
          },
        })
        .catch(() => {});
    }
  }

  await audit({
    caseId: source.caseId,
    tenantId: source.tenantId,
    actor: params.actor,
    action: 'created',
    chargingDocumentId: created.chargingDocumentId,
    description: `${params.name} was started as a draft from the ${source.name}, carrying ${source.charges.length} count(s) forward.`,
  });

  return { ok: true as const, chargingDocumentId: created.chargingDocumentId };
}

// ---------------------------------------------------------------------------
// Editing a count
// ---------------------------------------------------------------------------

/** Fields an attorney may correct by hand. */
const EDITABLE = new Set([
  'countNumber',
  'code',
  'section',
  'subdivision',
  'verbatimText',
  'status',
  'attempt',
  'strikeAllegation',
  'seriousFelony',
  'violentFelony',
  'gangAllegation',
  'firearmAllegation',
  'greatBodilyInjury',
  'specialCircumstance',
  'threeStrikes',
  'sexRegistration',
  'drugWeight',
  'restitution',
  'maximumExposure',
]);

export async function editCharge(params: {
  filedChargeId: string;
  changes: Record<string, unknown>;
  actor: Actor;
}) {
  const charge = await prisma.filedCharge.findUnique({
    where: { filedChargeId: params.filedChargeId },
    include: { chargingDocument: true },
  });
  if (!charge || charge.chargingDocument.tenantId !== params.actor.tenantId) {
    return { ok: false as const, status: 404, message: 'No such charge.' };
  }

  const rejected = Object.keys(params.changes).filter((k) => !EDITABLE.has(k));
  if (rejected.length > 0) {
    return {
      ok: false as const,
      status: 400,
      message: `These fields cannot be edited directly: ${rejected.join(', ')}.`,
    };
  }

  const record = charge as unknown as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const edited = new Set(Array.isArray(charge.attorneyEdited) ? (charge.attorneyEdited as string[]) : []);

  for (const [field, value] of Object.entries(params.changes)) {
    const before = record[field];
    if (before === value) continue;
    data[field] = value;
    // Marked so the parser will never write over a correction later.
    edited.add(field);

    await audit({
      caseId: charge.caseId,
      tenantId: charge.chargingDocument.tenantId,
      actor: params.actor,
      action: 'edited',
      chargingDocumentId: charge.chargingDocumentId,
      filedChargeId: charge.filedChargeId,
      field,
      previousValue: before === null || before === undefined ? null : String(before),
      newValue: value === null || value === undefined ? null : String(value),
      description:
        `Count ${charge.countNumber} (${charge.normalizedCitation}): ${field} changed from ` +
        `"${before ?? 'not set'}" to "${value ?? 'not set'}".`,
    });
  }

  if (Object.keys(data).length === 0) {
    return { ok: true as const, changed: 0 };
  }

  data.attorneyEdited = [...edited];
  await prisma.filedCharge.update({ where: { filedChargeId: params.filedChargeId }, data });

  // A change to the operative document changes what the case is about.
  if (charge.chargingDocument.status === 'filed' && charge.chargingDocument.supersededAt === null) {
    await syncOperativeCharges(charge.caseId);
  }

  return { ok: true as const, changed: Object.keys(data).length - 1 };
}

// ---------------------------------------------------------------------------
// Exposure, as pleaded
// ---------------------------------------------------------------------------

/**
 * Which allegations the People have pleaded against a count. This reports what
 * is on the pleading; it does not compute a sentence. A term calculated from a
 * statute and shown as a number would be relied on in plea discussions, and
 * getting it wrong there is not a software defect, it is a client's liberty.
 */
export function allegationSummary(charge: {
  attempt: boolean;
  strikeAllegation: boolean;
  seriousFelony: boolean;
  violentFelony: boolean;
  gangAllegation: boolean;
  firearmAllegation: boolean;
  greatBodilyInjury: boolean;
  specialCircumstance: boolean;
  threeStrikes: boolean;
  sexRegistration: boolean;
  drugWeight: string | null;
  restitution: string | null;
  maximumExposure: string | null;
  priorConvictions: unknown;
}): { alleged: string[]; exposureNote: string } {
  const alleged: string[] = [];
  if (charge.attempt) alleged.push('Charged as an attempt');
  if (charge.strikeAllegation) alleged.push('Strike allegation');
  if (charge.seriousFelony) alleged.push('Serious felony');
  if (charge.violentFelony) alleged.push('Violent felony');
  if (charge.threeStrikes) alleged.push('Three strikes');
  if (charge.gangAllegation) alleged.push('Gang allegation');
  if (charge.firearmAllegation) alleged.push('Firearm allegation');
  if (charge.greatBodilyInjury) alleged.push('Great bodily injury');
  if (charge.specialCircumstance) alleged.push('Special circumstance');
  if (charge.sexRegistration) alleged.push('Sex offender registration');
  if (charge.drugWeight) alleged.push(`Weight alleged: ${charge.drugWeight}`);
  if (charge.restitution) alleged.push(`Restitution sought: ${charge.restitution}`);

  const priors = Array.isArray(charge.priorConvictions) ? (charge.priorConvictions as string[]) : [];
  for (const p of priors) alleged.push(`Prior conviction alleged: ${p}`);

  const exposureNote = charge.maximumExposure
    ? `Maximum exposure as pleaded by the People: ${charge.maximumExposure}`
    : 'The charging document does not state a maximum exposure for this count, and none has been calculated. ' +
      'Exposure depends on the allegations pleaded and proved, prior record and sentencing discretion.';

  return { alleged, exposureNote };
}
