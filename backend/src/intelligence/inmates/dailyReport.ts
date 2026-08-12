// ============================================================================
// The Daily Intelligence Report — the operational product.
//
// One document, printed each morning, that a bail bonds employee reads instead of
// the dashboard. Eight sections: what was imported, who is new, who is back, who is
// watched, what changed, what needs a person, the totals, and the evidence behind
// every one of those claims.
//
// Two decisions shape the whole file.
//
// It is server-rendered HTML with a print stylesheet, not a PDF from a library.
// It prints correctly from any browser, adds no dependency to an artifact that is
// fingerprinted and frozen, and the same markup is the on-screen view — so what is
// reviewed is exactly what is printed. A PDF generator would give a second rendering
// path that could disagree with the first.
//
// Every section is built from what was recorded at import time, never re-derived.
// "Newly booked" is a property the pipeline wrote down; recomputing it from current
// data would change last week's printed report every time an older roster was
// backfilled, and a report that changes after it was printed is not evidence.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { displayName } from './displayName.js';

const money = (cents: bigint | null | undefined): string | null =>
  cents === null || cents === undefined ? null : (Number(cents) / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });

const day = (date: Date | null | undefined): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

const minutes = (ms: number): string => {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} seconds`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
};

export interface DailyReportParameters {
  /** The roster day to report on. Defaults to the most recent day with an import. */
  date?: string;
  facility?: string;
}

// ---------------------------------------------------------------------------
// Section shapes
// ---------------------------------------------------------------------------

export interface ImportSummary {
  reportDate: string;
  isToday: boolean;
  operators: string[];
  files: {
    filename: string;
    kind: string;
    sizeBytes: number | null;
    sha256: string;
    parserProfile: string | null;
    rosterDate: string | null;
    status: string;
    durationMs: number | null;
  }[];
  processingTimeMs: number;
  batchIds: string[];
  facilities: string[];
}

export interface NewlyBookedRow {
  inmateId: string;
  name: string;
  dateOfBirth: string | null;
  bookingNumber: string | null;
  bookingDate: string | null;
  facility: string;
  housing: string | null;
  bail: string | null;
  arrestingAgency: string | null;
  arrestType: string | null;
  courtDate: string | null;
  courtName: string | null;
  charges: { statute: string | null; description: string | null; severity: string; counts: number }[];
  confidence: number;
  matchTier: string | null;
  onWatchList: boolean;
}

export interface ReturningRow {
  inmateId: string;
  name: string;
  dateOfBirth: string | null;
  bookingNumber: string | null;
  bookingDate: string | null;
  facility: string;
  housing: string | null;
  bail: string | null;
  charges: { statute: string | null; description: string | null; severity: string }[];
  /** Bookings before this one. The reason they are "returning". */
  priorBookingCount: number;
  priorBookingDates: string[];
  lastBookingBefore: string | null;
  aliases: string[];
  confidence: number;
  matchTier: string | null;
  onWatchList: boolean;
}

export interface WatchListMatchRow {
  inmateId: string;
  name: string;
  matchType: string;
  priority: string;
  watchListReason: string;
  /** Why a notification was raised, in the engine's own words. */
  notificationReason: string | null;
  confidence: number;
  bookingNumber: string | null;
  bookingDate: string | null;
  housing: string | null;
  bail: string | null;
}

export interface SignificantChangeRow {
  inmateId: string | null;
  name: string;
  bookingNumber: string | null;
  changeType: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  detectedAt: string;
  observationId: string | null;
}

export interface ReviewRow {
  recordId: string;
  subjectName: string;
  candidateName: string | null;
  confidence: number | null;
  tier: string | null;
  reason: string;
  priority: string;
  assignedTo: string | null;
  evidenceRequested: string | null;
  raisedAt: string;
  sourceFile: string;
  sourceRow: number;
}

export interface ReportStatistics {
  rowsParsed: number;
  rowsFailed: number;
  matched: number;
  newInmates: number;
  returningInmates: number;
  duplicates: number;
  conflicts: number;
  unresolvedConflicts: number;
  reviewsRaised: number;
  reviewsOutstanding: number;
  watchListHits: number;
  departures: number;
  significantChanges: number;
}

export interface EvidenceAppendixEntry {
  /** What the claim is. */
  claim: string;
  document: string;
  documentSha256: string;
  page: number | null;
  row: number | null;
  observationId: string;
  rosterDate: string | null;
  sourceType: string;
  /** Why the system concluded what it concluded, in plain language. */
  reasoning: string;
  engine: string | null;
  engineVersion: string | null;
  parserProfile: string | null;
}

export interface DailyReport {
  summary: ImportSummary;
  newlyBooked: NewlyBookedRow[];
  returning: ReturningRow[];
  watchListMatches: WatchListMatchRow[];
  significantChanges: SignificantChangeRow[];
  reviewQueue: ReviewRow[];
  statistics: ReportStatistics;
  evidence: EvidenceAppendixEntry[];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Build the report for one roster day.
 *
 * Scoped to the batches that ran that day rather than to booking dates, because the
 * question the report answers is "what did this morning's import find" — and a roster
 * dated yesterday, imported today, belongs in today's report.
 */
export async function buildDailyReport(params: DailyReportParameters = {}): Promise<DailyReport> {
  const { dayStart, dayEnd, date } = await resolveDay(params.date);

  const batches = await prisma.inmateIngestionBatch.findMany({
    where: {
      startedAt: { gte: dayStart, lt: dayEnd },
      ...(params.facility ? { facility: params.facility } : {}),
    },
    orderBy: { startedAt: 'asc' },
  });
  const batchIds = batches.map((b) => b.batchId);
  const none = batchIds.length === 0;

  const uploads = none ? [] : await prisma.inmateRosterUpload.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: { uploadedAt: 'asc' },
  });

  const profiles = await prisma.inmateParserProfile.findMany({
    where: { profileId: { in: batches.map((b) => b.parserProfileId).filter((v): v is string => Boolean(v)) } },
    select: { profileId: true, label: true, version: true, sourceType: true },
  });
  const profileById = new Map(profiles.map((p) => [p.profileId, p]));

  const summary: ImportSummary = {
    reportDate: date,
    isToday: date === new Date().toISOString().slice(0, 10),
    // Uploads name the operator for a dashboard import; a CLI or scheduled import
    // has no upload row, so the batch's own record of who ran it is the fallback.
    // Without it the report says nobody ran the import that plainly ran.
    operators: [...new Set([
      ...uploads.map((u) => u.uploadedByName ?? u.uploadedById),
      ...batches.map((b) => b.ingestedById).filter((v): v is string => Boolean(v)),
    ])],
    files: batches.map((b) => {
      const upload = uploads.find((u) => u.batchId === b.batchId);
      const profile = b.parserProfileId ? profileById.get(b.parserProfileId) : undefined;
      return {
        filename: b.sourceFilename,
        kind: b.sourceType,
        sizeBytes: upload?.sizeBytes ?? null,
        sha256: b.sourceSha256,
        parserProfile: profile ? `${profile.label} (v${profile.version})` : null,
        rosterDate: day(b.rosterDate),
        status: b.status,
        durationMs: b.finishedAt ? b.finishedAt.getTime() - b.startedAt.getTime() : null,
      };
    }),
    processingTimeMs: batches.reduce(
      (total, b) => total + (b.finishedAt ? b.finishedAt.getTime() - b.startedAt.getTime() : 0), 0),
    batchIds,
    facilities: [...new Set(batches.map((b) => b.facility))],
  };

  if (none) {
    return {
      summary,
      newlyBooked: [], returning: [], watchListMatches: [],
      significantChanges: [], reviewQueue: [],
      statistics: emptyStatistics(),
      evidence: [],
    };
  }

  const [newlyBooked, returning, watchListMatches, significantChanges, reviewQueue, statistics] =
    await Promise.all([
      buildNewlyBooked(batchIds),
      buildReturning(batchIds),
      buildWatchListMatches(batchIds),
      buildSignificantChanges(batchIds),
      buildReviewQueue(batchIds),
      buildStatistics(batchIds),
    ]);

  const evidence = await buildEvidenceAppendix(batchIds, profileById);

  return { summary, newlyBooked, returning, watchListMatches, significantChanges, reviewQueue, statistics, evidence };
}

/**
 * Match tiers for a set of import records.
 *
 * `InmateBooking.sourceRecordId` is a plain id rather than a relation, so the tier
 * cannot be included in the booking query.
 */
async function matchTiersFor(recordIds: (string | null)[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(recordIds.filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return new Map();
  const records = await prisma.inmateIngestionRecord.findMany({
    where: { recordId: { in: ids } },
    select: { recordId: true, matchTier: true },
  });
  return new Map(records.map((r) => [r.recordId, r.matchTier]));
}

/** Bookings this import recorded as a first appearance. */
async function buildNewlyBooked(batchIds: string[]): Promise<NewlyBookedRow[]> {
  const bookings = await prisma.inmateBooking.findMany({
    where: { sourceBatchId: { in: batchIds }, isFirstAppearance: true },
    orderBy: [{ bookedAt: 'desc' }, { bookingId: 'asc' }],
    include: {
      charges: { orderBy: { chargeId: 'asc' } },
      inmate: {
        select: {
          inmateId: true, canonicalFirst: true, canonicalLast: true, canonicalMiddle: true,
          displayFirst: true, displayLast: true, displayMiddle: true,
          dateOfBirth: true, identityConfidence: true,
          watchListEntries: { where: { active: true }, take: 1, select: { entryId: true } },
        },
      },
    },
  });

  // The match tier lives on the import record, which is referenced by id rather than
  // by relation, so it is fetched separately rather than joined.
  const tierOf = await matchTiersFor(bookings.map((b) => b.sourceRecordId ?? null));

  return bookings.map((b) => ({
    inmateId: b.inmateId,
    name: displayName(b.inmate, { includeMiddle: true }),
    dateOfBirth: day(b.inmate.dateOfBirth),
    bookingNumber: b.externalBookingId,
    bookingDate: b.bookedAt?.toISOString() ?? null,
    facility: b.facility,
    housing: b.housingLocation,
    bail: money(b.bailAmountCents),
    arrestingAgency: b.arrestingAgency,
    arrestType: b.arrestType,
    courtDate: day(b.courtDate),
    courtName: b.courtName,
    charges: b.charges.map((c) => ({
      statute: [c.statuteCode, c.statuteSection].filter(Boolean).join(' ') || null,
      description: c.description,
      severity: c.severity,
      counts: c.counts,
    })),
    confidence: b.inmate.identityConfidence,
    matchTier: b.sourceRecordId ? (tierOf.get(b.sourceRecordId) ?? null) : null,
    onWatchList: b.inmate.watchListEntries.length > 0,
  }));
}

/**
 * People this import matched to someone already in the repository who had a prior
 * booking.
 *
 * A match alone is not "returning": the same roster restating today's booking also
 * matches. What makes it a return is a booking that ended before this one began.
 */
async function buildReturning(batchIds: string[]): Promise<ReturningRow[]> {
  const bookings = await prisma.inmateBooking.findMany({
    where: { sourceBatchId: { in: batchIds }, isFirstAppearance: false },
    orderBy: [{ bookedAt: 'desc' }, { bookingId: 'asc' }],
    include: {
      charges: { orderBy: { chargeId: 'asc' } },
      inmate: {
        select: {
          inmateId: true, canonicalFirst: true, canonicalLast: true, canonicalMiddle: true,
          displayFirst: true, displayLast: true, displayMiddle: true,
          dateOfBirth: true, identityConfidence: true,
          aliases: { select: { last: true, first: true, displayLast: true, displayFirst: true }, take: 12 },
          watchListEntries: { where: { active: true }, take: 1, select: { entryId: true } },
        },
      },
    },
  });

  const tierOf = await matchTiersFor(bookings.map((b) => b.sourceRecordId ?? null));
  const rows: ReturningRow[] = [];
  for (const b of bookings) {
    const priors = await prisma.inmateBooking.findMany({
      where: {
        inmateId: b.inmateId,
        bookingId: { not: b.bookingId },
        ...(b.bookedAt ? { bookedAt: { lt: b.bookedAt } } : {}),
      },
      orderBy: { bookedAt: 'desc' },
      select: { bookedAt: true },
      take: 25,
    });

    // No prior booking means this is a restatement, not a return. Excluded rather
    // than listed with a count of zero, which would pad the section an operator
    // reads to decide who to call.
    if (priors.length === 0) continue;

    rows.push({
      inmateId: b.inmateId,
      name: displayName(b.inmate, { includeMiddle: true }),
      dateOfBirth: day(b.inmate.dateOfBirth),
      bookingNumber: b.externalBookingId,
      bookingDate: b.bookedAt?.toISOString() ?? null,
      facility: b.facility,
      housing: b.housingLocation,
      bail: money(b.bailAmountCents),
      charges: b.charges.map((c) => ({
        statute: [c.statuteCode, c.statuteSection].filter(Boolean).join(' ') || null,
        description: c.description,
        severity: c.severity,
      })),
      priorBookingCount: priors.length,
      priorBookingDates: priors.map((p) => day(p.bookedAt)).filter((v): v is string => Boolean(v)),
      lastBookingBefore: day(priors[0]?.bookedAt),
      aliases: [...new Set(b.inmate.aliases.map((a) =>
        `${a.displayLast ?? a.last}, ${a.displayFirst ?? a.first}`))],
      confidence: b.inmate.identityConfidence,
      matchTier: b.sourceRecordId ? (tierOf.get(b.sourceRecordId) ?? null) : null,
      onWatchList: b.inmate.watchListEntries.length > 0,
    });
  }
  return rows;
}

async function buildWatchListMatches(batchIds: string[]): Promise<WatchListMatchRow[]> {
  const matches = await prisma.inmateWatchListMatch.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: [{ detectedAt: 'desc' }, { matchId: 'asc' }],
    include: { entry: { select: { reason: true, priority: true, label: true } } },
  });
  if (matches.length === 0) return [];

  // The match references the person by id rather than by relation.
  const watched = await prisma.inmate.findMany({
    where: { inmateId: { in: [...new Set(matches.map((m) => m.inmateId))] } },
    select: {
      inmateId: true, canonicalFirst: true, canonicalLast: true,
      displayFirst: true, displayLast: true,
    },
  });
  const watchedById = new Map(watched.map((w) => [w.inmateId, w]));

  // The notification's own wording, so the printed reason is the one the operator
  // received rather than a second rendering of it.
  const notifications = await prisma.inmateNotification.findMany({
    where: { batchId: { in: batchIds } },
    select: { referenceId: true, body: true, inmateId: true, severity: true },
  });
  const notificationByInmate = new Map(notifications.map((n) => [n.inmateId ?? '', n]));

  const bookingIds = matches.map((m) => m.bookingId).filter((v): v is string => Boolean(v));
  const bookings = bookingIds.length > 0
    ? await prisma.inmateBooking.findMany({
        where: { bookingId: { in: bookingIds } },
        select: {
          bookingId: true, externalBookingId: true, bookedAt: true,
          housingLocation: true, bailAmountCents: true,
        },
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.bookingId, b]));

  return matches.map((m) => {
    const booking = m.bookingId ? bookingById.get(m.bookingId) : undefined;
    const notification = notificationByInmate.get(m.inmateId);
    return {
      inmateId: m.inmateId,
      name: (() => {
        const person = watchedById.get(m.inmateId);
        return person ? displayName(person) : 'UNKNOWN';
      })(),
      matchType: m.matchType,
      priority: m.entry.priority,
      watchListReason: m.entry.reason,
      notificationReason: notification?.body ?? null,
      // A watch list hit is a certainty about a person already identified: the
      // uncertainty, if any, was in the identification, not the match.
      confidence: 100,
      bookingNumber: booking?.externalBookingId ?? null,
      bookingDate: booking?.bookedAt?.toISOString() ?? null,
      housing: booking?.housingLocation ?? null,
      bail: money(booking?.bailAmountCents),
    };
  });
}

/**
 * The changes worth an operator's attention: money, liberty, location, charges.
 *
 * These are the names the change engine actually emits, taken from
 * changeDetection.ts rather than guessed. Guessing them produced a Significant
 * Changes section that silently listed nothing but departures while bail and housing
 * changes sat in the database unreported — the section looked like it worked.
 */
const SIGNIFICANT_CHANGES = [
  'bail_change',
  'housing_change',
  'custody_status_change',
  'charge_added',
  'charge_removed',
  'court_date_change',
  'released',
  'departed_roster',
  'returning_inmate',
];

async function buildSignificantChanges(batchIds: string[]): Promise<SignificantChangeRow[]> {
  const events = await prisma.inmateChangeEvent.findMany({
    where: { batchId: { in: batchIds }, material: true, changeType: { in: SIGNIFICANT_CHANGES } },
    orderBy: [{ changeType: 'asc' }, { detectedAt: 'desc' }],
    take: 500,
  });

  const inmateIds = [...new Set(events.map((e) => e.inmateId).filter((v): v is string => Boolean(v)))];
  const inmates = inmateIds.length > 0
    ? await prisma.inmate.findMany({
        where: { inmateId: { in: inmateIds } },
        select: {
          inmateId: true, canonicalFirst: true, canonicalLast: true,
          displayFirst: true, displayLast: true,
        },
      })
    : [];
  const nameOf = new Map(inmates.map((i) => [i.inmateId, displayName(i)]));

  const bookingIds = [...new Set(events.map((e) => e.bookingId).filter((v): v is string => Boolean(v)))];
  const bookings = bookingIds.length > 0
    ? await prisma.inmateBooking.findMany({
        where: { bookingId: { in: bookingIds } },
        select: { bookingId: true, externalBookingId: true },
      })
    : [];
  const bookingNumberOf = new Map(bookings.map((b) => [b.bookingId, b.externalBookingId]));

  return events.map((e) => ({
    inmateId: e.inmateId,
    name: e.inmateId ? (nameOf.get(e.inmateId) ?? 'UNKNOWN') : 'UNKNOWN',
    bookingNumber: e.bookingId ? (bookingNumberOf.get(e.bookingId) ?? null) : null,
    changeType: e.changeType,
    field: e.field,
    previousValue: e.previousValue,
    newValue: e.newValue,
    detectedAt: (e.rosterDate ?? e.detectedAt).toISOString(),
    observationId: e.observationId,
  }));
}

/**
 * Everything still awaiting a person.
 *
 * Not scoped to this import's batches: an item raised last Tuesday and still open is
 * exactly what a daily report should be putting in front of someone. Scoping it to
 * today would let the queue grow invisibly.
 */
async function buildReviewQueue(_batchIds: string[]): Promise<ReviewRow[]> {
  const items = await prisma.inmateReviewQueueItem.findMany({
    where: { status: 'pending' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 200,
  });
  if (items.length === 0) return [];

  const records = await prisma.inmateIngestionRecord.findMany({
    where: { recordId: { in: items.map((i) => i.importRecordId) } },
    include: { batch: { select: { sourceFilename: true } } },
  });
  const recordById = new Map(records.map((r) => [r.recordId, r]));

  const candidateIds = [...new Set(items.map((i) => i.candidateInmateId).filter((v): v is string => Boolean(v)))];
  const candidates = candidateIds.length > 0
    ? await prisma.inmate.findMany({
        where: { inmateId: { in: candidateIds } },
        select: {
          inmateId: true, canonicalFirst: true, canonicalLast: true,
          displayFirst: true, displayLast: true,
        },
      })
    : [];
  const candidateNameOf = new Map(candidates.map((c) => [c.inmateId, displayName(c)]));

  return items.map((item) => {
    const record = recordById.get(item.importRecordId);
    const normalized = record?.normalizedPayload as { last?: string; first?: string } | null;
    return {
      recordId: item.importRecordId,
      subjectName: normalized ? `${normalized.last ?? '?'}, ${normalized.first ?? '?'}` : 'UNKNOWN',
      candidateName: item.candidateInmateId ? (candidateNameOf.get(item.candidateInmateId) ?? null) : null,
      confidence: item.confidence,
      tier: record?.matchTier ?? null,
      reason: item.reason,
      priority: item.priority,
      assignedTo: item.assignedToId,
      evidenceRequested: item.evidenceRequested,
      raisedAt: item.createdAt.toISOString(),
      sourceFile: record?.batch.sourceFilename ?? 'unknown',
      sourceRow: record?.lineNumber ?? 0,
    };
  });
}

async function buildStatistics(batchIds: string[]): Promise<ReportStatistics> {
  const [
    parsed, failed, matched, duplicates, newBookings, returningBookings,
    conflicts, unresolvedConflicts, reviewsRaised, reviewsOutstanding,
    watchListHits, departures, changes,
  ] = await Promise.all([
    prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds } } }),
    prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds }, resolution: 'failed' } }),
    prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds }, resolution: 'matched' } }),
    prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds }, resolution: 'duplicate' } }),
    prisma.inmateBooking.count({ where: { sourceBatchId: { in: batchIds }, isFirstAppearance: true } }),
    prisma.inmateBooking.count({ where: { sourceBatchId: { in: batchIds }, isFirstAppearance: false } }),
    prisma.inmateSourceConflict.count({ where: { batchId: { in: batchIds } } }),
    prisma.inmateSourceConflict.count({ where: { batchId: { in: batchIds }, resolution: 'unknown' } }),
    prisma.inmateReviewQueueItem.count({ where: { batchId: { in: batchIds } } }),
    prisma.inmateReviewQueueItem.count({ where: { status: 'pending' } }),
    prisma.inmateWatchListMatch.count({ where: { batchId: { in: batchIds } } }),
    prisma.inmateChangeEvent.count({ where: { batchId: { in: batchIds }, changeType: 'departed_roster' } }),
    prisma.inmateChangeEvent.count({
      where: { batchId: { in: batchIds }, material: true, changeType: { in: SIGNIFICANT_CHANGES } },
    }),
  ]);

  return {
    rowsParsed: parsed,
    rowsFailed: failed,
    matched,
    newInmates: newBookings,
    returningInmates: returningBookings,
    duplicates,
    conflicts,
    unresolvedConflicts,
    reviewsRaised,
    reviewsOutstanding,
    watchListHits,
    departures,
    significantChanges: changes,
  };
}

function emptyStatistics(): ReportStatistics {
  return {
    rowsParsed: 0, rowsFailed: 0, matched: 0, newInmates: 0, returningInmates: 0,
    duplicates: 0, conflicts: 0, unresolvedConflicts: 0, reviewsRaised: 0,
    reviewsOutstanding: 0, watchListHits: 0, departures: 0, significantChanges: 0,
  };
}

/**
 * The evidence appendix: document → page → row → observation → reasoning.
 *
 * The section that makes the rest of the report auditable. Every claim above traces
 * to a place in a file and a sentence explaining what was concluded from it, so a
 * reader who disbelieves a line can go and check it rather than take it on trust.
 *
 * Bounded, because a thousand-row roster would produce an appendix nobody prints.
 * The bound is stated in the output rather than hidden, so a reader knows the
 * appendix is a sample and where to get the rest.
 */
async function buildEvidenceAppendix(
  batchIds: string[],
  profileById: Map<string, { label: string; version: number }>,
): Promise<EvidenceAppendixEntry[]> {
  const observations = await prisma.inmateBookingObservation.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: [{ sourceType: 'asc' }, { sourcePage: 'asc' }, { sourceRow: 'asc' }],
    take: 400,
    include: {
      booking: {
        select: {
          externalBookingId: true, sourceBatchId: true,
          inmate: {
            select: {
              canonicalFirst: true, canonicalLast: true,
              displayFirst: true, displayLast: true,
            },
          },
        },
      },
    },
  });
  if (observations.length === 0) return [];

  const documentIds = [...new Set(observations.map((o) => o.documentId).filter((v): v is string => Boolean(v)))];
  const documents = documentIds.length > 0
    ? await prisma.inmateSourceDocument.findMany({
        where: { documentId: { in: documentIds } },
        select: { documentId: true, filename: true, sha256: true },
      })
    : [];
  const documentById = new Map(documents.map((d) => [d.documentId, d]));

  // The engines' own explanations, keyed by the observation they rest on, so the
  // reasoning printed is the reasoning recorded rather than a paraphrase.
  const items = await prisma.inmateIntelligenceItem.findMany({
    where: { batchId: { in: batchIds } },
    select: {
      evidenceObservationIds: true, explanation: true, engine: true,
      engineVersion: true, type: true, confidence: true,
    },
    take: 3_000,
  });
  const reasoningByObservation = new Map<string, typeof items[number][]>();
  for (const item of items) {
    for (const id of item.evidenceObservationIds) {
      const list = reasoningByObservation.get(id) ?? [];
      list.push(item);
      reasoningByObservation.set(id, list);
    }
  }

  const batches = await prisma.inmateIngestionBatch.findMany({
    where: { batchId: { in: batchIds } },
    select: { batchId: true, parserProfileId: true },
  });
  const profileForBatch = new Map(batches.map((b) => [
    b.batchId,
    b.parserProfileId ? profileById.get(b.parserProfileId) : undefined,
  ]));

  return observations.map((o) => {
    const doc = o.documentId ? documentById.get(o.documentId) : undefined;
    const reasoning = reasoningByObservation.get(o.observationId) ?? [];
    const profile = profileForBatch.get(o.batchId);
    const person = displayName(o.booking.inmate);

    // What this observation is evidence *of*, stated as the source stated it.
    const stated: string[] = [];
    if (o.housingLocation) stated.push(`housing ${o.housingLocation}`);
    if (o.bailAmountCents !== null) stated.push(`bail ${money(o.bailAmountCents)}`);
    if (o.releasedAt) stated.push(`released ${day(o.releasedAt)}`);
    if (o.projectedReleaseAt) stated.push(`projected release ${day(o.projectedReleaseAt)}`);
    if (o.courtDate) stated.push(`court ${day(o.courtDate)}${o.courtName ? ` at ${o.courtName}` : ''}`);
    if (o.chargeCount !== null) stated.push(`${o.chargeCount} charge(s)`);
    if (o.outstandingWarrants !== null) stated.push(`warrants ${o.outstandingWarrants ? 'yes' : 'no'}`);

    return {
      claim: `${person}${o.booking.externalBookingId ? ` (booking ${o.booking.externalBookingId})` : ''}: ${
        stated.length > 0 ? stated.join(', ') : 'listed with no further detail'}`,
      document: doc?.filename ?? 'unknown',
      documentSha256: doc?.sha256 ?? '',
      page: o.sourcePage,
      row: o.sourceRow,
      observationId: o.observationId,
      rosterDate: day(o.rosterDate),
      sourceType: o.sourceType,
      reasoning: reasoning.length > 0
        ? reasoning.map((r) => `${r.type.replace(/_/g, ' ')} (${r.confidence}%): ${r.explanation}`).join(' ')
        : 'Recorded as stated by the source. No engine drew a conclusion from this observation beyond recording it.',
      engine: reasoning[0]?.engine ?? null,
      engineVersion: reasoning[0]?.engineVersion ?? null,
      parserProfile: profile ? `${profile.label} (v${profile.version})` : null,
    };
  });
}

async function resolveDay(requested?: string): Promise<{ dayStart: Date; dayEnd: Date; date: string }> {
  let date = requested?.trim();
  if (!date) {
    const latest = await prisma.inmateIngestionBatch.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    date = (latest?.startedAt ?? new Date()).toISOString().slice(0, 10);
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      dayStart: new Date(`${today}T00:00:00.000Z`),
      dayEnd: new Date(`${today}T00:00:00.000Z`),
      date: today,
    };
  }
  return { dayStart, dayEnd: new Date(dayStart.getTime() + 86_400_000), date };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const escape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const orUnknown = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? '<span class="unknown">not stated</span>' : escape(value);

/**
 * Render the report.
 *
 * `not stated` rather than a blank cell throughout. A blank reads as zero, or as an
 * oversight; the jail not publishing a bail figure is a fact about the source and the
 * report should say so.
 */
export function renderDailyReport(
  report: DailyReport,
  meta: { generatedAt: string; generatedBy: string; reportId?: string },
): string {
  const { summary, statistics } = report;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Daily Inmate Intelligence — ${escape(summary.reportDate)}</title>
<style>
  :root { --ink:#111; --muted:#666; --line:#d4d4d4; --accent:#0f3f7a; --alert:#8a1c1c; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.45 "Helvetica Neue", Arial, sans-serif; color: var(--ink); margin: 0; padding: 28px 32px; }
  h1 { font-size: 19pt; margin: 0 0 2px; letter-spacing: -0.2px; }
  h2 { font-size: 12.5pt; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 2px solid var(--accent); color: var(--accent); }
  h3 { font-size: 10.5pt; margin: 14px 0 4px; }
  .sub { color: var(--muted); font-size: 9.5pt; margin: 0 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; }
  th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-bottom: 1px solid var(--line); }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.4px; color: var(--muted); background: #f6f7f9; }
  td { font-size: 9.5pt; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .unknown { color: #999; font-style: italic; }
  .empty { color: var(--muted); font-style: italic; margin: 6px 0 14px; }
  .watch { background: var(--alert); color: #fff; font-size: 7.5pt; padding: 1px 5px; border-radius: 2px; letter-spacing: 0.4px; }
  .pill { display: inline-block; border: 1px solid var(--line); border-radius: 2px; padding: 0 4px; font-size: 8pt; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 14px; }
  .stat { border: 1px solid var(--line); padding: 7px 9px; }
  .stat b { display: block; font-size: 16pt; font-variant-numeric: tabular-nums; }
  .stat span { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.4px; color: var(--muted); }
  .ev { font-size: 8.5pt; border-bottom: 1px solid var(--line); padding: 5px 0; }
  .ev .chain { color: var(--accent); font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 7.5pt; }
  .ev .why { color: #333; }
  footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 8pt; }
  .charges { margin: 2px 0 0; padding-left: 14px; }
  .charges li { font-size: 9pt; }
  @media print {
    body { padding: 0; }
    h2 { break-after: avoid; }
    tr, .ev { break-inside: avoid; }
    .page-break { break-before: page; }
  }
</style>
</head><body>

<h1>Daily Inmate Intelligence Report</h1>
<p class="sub">${escape(summary.facilities.join(', ') || 'no facility')} &middot; roster ${escape(summary.reportDate)}${summary.isToday ? ' (today)' : ''}</p>
<p class="sub">Generated ${escape(meta.generatedAt.slice(0, 16).replace('T', ' '))} UTC${meta.reportId ? ` &middot; report ${escape(meta.reportId)}` : ''}</p>

<h2>1 &middot; Import Summary</h2>
${summary.files.length === 0 ? '<p class="empty">No import ran on this date. Every section below is empty for that reason, not because the jail was quiet.</p>' : `
<table>
  <tr><th>Roster date</th><td>${escape(summary.reportDate)}</td>
      <th>Operator</th><td>${orUnknown(summary.operators.join(', '))}</td></tr>
  <tr><th>Files processed</th><td>${summary.files.length}</td>
      <th>Processing time</th><td>${escape(minutes(summary.processingTimeMs))}</td></tr>
</table>
<table>
  <thead><tr><th>File</th><th>Type</th><th>Parser profile</th><th>Roster date</th><th>Status</th><th class="num">Duration</th><th>SHA-256</th></tr></thead>
  <tbody>${summary.files.map((f) => `
    <tr><td>${escape(f.filename)}</td><td>${escape(f.kind)}</td>
        <td>${orUnknown(f.parserProfile)}</td><td>${orUnknown(f.rosterDate)}</td>
        <td>${escape(f.status)}</td>
        <td class="num">${f.durationMs === null ? '—' : escape(minutes(f.durationMs))}</td>
        <td class="chain">${escape(f.sha256.slice(0, 16))}…</td></tr>`).join('')}
  </tbody>
</table>`}

<h2>2 &middot; Newly Booked Inmates <span class="pill">${report.newlyBooked.length}</span></h2>
<p class="sub">People with no prior record in this repository. Recorded at import time and never recalculated, so this list does not change if an older roster is imported later.</p>
${report.newlyBooked.length === 0 ? '<p class="empty">None.</p>' : `
<table>
  <thead><tr>
    <th>Name</th><th>DOB</th><th>Booking no.</th><th>Booked</th>
    <th>Facility / housing</th><th class="num">Bail</th><th>Charges</th><th class="num">Conf.</th>
  </tr></thead>
  <tbody>${report.newlyBooked.map((r) => `
    <tr>
      <td><strong>${escape(r.name)}</strong>${r.onWatchList ? ' <span class="watch">WATCH</span>' : ''}</td>
      <td>${orUnknown(r.dateOfBirth)}</td>
      <td>${orUnknown(r.bookingNumber)}</td>
      <td>${orUnknown(r.bookingDate?.slice(0, 10))}</td>
      <td>${escape(r.facility)}${r.housing ? `<br><span class="unknown">${escape(r.housing)}</span>` : ''}</td>
      <td class="num">${orUnknown(r.bail)}</td>
      <td>${r.charges.length === 0 ? '<span class="unknown">none published</span>' : `<ul class="charges">${
        r.charges.map((c) => `<li>${escape(c.statute ?? '—')}${c.description ? ` — ${escape(c.description)}` : ''}${
          c.severity !== 'unknown' ? ` <span class="unknown">(${escape(c.severity)})</span>` : ''}</li>`).join('')}</ul>`}
        ${r.courtDate ? `<div class="unknown">Court ${escape(r.courtDate)}${r.courtName ? ` · ${escape(r.courtName)}` : ''}</div>` : ''}</td>
      <td class="num">${r.confidence}%${r.matchTier ? `<br><span class="unknown">${escape(r.matchTier)}</span>` : ''}</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<h2>3 &middot; Returning Inmates <span class="pill">${report.returning.length}</span></h2>
<p class="sub">Matched to someone already in the repository who has an earlier booking. A roster restating today's booking is not a return and is not listed here.</p>
${report.returning.length === 0 ? '<p class="empty">None.</p>' : `
<table>
  <thead><tr>
    <th>Name</th><th>Booking no.</th><th>Booked</th><th class="num">Prior</th>
    <th>Previous bookings</th><th>Known aliases</th><th class="num">Bail</th><th class="num">Conf.</th>
  </tr></thead>
  <tbody>${report.returning.map((r) => `
    <tr>
      <td><strong>${escape(r.name)}</strong>${r.onWatchList ? ' <span class="watch">WATCH</span>' : ''}
          ${r.dateOfBirth ? `<br><span class="unknown">DOB ${escape(r.dateOfBirth)}</span>` : ''}</td>
      <td>${orUnknown(r.bookingNumber)}</td>
      <td>${orUnknown(r.bookingDate?.slice(0, 10))}</td>
      <td class="num">${r.priorBookingCount}</td>
      <td>${r.priorBookingDates.slice(0, 6).map(escape).join(', ')}${
        r.priorBookingDates.length > 6 ? ` <span class="unknown">and ${r.priorBookingDates.length - 6} earlier</span>` : ''}
        ${r.lastBookingBefore ? `<br><span class="unknown">most recent before this: ${escape(r.lastBookingBefore)}</span>` : ''}</td>
      <td>${r.aliases.length === 0 ? '<span class="unknown">none</span>' : escape(r.aliases.join(' · '))}</td>
      <td class="num">${orUnknown(r.bail)}</td>
      <td class="num">${r.confidence}%${r.matchTier ? `<br><span class="unknown">${escape(r.matchTier)}</span>` : ''}</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<h2>4 &middot; Watch List Matches <span class="pill">${report.watchListMatches.length}</span></h2>
${report.watchListMatches.length === 0 ? '<p class="empty">No person on a watch list appeared in this import.</p>' : `
<table>
  <thead><tr><th>Name</th><th>Match</th><th>Priority</th><th>Why watched</th><th>Notification</th><th>Booking</th><th class="num">Conf.</th></tr></thead>
  <tbody>${report.watchListMatches.map((m) => `
    <tr>
      <td><strong>${escape(m.name)}</strong></td>
      <td>${escape(m.matchType.replace(/_/g, ' '))}</td>
      <td>${escape(m.priority)}</td>
      <td>${escape(m.watchListReason)}</td>
      <td>${orUnknown(m.notificationReason)}</td>
      <td>${orUnknown(m.bookingNumber)}${m.housing ? `<br><span class="unknown">${escape(m.housing)}</span>` : ''}</td>
      <td class="num">${m.confidence}%</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<h2>5 &middot; Significant Changes <span class="pill">${report.significantChanges.length}</span></h2>
<p class="sub">Differences between this roster and the last one, for the fields that matter operationally: bail, housing, custody and charges.</p>
${report.significantChanges.length === 0 ? '<p class="empty">Nothing material changed.</p>' : `
<table>
  <thead><tr><th>Name</th><th>Booking no.</th><th>Change</th><th>From</th><th>To</th><th>Detected</th></tr></thead>
  <tbody>${report.significantChanges.map((c) => `
    <tr>
      <td>${escape(c.name)}</td>
      <td>${orUnknown(c.bookingNumber)}</td>
      <td>${escape(c.changeType.replace(/_/g, ' '))}${c.field ? `<br><span class="unknown">${escape(c.field)}</span>` : ''}</td>
      <td>${orUnknown(c.previousValue)}</td>
      <td>${orUnknown(c.newValue)}</td>
      <td>${escape(c.detectedAt.slice(0, 10))}</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<h2>6 &middot; Human Review Queue <span class="pill">${report.reviewQueue.length}</span></h2>
<p class="sub">Records the resolver would not decide. <strong>Until each is decided its booking does not exist in the repository</strong> — an outstanding item is a missing booking, not a pending note.</p>
${report.reviewQueue.length === 0 ? '<p class="empty">Nothing awaiting review.</p>' : `
<table>
  <thead><tr><th>From the roster</th><th>Possible match</th><th class="num">Conf.</th><th>Why held</th><th>Priority</th><th>Assigned</th><th>Raised</th><th>Source</th></tr></thead>
  <tbody>${report.reviewQueue.map((r) => `
    <tr>
      <td><strong>${escape(r.subjectName)}</strong></td>
      <td>${orUnknown(r.candidateName)}</td>
      <td class="num">${r.confidence === null ? '—' : `${r.confidence}%`}${r.tier ? `<br><span class="unknown">${escape(r.tier)}</span>` : ''}</td>
      <td>${escape(r.reason)}${r.evidenceRequested ? `<br><span class="unknown">Evidence requested: ${escape(r.evidenceRequested)}</span>` : ''}</td>
      <td>${escape(r.priority)}</td>
      <td>${orUnknown(r.assignedTo)}</td>
      <td>${escape(r.raisedAt.slice(0, 10))}</td>
      <td class="chain">${escape(r.sourceFile)}:${r.sourceRow}</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<h2>7 &middot; Statistics</h2>
<div class="stats">
  <div class="stat"><b>${statistics.rowsParsed}</b><span>Rows parsed</span></div>
  <div class="stat"><b>${statistics.newInmates}</b><span>New</span></div>
  <div class="stat"><b>${statistics.returningInmates}</b><span>Returning</span></div>
  <div class="stat"><b>${statistics.matched}</b><span>Matched</span></div>
  <div class="stat"><b>${statistics.duplicates}</b><span>Restated</span></div>
  <div class="stat"><b>${statistics.conflicts}</b><span>Conflicts</span></div>
  <div class="stat"><b>${statistics.reviewsOutstanding}</b><span>Reviews open</span></div>
  <div class="stat"><b>${statistics.watchListHits}</b><span>Watch hits</span></div>
</div>
<table>
  <tr><th>Rows that could not be read</th><td class="num">${statistics.rowsFailed}</td>
      <th>Conflicts still unresolved</th><td class="num">${statistics.unresolvedConflicts}</td></tr>
  <tr><th>Reviews raised by this import</th><td class="num">${statistics.reviewsRaised}</td>
      <th>Bookings the jail stopped listing</th><td class="num">${statistics.departures}</td></tr>
  <tr><th>Material changes detected</th><td class="num">${statistics.significantChanges}</td>
      <th>&nbsp;</th><td>&nbsp;</td></tr>
</table>
${statistics.departures > 0 ? `<p class="sub">A booking the jail stopped listing is a departure from the roster, not a recorded release. No release date was published for ${statistics.departures} of them.</p>` : ''}

<h2 class="page-break">8 &middot; Evidence Appendix</h2>
<p class="sub">Every claim above traces to a document, a page, a row, an observation, and the reasoning applied to it. ${
  report.evidence.length >= 400 ? 'Showing the first 400 observations; the remainder are in the repository under the batch ids listed in section 1.' : ''}</p>
${report.evidence.length === 0 ? '<p class="empty">No observations recorded.</p>' : report.evidence.map((e) => `
<div class="ev">
  <div><strong>${escape(e.claim)}</strong></div>
  <div class="chain">${escape(e.document)} (${escape(e.sourceType)})${
    e.page !== null ? ` → page ${e.page}` : ''}${
    e.row !== null ? ` → row ${e.row}` : ''} → observation ${escape(e.observationId.slice(0, 8))}…${
    e.documentSha256 ? ` · sha256 ${escape(e.documentSha256.slice(0, 12))}…` : ''}${
    e.parserProfile ? ` · ${escape(e.parserProfile)}` : ''}</div>
  <div class="why">${escape(e.reasoning)}${
    e.engine ? ` <span class="unknown">— ${escape(e.engine)} ${escape(e.engineVersion ?? '')}</span>` : ''}</div>
</div>`).join('')}

<footer>
  CourtAccess New Inmate Intelligence &middot; generated for ${escape(meta.generatedBy)} at ${escape(meta.generatedAt)}<br>
  Every conclusion in this report is derived from the documents listed in section 1 and traceable through section 8.
  Charges shown are as published by the facility and change as cases move.
</footer>
</body></html>`;
}

/**
 * Generate and persist.
 *
 * The rendered HTML is stored verbatim, so the document printed this morning can be
 * retrieved unchanged after the underlying data has been corrected. A report that
 * silently updates is not a record of what was believed when it was printed.
 */
export async function generateDailyReport(
  params: DailyReportParameters,
  generatedById: string,
): Promise<{ reportId: string; html: string; report: DailyReport }> {
  const report = await buildDailyReport(params);
  const generatedAt = new Date().toISOString();

  const created = await prisma.inmateIntelligenceReport.create({
    data: {
      reportType: 'daily_intelligence',
      parameters: { ...params, resolvedDate: report.summary.reportDate } as unknown as object,
      rowCount: report.newlyBooked.length + report.returning.length,
      generatedById,
    },
    select: { reportId: true },
  });

  const html = renderDailyReport(report, {
    generatedAt,
    generatedBy: generatedById,
    reportId: created.reportId,
  });

  await prisma.inmateIntelligenceReport.update({
    where: { reportId: created.reportId },
    data: { renderedHtml: html },
  });

  return { reportId: created.reportId, html, report };
}
