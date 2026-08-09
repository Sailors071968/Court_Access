// ============================================================================
// The person detail screen.
//
// One query set assembled into one payload, because the screen is a single question
// — "who is this and what do we know" — and answering it with eight round trips
// would make the page slower than the question deserves.
//
// The histories (bail, housing) are derived from observations rather than from the
// booking row. A booking carries its current value; an observation carries what a
// source stated at a point in time. A bail history built from bookings would show one
// figure per stay, which is not a history at all.
// ============================================================================

import prisma from '../../lib/prisma.js';

const money = (cents: bigint | null): string | null =>
  cents === null ? null : (Number(cents) / 100).toFixed(2);

const day = (date: Date | null | undefined): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

export interface PersonDetail {
  identity: {
    inmateId: string;
    name: string;
    first: string;
    last: string;
    middle: string | null;
    suffix: string | null;
    dateOfBirth: string | null;
    sex: string | null;
    race: string | null;
    identityConfidence: number;
    bookingCount: number;
    firstSeenAt: string;
    lastSeenAt: string;
    onWatchList: boolean;
    /** Set when this record was merged into another; every screen should redirect. */
    mergedIntoId: string | null;
    externalIds: { facility: string; externalId: string; occurrences: number }[];
  };
  aliases: {
    aliasId: string;
    name: string;
    first: string;
    last: string;
    middle: string | null;
    dateOfBirth: string | null;
    occurrences: number;
    firstSeenBatchId: string | null;
  }[];
  currentBooking: BookingView | null;
  historicalBookings: BookingView[];
  timeline: TimelineEntry[];
  bailHistory: { at: string; source: string; amount: string | null; bookingId: string }[];
  housingHistory: { at: string; source: string; location: string | null; bookingId: string }[];
  /** The documents and rows every conclusion about this person rests on. */
  evidence: {
    observationId: string;
    bookingId: string;
    observedAt: string;
    rosterDate: string | null;
    sourceType: string;
    sourcePage: number | null;
    sourceRow: number | null;
    document: { filename: string; sha256: string } | null;
  }[];
  /** Which imports touched this person. */
  importHistory: {
    batchId: string;
    filename: string;
    sourceType: string;
    facility: string;
    rosterDate: string | null;
    startedAt: string;
    resolution: string;
    confidence: number | null;
    tier: string | null;
    recordId: string;
    lineNumber: number;
  }[];
  /** What the engines concluded, newest first. */
  intelligence: {
    itemId: string;
    type: string;
    engine: string;
    confidence: number;
    explanation: string;
    disposition: string;
    severity: string;
    createdAt: string;
  }[];
}

interface BookingView {
  bookingId: string;
  facility: string;
  externalBookingId: string | null;
  bookedAt: string | null;
  releasedAt: string | null;
  custodyStatus: string | null;
  housingLocation: string | null;
  arrestingAgency: string | null;
  bailAmount: string | null;
  isFirstAppearance: boolean;
  departedRosterAt: string | null;
  lastObservedAt: string | null;
  observationCount: number;
  charges: {
    chargeId: string;
    statuteCode: string | null;
    statuteSection: string | null;
    description: string | null;
    severity: string;
    counts: number;
    bailAmount: string | null;
    rawText: string;
  }[];
}

interface TimelineEntry {
  at: string;
  kind: 'booked' | 'released' | 'departed_roster' | 'observed' | 'change' | 'review';
  label: string;
  detail: string | null;
  bookingId: string | null;
}

export async function getPersonDetail(inmateId: string): Promise<PersonDetail | null> {
  const inmate = await prisma.inmate.findUnique({
    where: { inmateId },
    include: {
      externalIds: { orderBy: { occurrences: 'desc' } },
      aliases: { orderBy: [{ occurrences: 'desc' }, { last: 'asc' }] },
      watchListEntries: { where: { active: true }, take: 1, select: { entryId: true } },
    },
  });
  if (!inmate) return null;

  const bookings = await prisma.inmateBooking.findMany({
    where: { inmateId },
    // Newest first, with a stable tiebreak so two bookings on the same day do not
    // swap places between requests.
    orderBy: [{ bookedAt: 'desc' }, { bookingId: 'asc' }],
    include: {
      charges: { orderBy: { chargeId: 'asc' } },
      _count: { select: { observations: true } },
    },
  });

  const bookingIds = bookings.map((b) => b.bookingId);

  const [observations, changes, importRecords, intelligence] = await Promise.all([
    bookingIds.length > 0
      ? prisma.inmateBookingObservation.findMany({
          where: { bookingId: { in: bookingIds } },
          orderBy: [{ observedAt: 'asc' }, { observationId: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.inmateChangeEvent.findMany({
      where: { inmateId },
      orderBy: [{ detectedAt: 'desc' }, { eventId: 'asc' }],
      take: 200,
    }),
    prisma.inmateIngestionRecord.findMany({
      where: { resolvedInmateId: inmateId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        batch: {
          select: {
            batchId: true, sourceFilename: true, sourceType: true,
            facility: true, rosterDate: true, startedAt: true,
          },
        },
      },
    }),
    prisma.inmateIntelligenceItem.findMany({
      where: { subjectKind: 'person', subjectId: inmateId },
      orderBy: [{ createdAt: 'desc' }, { itemId: 'asc' }],
      take: 50,
    }),
  ]);

  const documentIds = [...new Set(observations.map((o) => o.documentId).filter((v): v is string => Boolean(v)))];
  const documents = documentIds.length > 0
    ? await prisma.inmateSourceDocument.findMany({
        where: { documentId: { in: documentIds } },
        select: { documentId: true, filename: true, sha256: true },
      })
    : [];
  const documentById = new Map(documents.map((d) => [d.documentId, d]));

  const toBookingView = (b: (typeof bookings)[number]): BookingView => ({
    bookingId: b.bookingId,
    facility: b.facility,
    externalBookingId: b.externalBookingId,
    bookedAt: day(b.bookedAt),
    releasedAt: day(b.releasedAt),
    custodyStatus: b.custodyStatus,
    housingLocation: b.housingLocation,
    arrestingAgency: b.arrestingAgency,
    bailAmount: money(b.bailAmountCents),
    isFirstAppearance: b.isFirstAppearance,
    departedRosterAt: day(b.departedRosterAt),
    lastObservedAt: b.lastObservedAt?.toISOString() ?? null,
    observationCount: b._count.observations,
    charges: b.charges.map((c) => ({
      chargeId: c.chargeId,
      statuteCode: c.statuteCode,
      statuteSection: c.statuteSection,
      description: c.description,
      severity: c.severity,
      counts: c.counts,
      bailAmount: money(c.bailAmountCents),
      rawText: c.rawText,
    })),
  });

  // In custody means the jail has not released them and has not stopped listing
  // them. Either alone is not enough: a roster that stops listing someone without a
  // release date is a departure, not a release, and the two must stay distinguishable.
  const current = bookings.find((b) => b.releasedAt === null && b.departedRosterAt === null);

  const bailHistory = observations
    .filter((o) => o.bailAmountCents !== null)
    .map((o) => ({
      at: o.rosterDate?.toISOString().slice(0, 10) ?? o.observedAt.toISOString().slice(0, 10),
      source: o.sourceType,
      amount: money(o.bailAmountCents),
      bookingId: o.bookingId,
    }));

  const housingHistory = observations
    .filter((o) => o.housingLocation !== null)
    .map((o) => ({
      at: o.rosterDate?.toISOString().slice(0, 10) ?? o.observedAt.toISOString().slice(0, 10),
      source: o.sourceType,
      location: o.housingLocation,
      bookingId: o.bookingId,
    }));

  return {
    identity: {
      inmateId: inmate.inmateId,
      name: `${inmate.canonicalLast}, ${inmate.canonicalFirst}`,
      first: inmate.canonicalFirst,
      last: inmate.canonicalLast,
      middle: inmate.canonicalMiddle,
      suffix: inmate.suffix,
      dateOfBirth: day(inmate.dateOfBirth),
      sex: inmate.sex,
      race: inmate.race,
      identityConfidence: inmate.identityConfidence,
      bookingCount: inmate.bookingCount,
      firstSeenAt: inmate.firstSeenAt.toISOString(),
      lastSeenAt: inmate.lastSeenAt.toISOString(),
      onWatchList: inmate.watchListEntries.length > 0,
      mergedIntoId: inmate.mergedIntoId,
      externalIds: inmate.externalIds.map((e) => ({
        facility: e.facility,
        externalId: e.externalId,
        occurrences: e.occurrences,
      })),
    },
    aliases: inmate.aliases.map((a) => ({
      aliasId: a.aliasId,
      name: `${a.last}, ${a.first}`,
      first: a.first,
      last: a.last,
      middle: a.middle,
      dateOfBirth: day(a.dateOfBirth),
      occurrences: a.occurrences,
      firstSeenBatchId: a.sourceBatchId,
    })),
    currentBooking: current ? toBookingView(current) : null,
    historicalBookings: bookings.filter((b) => b.bookingId !== current?.bookingId).map(toBookingView),
    timeline: buildTimeline(bookings, changes),
    bailHistory,
    housingHistory,
    evidence: observations.map((o) => {
      const doc = o.documentId ? documentById.get(o.documentId) : undefined;
      return {
        observationId: o.observationId,
        bookingId: o.bookingId,
        observedAt: o.observedAt.toISOString(),
        rosterDate: day(o.rosterDate),
        sourceType: o.sourceType,
        sourcePage: o.sourcePage,
        sourceRow: o.sourceRow,
        document: doc ? { filename: doc.filename, sha256: doc.sha256 } : null,
      };
    }),
    importHistory: importRecords.map((r) => ({
      batchId: r.batch.batchId,
      filename: r.batch.sourceFilename,
      sourceType: r.batch.sourceType,
      facility: r.batch.facility,
      rosterDate: day(r.batch.rosterDate),
      startedAt: r.batch.startedAt.toISOString(),
      resolution: r.resolution,
      confidence: r.confidence,
      tier: r.matchTier,
      recordId: r.recordId,
      lineNumber: r.lineNumber,
    })),
    intelligence: intelligence.map((i) => ({
      itemId: i.itemId,
      type: i.type,
      engine: i.engine,
      confidence: i.confidence,
      explanation: i.explanation,
      disposition: i.disposition,
      severity: i.severity,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

/**
 * One chronology from bookings and change events.
 *
 * Sorted newest first because the operational question is almost always "what
 * happened recently". Entries with no date are dropped rather than dated to the
 * epoch, which would put them at the wrong end of the list and look like data.
 */
function buildTimeline(
  bookings: { bookingId: string; bookedAt: Date | null; releasedAt: Date | null; departedRosterAt: Date | null; facility: string; externalBookingId: string | null; isFirstAppearance: boolean }[],
  changes: { eventId: string; changeType: string; field: string | null; previousValue: string | null; newValue: string | null; detectedAt: Date; rosterDate: Date | null; bookingId: string | null; material: boolean }[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const b of bookings) {
    if (b.bookedAt) {
      entries.push({
        at: b.bookedAt.toISOString(),
        kind: 'booked',
        label: b.isFirstAppearance ? 'First recorded booking' : 'Booked',
        detail: [b.facility, b.externalBookingId].filter(Boolean).join(' · ') || null,
        bookingId: b.bookingId,
      });
    }
    if (b.releasedAt) {
      entries.push({
        at: b.releasedAt.toISOString(),
        kind: 'released',
        label: 'Released',
        detail: b.facility,
        bookingId: b.bookingId,
      });
    }
    if (b.departedRosterAt) {
      entries.push({
        at: b.departedRosterAt.toISOString(),
        kind: 'departed_roster',
        // Said carefully: the jail stopped listing them, which is not the same as a
        // recorded release, and the timeline should not imply one from the other.
        label: 'No longer on the roster',
        detail: 'The facility stopped listing this booking. No release date was published.',
        bookingId: b.bookingId,
      });
    }
  }

  for (const c of changes) {
    if (!c.material) continue;
    entries.push({
      at: (c.rosterDate ?? c.detectedAt).toISOString(),
      kind: c.changeType.startsWith('review_') ? 'review' : 'change',
      label: c.changeType.replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase()),
      detail: c.field
        ? `${c.field}: ${c.previousValue ?? 'nothing'} → ${c.newValue ?? 'nothing'}`
        : null,
      bookingId: c.bookingId,
    });
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

// ---------------------------------------------------------------------------
// Historical search
// ---------------------------------------------------------------------------

export interface HistoricalSearchParams {
  /** Matched against canonical names and every alias. */
  name?: string;
  last?: string;
  first?: string;
  dateOfBirth?: string;
  /** The jail's booking number for one stay. */
  bookingNumber?: string;
  /** The jail's person identifier — X-Ref or SO number in Sacramento. */
  externalPersonId?: string;
  facility?: string;
  limit: number;
  offset: number;
}

/**
 * Search by anything an operator might have.
 *
 * Every criterion is an AND, and each one is matched against aliases as well as the
 * canonical record — a person booked last year as "KATHERINE" and this year as
 * "CATHERINE" must be findable by either, or the historical repository is only as
 * good as the most recent spelling.
 */
export async function searchHistorical(params: HistoricalSearchParams) {
  const and: Record<string, unknown>[] = [];

  const upper = (value?: string) => value?.trim().toUpperCase() || undefined;

  const name = upper(params.name);
  if (name) {
    and.push({
      OR: [
        { canonicalLast: { contains: name } },
        { canonicalFirst: { contains: name } },
        { canonicalMiddle: { contains: name } },
        { aliases: { some: { OR: [{ last: { contains: name } }, { first: { contains: name } }] } } },
      ],
    });
  }

  const last = upper(params.last);
  if (last) {
    and.push({
      OR: [
        { canonicalLast: { contains: last } },
        { aliases: { some: { last: { contains: last } } } },
      ],
    });
  }

  const first = upper(params.first);
  if (first) {
    and.push({
      OR: [
        { canonicalFirst: { contains: first } },
        { aliases: { some: { first: { contains: first } } } },
      ],
    });
  }

  if (params.dateOfBirth) {
    const dob = new Date(params.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      and.push({
        OR: [
          { dateOfBirth: dob },
          { aliases: { some: { dateOfBirth: dob } } },
        ],
      });
    }
  }

  const bookingNumber = params.bookingNumber?.trim();
  if (bookingNumber) {
    and.push({ bookings: { some: { externalBookingId: { contains: bookingNumber, mode: 'insensitive' } } } });
  }

  const personId = params.externalPersonId?.trim();
  if (personId) {
    and.push({ externalIds: { some: { externalId: { contains: personId, mode: 'insensitive' } } } });
  }

  if (params.facility) {
    and.push({ bookings: { some: { facility: params.facility } } });
  }

  // A person merged into another is not a separate result; the surviving record is.
  const where = { mergedIntoId: null, ...(and.length > 0 ? { AND: and } : {}) };

  const [total, rows] = await Promise.all([
    prisma.inmate.count({ where }),
    prisma.inmate.findMany({
      where,
      orderBy: [{ lastSeenAt: 'desc' }, { inmateId: 'asc' }],
      skip: params.offset,
      take: params.limit,
      include: {
        _count: { select: { aliases: true } },
        externalIds: { select: { externalId: true }, take: 3 },
        watchListEntries: { where: { active: true }, take: 1, select: { entryId: true } },
        bookings: {
          orderBy: [{ bookedAt: 'desc' }, { bookingId: 'asc' }],
          take: 1,
          select: {
            bookingId: true, bookedAt: true, releasedAt: true, departedRosterAt: true,
            facility: true, externalBookingId: true, housingLocation: true, bailAmountCents: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    results: rows.map((row) => {
      const latest = row.bookings[0];
      return {
        inmateId: row.inmateId,
        name: `${row.canonicalLast}, ${row.canonicalFirst}`,
        first: row.canonicalFirst,
        last: row.canonicalLast,
        middle: row.canonicalMiddle,
        dateOfBirth: day(row.dateOfBirth),
        sex: row.sex,
        race: row.race,
        bookingCount: row.bookingCount,
        aliasCount: row._count.aliases,
        externalIds: row.externalIds.map((e) => e.externalId),
        onWatchList: row.watchListEntries.length > 0,
        identityConfidence: row.identityConfidence,
        firstSeenAt: row.firstSeenAt.toISOString().slice(0, 10),
        lastSeenAt: row.lastSeenAt.toISOString().slice(0, 10),
        latestBooking: latest ? {
          bookingId: latest.bookingId,
          bookedAt: day(latest.bookedAt),
          releasedAt: day(latest.releasedAt),
          facility: latest.facility,
          externalBookingId: latest.externalBookingId,
          housingLocation: latest.housingLocation,
          bailAmount: money(latest.bailAmountCents),
          inCustody: latest.releasedAt === null && latest.departedRosterAt === null,
        } : null,
      };
    }),
  };
}
