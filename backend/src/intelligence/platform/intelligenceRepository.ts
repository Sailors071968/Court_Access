// ============================================================================
// The intelligence repository.
//
// Records findings, maintains their disposition, assembles review packets, and
// supersedes conclusions when an algorithm improves. Engines produce findings and
// this persists them, which is the boundary that lets the same engine run live, in
// a reprocessing run, or in a dry run with no branch inside it.
//
// Two invariants this module exists to hold:
//
//   Nothing is destructively updated. A disposition change is an event as well as
//   a field, and an algorithm upgrade supersedes a finding rather than editing it,
//   so the conclusion that was acted on last year is still readable.
//
//   Every item is explainable without reconstruction. A reviewer is given
//   evidence, reasoning, conflicts, confidence and a recommendation, assembled
//   from stored ids — never asked to go and find the source rows themselves.
// ============================================================================

import type { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import type {
  AlgorithmVersions, Disposition, EvidenceContext, IntelligenceEngine,
  IntelligenceFinding, ReviewPacket,
} from './types.js';

type Tx = Prisma.TransactionClient | PrismaClient;

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Persist one finding, with its creation event.
 *
 * The event is written in the same transaction as the item: an item whose history
 * does not begin with its own creation is not auditable, and a partial write here
 * would produce exactly that.
 */
export async function recordFinding(
  tx: Tx,
  engine: Pick<IntelligenceEngine, 'name' | 'version'>,
  finding: IntelligenceFinding,
  context: EvidenceContext,
): Promise<string> {
  const item = await tx.inmateIntelligenceItem.create({
    data: {
      engine: engine.name,
      engineVersion: engine.version,
      type: finding.type,
      severity: finding.severity,
      subjectKind: finding.subjectKind,
      subjectId: finding.subjectId ?? null,
      relatedKind: finding.relatedKind ?? null,
      relatedId: finding.relatedId ?? null,
      confidence: finding.confidence,
      rule: finding.rule ?? null,
      explanation: finding.explanation,
      disposition: finding.disposition,
      reviewRequired: finding.reviewRequired,
      evidenceObservationIds: finding.evidenceObservationIds,
      inputs: (finding.inputs ?? null) as Prisma.InputJsonValue,
      payload: (finding.payload ?? null) as Prisma.InputJsonValue,
      detailTable: finding.detail?.table ?? null,
      detailId: finding.detail?.id ?? null,
      ruleVersion: context.versions.ruleVersion ?? null,
      confidenceVersion: context.versions.confidenceVersion ?? null,
      parserProfileId: context.versions.parserProfileId ?? null,
      parserVersion: context.versions.parserVersion ?? null,
      normalizationVersion: context.versions.normalizationVersion ?? null,
      nameKeyVersion: context.versions.nameKeyVersion ?? null,
      runId: context.runId ?? null,
      batchId: context.batchId ?? null,
    },
    select: { itemId: true },
  });

  await tx.inmateIntelligenceEvent.create({
    data: {
      itemId: item.itemId,
      action: finding.disposition === 'auto_applied' ? 'auto_applied' : 'created',
      toDisposition: finding.disposition,
      actorEngineVersion: engine.version,
      note: finding.rule ? `Rule: ${finding.rule}` : null,
    },
  });

  return item.itemId;
}

/** Record many findings from one engine execution. */
export async function recordFindings(
  engine: Pick<IntelligenceEngine, 'name' | 'version'>,
  findings: IntelligenceFinding[],
  context: EvidenceContext,
): Promise<string[]> {
  if (context.dryRun || findings.length === 0) return [];
  const ids: string[] = [];
  for (const finding of findings) {
    ids.push(await recordFinding(prisma, engine, finding, context));
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Disposition
// ---------------------------------------------------------------------------

const TERMINAL: ReadonlySet<Disposition> = new Set<Disposition>(['superseded', 'expired']);

/**
 * Change a finding's disposition, recording who and why.
 *
 * Refuses to move a superseded or expired item: a conclusion that has been
 * replaced must not be quietly re-accepted, because the thing accepted would no
 * longer be the thing the reviewer read.
 */
export async function setDisposition(args: {
  itemId: string;
  to: Disposition;
  actorId?: string;
  note?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const item = await prisma.inmateIntelligenceItem.findUnique({
    where: { itemId: args.itemId },
    select: { disposition: true },
  });
  if (!item) return { ok: false, reason: 'No such intelligence item.' };

  if (TERMINAL.has(item.disposition as Disposition)) {
    return {
      ok: false,
      reason: `This finding is ${item.disposition} and cannot be changed. A superseded conclusion is history, not a decision waiting to be made.`,
    };
  }
  if (item.disposition === args.to) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.inmateIntelligenceItem.update({
      where: { itemId: args.itemId },
      data: {
        disposition: args.to,
        reviewedById: args.actorId ?? null,
        reviewedAt: new Date(),
        reviewNote: args.note ?? null,
      },
    });
    await tx.inmateIntelligenceEvent.create({
      data: {
        itemId: args.itemId,
        action: args.to === 'accepted' ? 'accepted'
          : args.to === 'rejected' ? 'rejected'
          : args.to === 'deferred' ? 'deferred' : 'reviewed',
        fromDisposition: item.disposition,
        toDisposition: args.to,
        actorId: args.actorId ?? null,
        note: args.note ?? null,
      },
    });
  });

  return { ok: true };
}

/**
 * Replace a conclusion with an improved one.
 *
 * Both items get an event, so the upgrade is visible from either end. The old
 * item is never edited beyond its disposition and the pointer — its confidence,
 * explanation and version bundle stay exactly as they were, which is what makes
 * "what did we believe in March" answerable.
 */
export async function supersede(args: {
  oldItemId: string;
  newItemId: string;
  reason: string;
  actorId?: string;
  engineVersion?: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const old = await tx.inmateIntelligenceItem.findUnique({
      where: { itemId: args.oldItemId },
      select: { disposition: true },
    });

    await tx.inmateIntelligenceItem.update({
      where: { itemId: args.oldItemId },
      data: { disposition: 'superseded', supersededById: args.newItemId },
    });
    await tx.inmateIntelligenceItem.update({
      where: { itemId: args.newItemId },
      data: { supersedesId: args.oldItemId },
    });

    await tx.inmateIntelligenceEvent.createMany({
      data: [
        {
          itemId: args.oldItemId,
          action: 'superseded',
          fromDisposition: old?.disposition ?? null,
          toDisposition: 'superseded',
          actorId: args.actorId ?? null,
          actorEngineVersion: args.engineVersion ?? null,
          note: args.reason,
        },
        {
          itemId: args.newItemId,
          action: 'algorithm_upgrade',
          actorId: args.actorId ?? null,
          actorEngineVersion: args.engineVersion ?? null,
          note: `Supersedes ${args.oldItemId}: ${args.reason}`,
        },
      ],
    });
  });
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/**
 * Everything a reviewer needs, assembled.
 *
 * The requirement is that a reviewer reviews *intelligence*, not raw records — so
 * this resolves the stored observation ids into what each source actually stated,
 * with the document and row it came from. A reviewer who has to go and find the
 * source rows is reconstructing evidence, which is the thing this prevents.
 */
export async function buildReviewPacket(itemId: string): Promise<ReviewPacket | null> {
  const item = await prisma.inmateIntelligenceItem.findUnique({
    where: { itemId },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!item) return null;

  const observations = item.evidenceObservationIds.length > 0
    ? await prisma.inmateBookingObservation.findMany({
        where: { observationId: { in: item.evidenceObservationIds } },
        orderBy: { observedAt: 'asc' },
      })
    : [];

  const documentIds = [...new Set(observations.map((o) => o.documentId).filter((v): v is string => Boolean(v)))];
  const documents = documentIds.length > 0
    ? await prisma.inmateSourceDocument.findMany({
        where: { documentId: { in: documentIds } },
        select: { documentId: true, filename: true, sha256: true },
      })
    : [];
  const documentById = new Map(documents.map((d) => [d.documentId, d]));

  const versions: AlgorithmVersions = {
    engineVersion: item.engineVersion,
    ruleVersion: item.ruleVersion ?? undefined,
    confidenceVersion: item.confidenceVersion ?? undefined,
    parserProfileId: item.parserProfileId ?? undefined,
    parserVersion: item.parserVersion ?? undefined,
    normalizationVersion: item.normalizationVersion ?? undefined,
    nameKeyVersion: item.nameKeyVersion ?? undefined,
  };

  return {
    itemId: item.itemId,
    type: item.type,
    severity: item.severity as ReviewPacket['severity'],
    confidence: item.confidence,
    rule: item.rule ?? undefined,
    explanation: item.explanation,
    disposition: item.disposition as Disposition,
    engine: item.engine,
    engineVersion: item.engineVersion,
    versions,
    evidence: observations.map((o) => {
      const doc = o.documentId ? documentById.get(o.documentId) : undefined;
      return {
        observationId: o.observationId,
        sourceType: o.sourceType,
        rosterDate: o.rosterDate?.toISOString().slice(0, 10),
        sourcePage: o.sourcePage,
        sourceRow: o.sourceRow,
        document: doc ? { filename: doc.filename, sha256: doc.sha256 } : undefined,
        // What the source stated, and nothing derived. A null means the source did
        // not say, which is not the same as the value being empty.
        stated: {
          housingLocation: o.housingLocation,
          bailAmount: o.bailAmountCents === null ? null : (Number(o.bailAmountCents) / 100).toFixed(2),
          releasedAt: o.releasedAt?.toISOString().slice(0, 10) ?? null,
          courtDate: o.courtDate?.toISOString().slice(0, 10) ?? null,
          custodyStatus: o.custodyStatus,
          chargeCount: o.chargeCount,
        },
      };
    }),
    conflicts: extractConflicts(item.payload),
    recommendation: buildRecommendation(item.disposition as Disposition, item.reviewRequired, item.explanation),
    history: item.events.map((e) => ({
      action: e.action,
      actorId: e.actorId,
      note: e.note,
      at: e.createdAt.toISOString(),
    })),
    createdAt: item.createdAt.toISOString(),
  };
}

function extractConflicts(payload: unknown): Record<string, unknown>[] | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const conflicts = (payload as { conflicts?: unknown }).conflicts;
  return Array.isArray(conflicts) ? (conflicts as Record<string, unknown>[]) : undefined;
}

/** What the engine is asking for, said plainly. */
function buildRecommendation(disposition: Disposition, reviewRequired: boolean, explanation: string): string {
  if (disposition === 'auto_applied') {
    return 'The engine applied this under its own rules. You are auditing a decision that has already taken effect; rejecting it requires a reversal, not a refusal.';
  }
  if (reviewRequired) {
    return `The engine did not change the repository and is asking for a decision. ${explanation}`;
  }
  return 'Recorded for the record. No decision is required.';
}

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

export interface IntelligenceQuery {
  engine?: string;
  type?: string;
  severity?: string;
  disposition?: string;
  reviewRequired?: boolean;
  subjectKind?: string;
  subjectId?: string;
  runId?: string;
  minConfidence?: number;
  limit: number;
  offset: number;
}

export async function queryIntelligence(q: IntelligenceQuery) {
  const where: Prisma.InmateIntelligenceItemWhereInput = {};
  if (q.engine) where.engine = q.engine;
  if (q.type) where.type = q.type;
  if (q.severity) where.severity = q.severity;
  if (q.disposition) where.disposition = q.disposition;
  if (q.reviewRequired !== undefined) where.reviewRequired = q.reviewRequired;
  if (q.subjectKind) where.subjectKind = q.subjectKind;
  if (q.subjectId) where.subjectId = q.subjectId;
  if (q.runId) where.runId = q.runId;
  if (q.minConfidence !== undefined) where.confidence = { gte: q.minConfidence };

  const [total, items] = await Promise.all([
    prisma.inmateIntelligenceItem.count({ where }),
    prisma.inmateIntelligenceItem.findMany({
      where,
      // Deterministic: newest first, then a stable id so paging cannot repeat or
      // skip a row when two share a timestamp.
      orderBy: [{ createdAt: 'desc' }, { itemId: 'asc' }],
      skip: q.offset,
      take: q.limit,
    }),
  ]);

  return {
    total,
    results: items.map((i) => ({
      itemId: i.itemId,
      engine: i.engine,
      engineVersion: i.engineVersion,
      type: i.type,
      severity: i.severity,
      subjectKind: i.subjectKind,
      subjectId: i.subjectId,
      confidence: i.confidence,
      rule: i.rule,
      explanation: i.explanation,
      disposition: i.disposition,
      reviewRequired: i.reviewRequired,
      evidenceCount: i.evidenceObservationIds.length,
      supersededById: i.supersededById,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

/** The queue a reviewer works from. */
export async function reviewQueue(limit: number, offset: number) {
  return queryIntelligence({
    disposition: 'proposed',
    reviewRequired: true,
    limit,
    offset,
  });
}

/** Every conclusion ever drawn about one subject, including superseded ones. */
export async function intelligenceForSubject(subjectKind: string, subjectId: string) {
  const items = await prisma.inmateIntelligenceItem.findMany({
    where: {
      OR: [
        { subjectKind, subjectId },
        { relatedKind: subjectKind, relatedId: subjectId },
      ],
    },
    orderBy: [{ createdAt: 'desc' }, { itemId: 'asc' }],
    take: 200,
  });
  return items.map((i) => ({
    itemId: i.itemId,
    type: i.type,
    engine: i.engine,
    engineVersion: i.engineVersion,
    confidence: i.confidence,
    rule: i.rule,
    explanation: i.explanation,
    disposition: i.disposition,
    createdAt: i.createdAt.toISOString(),
  }));
}
