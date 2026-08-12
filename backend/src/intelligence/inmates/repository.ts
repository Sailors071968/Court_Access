// ============================================================================
// Historical inmate repository.
//
// Read side. Every booking is returned with the batch it came from — filename,
// hash, roster date — because an intelligence product that cannot say where a
// fact came from is not usable in a legal context, and this is the same
// discipline the deployment work applied to itself.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { displayName } from './displayName.js';

export interface InmateSummary {
  inmateId: string;
  name: string;
  first: string;
  last: string;
  middle: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  race: string | null;
  bookingCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  identityConfidence: number;
  aliasCount: number;
  onWatchList: boolean;
}

export interface BookingDetail {
  bookingId: string;
  facility: string;
  externalBookingId: string | null;
  bookedAt: string;
  releasedAt: string | null;
  arrestingAgency: string | null;
  bailAmount: string | null;
  housingLocation: string | null;
  isFirstAppearance: boolean;
  charges: {
    statuteCode: string | null;
    statuteSection: string | null;
    description: string | null;
    severity: string;
    counts: number;
    rawText: string;
  }[];
  /** Where this booking came from. Not optional. */
  provenance: {
    batchId: string;
    filename: string;
    sha256: string;
    sourceType: string;
    rosterDate: string | null;
  };
}

const money = (cents: bigint | null): string | null =>
  cents === null ? null : (Number(cents) / 100).toFixed(2);

export async function getInmate(inmateId: string): Promise<InmateSummary | null> {
  const row = await prisma.inmate.findUnique({
    where: { inmateId },
    include: { _count: { select: { aliases: true } }, watchListEntries: { where: { active: true }, take: 1 } },
  });
  if (!row) return null;

  return {
    inmateId: row.inmateId,
    name: displayName(row),
    first: row.canonicalFirst,
    last: row.canonicalLast,
    middle: row.canonicalMiddle,
    dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    sex: row.sex,
    race: row.race,
    bookingCount: row.bookingCount,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    identityConfidence: row.identityConfidence,
    aliasCount: row._count.aliases,
    onWatchList: row.watchListEntries.length > 0,
  };
}

/** The arrest timeline: bookings newest first, each with charges and provenance. */
export async function getArrestTimeline(inmateId: string): Promise<BookingDetail[]> {
  const bookings = await prisma.inmateBooking.findMany({
    where: { inmateId },
    orderBy: { bookedAt: 'desc' },
    include: { charges: true, sourceBatch: true },
  });

  return bookings.map((b) => ({
    bookingId: b.bookingId,
    facility: b.facility,
    externalBookingId: b.externalBookingId,
    bookedAt: b.bookedAt.toISOString(),
    releasedAt: b.releasedAt?.toISOString() ?? null,
    arrestingAgency: b.arrestingAgency,
    bailAmount: money(b.bailAmountCents),
    housingLocation: b.housingLocation,
    isFirstAppearance: b.isFirstAppearance,
    charges: b.charges.map((c) => ({
      statuteCode: c.statuteCode,
      statuteSection: c.statuteSection,
      description: c.description,
      severity: c.severity,
      counts: c.counts,
      rawText: c.rawText,
    })),
    provenance: {
      batchId: b.sourceBatch.batchId,
      filename: b.sourceBatch.sourceFilename,
      sha256: b.sourceBatch.sourceSha256,
      sourceType: b.sourceBatch.sourceType,
      rosterDate: b.sourceBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
    },
  }));
}

export async function getAliases(inmateId: string) {
  const rows = await prisma.inmateAlias.findMany({
    where: { inmateId },
    orderBy: { occurrences: 'desc' },
  });
  return rows.map((a) => ({
    first: a.first,
    last: a.last,
    middle: a.middle,
    dateOfBirth: a.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    occurrences: a.occurrences,
  }));
}

export interface SearchParams {
  name?: string;
  dateOfBirth?: string;
  facility?: string;
  limit: number;
  offset: number;
}

/**
 * Structured search.
 *
 * Aliases are searched as well as canonical names, so a person found under any
 * spelling ever recorded for them is found. Fuzzy matching is Phase 4 and needs
 * `pg_trgm`, which is a migration and a database privilege — deliberately not
 * assumed here.
 */
export async function searchInmates(params: SearchParams): Promise<{ total: number; results: InmateSummary[] }> {
  const term = params.name?.trim().toUpperCase();

  const where: Record<string, unknown> = { mergedIntoId: null };
  if (params.dateOfBirth) where.dateOfBirth = new Date(params.dateOfBirth);
  if (term) {
    where.OR = [
      { canonicalLast: { contains: term } },
      { canonicalFirst: { contains: term } },
      { aliases: { some: { OR: [{ last: { contains: term } }, { first: { contains: term } }] } } },
    ];
  }
  if (params.facility) where.bookings = { some: { facility: params.facility } };

  const [total, rows] = await Promise.all([
    prisma.inmate.count({ where }),
    prisma.inmate.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: params.offset,
      take: params.limit,
      include: { _count: { select: { aliases: true } }, watchListEntries: { where: { active: true }, take: 1 } },
    }),
  ]);

  return {
    total,
    results: rows.map((row) => ({
      inmateId: row.inmateId,
      name: `${row.displayLast ?? row.canonicalLast}, ${row.displayFirst ?? row.canonicalFirst}`,
      first: row.displayFirst ?? row.canonicalFirst,
      last: row.displayLast ?? row.canonicalLast,
      middle: row.displayMiddle ?? row.canonicalMiddle,
      dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      sex: row.sex,
      race: row.race,
      bookingCount: row.bookingCount,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      identityConfidence: row.identityConfidence,
      aliasCount: row._count.aliases,
      onWatchList: row.watchListEntries.length > 0,
    })),
  };
}

export interface NewInmateParams {
  from?: string;
  to?: string;
  facility?: string;
  limit: number;
  offset: number;
}

/**
 * Newly booked inmates for the morning revenue report.
 *
 * Prefer PDF roster set-diff (on today ∧ not on yesterday) when a prior/current
 * PDF pair exists for the facility+date. That matches manual investigator
 * comparison. Fall back to `isFirstAppearance` only when no pair is available.
 */
export async function getNewInmates(params: NewInmateParams) {
  let where: Record<string, unknown> = { isFirstAppearance: true };

  if (params.facility && params.from) {
    const { resolvePdfRosterPair, compareRosterBatches, isReportableNew } =
      await import('./rosterComparison.js');
    const pair = await resolvePdfRosterPair(params.facility, params.from);
    if (pair) {
      const comparison = await compareRosterBatches(pair);
      const bookingIds = comparison.current
        .filter((row) => isReportableNew(row.disposition) && row.bookingId)
        .map((row) => row.bookingId!);
      where = { bookingId: { in: bookingIds.length > 0 ? bookingIds : ['__none__'] } };
    } else {
      if (params.facility) where.facility = params.facility;
      if (params.from || params.to) {
        where.bookedAt = {
          ...(params.from ? { gte: new Date(params.from) } : {}),
          ...(params.to ? { lte: new Date(params.to) } : {}),
        };
      }
    }
  } else {
    if (params.facility) where.facility = params.facility;
    if (params.from || params.to) {
      where.bookedAt = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      };
    }
  }

  const [total, bookings] = await Promise.all([
    prisma.inmateBooking.count({ where }),
    prisma.inmateBooking.findMany({
      where,
      orderBy: { bookedAt: 'desc' },
      skip: params.offset,
      take: params.limit,
      include: { charges: true, sourceBatch: true, inmate: true },
    }),
  ]);

  return {
    total,
    results: await Promise.all(bookings.map(async (b) => ({
      inmateId: b.inmateId,
      name: `${b.inmate.displayLast ?? b.inmate.canonicalLast}, ${b.inmate.displayFirst ?? b.inmate.canonicalFirst}`,
      dateOfBirth: b.inmate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      sex: b.inmate.sex,
      race: b.inmate.race,
      identityConfidence: b.inmate.identityConfidence,
      discoveredOn: b.bookedAt.toISOString(),
      facility: b.facility,
      externalBookingId: b.externalBookingId,
      arrestingAgency: b.arrestingAgency,
      bailAmount: money(b.bailAmountCents),
      charges: b.charges.map((c) => ({
        statute: c.statuteCode && c.statuteSection ? `${c.statuteCode} ${c.statuteSection}` : null,
        description: c.description,
        severity: c.severity,
        counts: c.counts,
        rawText: c.rawText,
      })),
      /** Non-zero when they have been booked again since being discovered. */
      priorArrestCount: Math.max(0, await prisma.inmateBooking.count({
        where: { inmateId: b.inmateId, bookedAt: { lt: b.bookedAt } },
      })),
      totalArrestCount: b.inmate.bookingCount,
      provenance: {
        batchId: b.sourceBatch.batchId,
        filename: b.sourceBatch.sourceFilename,
        rosterDate: b.sourceBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
      },
    }))),
  };
}

/** Rows a person must look at before they change the repository. */
export async function getReviewQueue(limit: number, offset: number) {
  const [total, rows] = await Promise.all([
    prisma.inmateIngestionRecord.count({ where: { resolution: 'needs_review' } }),
    prisma.inmateIngestionRecord.findMany({
      where: { resolution: 'needs_review' },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: { batch: true },
    }),
  ]);

  return {
    total,
    results: rows.map((r) => ({
      recordId: r.recordId,
      lineNumber: r.lineNumber,
      candidateInmateId: r.resolvedInmateId,
      confidence: r.confidence,
      tier: r.matchTier,
      /** The full confidence model, so a reviewer sees the reasons and conflicts. */
      evidence: r.matchEvidence,
      normalized: r.normalizedPayload,
      batch: {
        batchId: r.batch.batchId,
        filename: r.batch.sourceFilename,
        facility: r.batch.facility,
        rosterDate: r.batch.rosterDate?.toISOString().slice(0, 10) ?? null,
      },
    })),
  };
}

export async function listBatches(limit: number, offset: number) {
  const [total, rows] = await Promise.all([
    prisma.inmateIngestionBatch.count(),
    prisma.inmateIngestionBatch.findMany({
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
      include: { _count: { select: { issues: true } } },
    }),
  ]);

  return {
    total,
    results: rows.map((b) => ({
      batchId: b.batchId,
      filename: b.sourceFilename,
      facility: b.facility,
      sourceType: b.sourceType,
      status: b.status,
      rosterDate: b.rosterDate?.toISOString().slice(0, 10) ?? null,
      triggeredBy: b.triggeredBy,
      startedAt: b.startedAt.toISOString(),
      finishedAt: b.finishedAt?.toISOString() ?? null,
      counts: {
        total: b.recordsTotal,
        newInmates: b.recordsNew,
        matched: b.recordsMatched,
        duplicates: b.recordsDuplicate,
        needsReview: b.recordsForReview,
        failed: b.recordsFailed,
      },
      issueCount: b._count.issues,
      failureReason: b.failureReason,
    })),
  };
}

export async function getBatchIssues(batchId: string) {
  const rows = await prisma.inmateIngestionIssue.findMany({
    where: { batchId },
    orderBy: [{ severity: 'asc' }, { lineNumber: 'asc' }],
    take: 500,
  });
  return rows.map((i) => ({
    lineNumber: i.lineNumber,
    severity: i.severity,
    code: i.code,
    message: i.message,
  }));
}
