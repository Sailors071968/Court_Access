// ============================================================================
// Ingestion engine.
//
// The whole of ingestion is this one function. It takes a request and returns an
// outcome, and it knows nothing about how it was invoked.
//
//   Ingestion engine  ← the only place ingestion logic lives
//         ▲
//         ├── manual run from the administrative dashboard
//         ├── CLI
//         ├── systemd timer  (calls the CLI)
//         ├── cron           (calls the CLI)
//         ├── a future queue worker
//         └── a future scheduled job
//
// Each of those is an adapter that builds an IngestionRequest and calls
// `runIngestion`. None of them may contain parsing, normalization, resolution or
// persistence, and the engine may not branch on `trigger` — it is recorded on the
// batch so the origin is known, not so behaviour can differ by caller. Keeping
// that boundary is what leaves the scheduling decision open: adopting a queue
// later is a new adapter, not a rewrite.
// ============================================================================

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import prisma from '../../lib/prisma.js';
import { generateCandidates } from './candidateGeneration.js';
import { collapseWithinBatch, bookingContentHash } from './deduplication.js';
import { deriveNameKeys, NAME_KEY_VERSION } from './nameKeys.js';
import {
  enqueueForReview, recordBookingChanges, recordDepartures, recordIdentityMatch,
  recordObservation, recordWatchListMatches, reconcileBatch,
} from './evidenceRecording.js';
import { resolveIdentity } from './identityResolution.js';
import { normalizeRecord } from './normalization.js';
import { getColumnMap } from './parsers/columnMaps.js';
import { parseCsvRoster } from './parsers/csvParser.js';
import { parsePdfRoster } from './parsers/pdfParser.js';
import type {
  IngestionCounts, IngestionIssue, IngestionOutcome, IngestionRequest,
  NormalizedRecord, ParseResult, ResolutionPreview,
  ResolutionResult, SourceDocument,
} from './types.js';

// Candidate limits now live in candidateGeneration.ts, per blocking key, so a
// broad key cannot crowd out a precise one.

export async function runIngestion(request: IngestionRequest): Promise<IngestionOutcome> {
  const startedAt = Date.now();
  const issues: IngestionIssue[] = [];

  const map = getColumnMap(request.facility);
  if (!map) {
    return failed(request, startedAt, `No column map is registered for facility "${request.facility}".`, issues);
  }

  let fileStat;
  try {
    fileStat = await stat(request.filePath);
  } catch {
    return failed(request, startedAt, `${request.filePath} cannot be read.`, issues);
  }
  if (!fileStat.isFile()) {
    return failed(request, startedAt, `${request.filePath} is not a file.`, issues);
  }

  const sourceSha256 = await hashFile(request.filePath);
  const extension = extname(request.filePath).toLowerCase();

  // The same file already ingested is a no-op, not a second import. Checked
  // before parsing so re-running a timer costs nothing.
  if (!request.dryRun) {
    const previous = await prisma.inmateIngestionBatch.findFirst({
      where: { sourceSha256, status: 'completed' },
      select: { batchId: true, startedAt: true },
    });
    if (previous) {
      return {
        batchId: previous.batchId,
        dryRun: false,
        status: 'completed',
        sourceType: extension === '.pdf' ? 'pdf_text' : 'csv',
        sourceSha256,
        counts: emptyCounts(),
        issues: [{
          severity: 'info',
          code: 'file_already_ingested',
          message: `This exact file was ingested on ${previous.startedAt.toISOString()} as batch ${previous.batchId}. Nothing was written.`,
        }],
        durationMs: Date.now() - startedAt,
      };
    }
  }

  // --- Parse -------------------------------------------------------------
  let parsed: ParseResult;
  const sourceType = extension === '.pdf' ? 'pdf_text' : 'csv';
  try {
    parsed = extension === '.pdf'
      ? await parsePdfRoster(request.filePath, map)
      : await parseCsvRoster(request.filePath, map);
  } catch (err) {
    return failed(request, startedAt, `Parsing failed: ${err instanceof Error ? err.message : String(err)}`, issues);
  }
  issues.push(...parsed.issues);

  if (parsed.issues.some((i) => i.severity === 'error')) {
    return failed(request, startedAt, 'The file could not be parsed. See the issues.', issues,
      sourceSha256, parsed.stats.ocrUsed ? 'pdf_ocr' : sourceType);
  }

  // --- Normalize ---------------------------------------------------------
  const normalized: { lineNumber: number; record: NormalizedRecord }[] = [];
  for (const row of parsed.records) {
    const lineNumber = Number(row.__lineNumber ?? 0);
    const outcome = normalizeRecord(row, map);
    for (const issue of outcome.issues) issues.push({ ...issue, lineNumber });
    if (outcome.record) normalized.push({ lineNumber, record: outcome.record });
  }

  // Rosters repeat a person once per charge; those rows are one booking.
  const collapsed = collapseWithinBatch(normalized);
  for (const entry of collapsed) {
    if (entry.mergedLines.length > 0) {
      issues.push({
        severity: 'info',
        code: 'rows_collapsed',
        lineNumber: entry.lineNumber,
        message: `Line ${entry.lineNumber} absorbed ${entry.mergedLines.length} further row(s) for the same booking (${entry.mergedLines.join(', ')}).`,
      });
    }
  }

  const counts = emptyCounts();
  counts.total = collapsed.length;
  counts.failed = normalized.length === 0 && parsed.records.length > 0 ? parsed.records.length : 0;

  // --- Dry run: resolve against the live repository, write nothing --------
  if (request.dryRun) {
    const preview: ResolutionPreview[] = [];
    const document: SourceDocument = {
      batchId: '(dry-run)',
      filename: basename(request.filePath),
      sha256: sourceSha256,
      sourceType,
      rosterDate: request.rosterDate,
    };

    for (const entry of collapsed) {
      const result = await resolveOne(entry.record, entry.lineNumber, document);
      tally(counts, result.outcome);
      preview.push({
        lineNumber: entry.lineNumber,
        name: `${entry.record.last}, ${entry.record.first}`,
        dateOfBirth: entry.record.dateOfBirth,
        outcome: result.outcome,
        confidence: result.evidence.confidence,
        tier: result.evidence.tier,
        humanReviewRequired: result.evidence.humanReviewRequired,
        reviewRationale: result.evidence.reviewRationale,
      });
    }

    return {
      batchId: null, dryRun: true, status: 'completed', sourceType, sourceSha256,
      counts, issues, preview, extractionStats: parsed.stats,
      durationMs: Date.now() - startedAt,
    };
  }

  // --- Write -------------------------------------------------------------
  // The document is recorded before the run that processes it, and separately:
  // the same file may be processed more than once, and a resumed import has to
  // know it is the same document.
  const resolvedSourceType = parsed.stats.ocrUsed ? 'pdf_ocr' : sourceType;
  const document = await prisma.inmateSourceDocument.upsert({
    where: { sha256: sourceSha256 },
    create: {
      sha256: sourceSha256,
      filename: basename(request.filePath),
      byteSize: BigInt(fileStat.size),
      mediaType: extension === '.pdf' ? 'pdf' : 'csv',
      facilityCode: request.facility,
      rosterDate: request.rosterDate ? new Date(request.rosterDate) : null,
      storagePath: request.filePath,
      pageCount: parsed.stats.pageCount ?? null,
      pageStats: (parsed.stats as unknown as object) ?? null,
      receivedById: request.userId ?? null,
    },
    update: { pageStats: (parsed.stats as unknown as object) ?? null },
    select: { documentId: true },
  });

  // One transaction per row, so a failure leaves no half-imported booking.
  const batch = await prisma.inmateIngestionBatch.create({
    data: {
      sourceType: resolvedSourceType,
      documentId: document.documentId,
      rosterKind: request.rosterKind ?? 'full_population',
      sourceFilename: basename(request.filePath),
      sourceSha256,
      facility: request.facility,
      rosterDate: request.rosterDate ? new Date(request.rosterDate) : null,
      status: 'resolving',
      recordsTotal: collapsed.length,
      extractionStats: parsed.stats as unknown as object,
      triggeredBy: request.trigger,
      ingestedById: request.userId ?? null,
    },
  });

  const sourceDoc: SourceDocument = {
    batchId: batch.batchId,
    filename: basename(request.filePath),
    sha256: sourceSha256,
    sourceType: resolvedSourceType,
    rosterDate: request.rosterDate,
  };

  const observedBookingIds = new Set<string>();
  const bookingsByInmate = new Map<string, string>();
  const rosterDate = request.rosterDate ? new Date(request.rosterDate) : null;

  try {
    for (const entry of collapsed) {
      const result = await resolveOne(entry.record, entry.lineNumber, { ...sourceDoc, lineNumber: entry.lineNumber });
      tally(counts, result.outcome);
      const written = await persist({
        batchId: batch.batchId,
        documentId: document.documentId,
        sourceType: resolvedSourceType,
        rosterDate,
        record: entry.record,
        lineNumber: entry.lineNumber,
        result,
        rawRows: parsed.records,
      });
      if (written.bookingId) observedBookingIds.add(written.bookingId);
      if (written.inmateId && written.bookingId) bookingsByInmate.set(written.inmateId, written.bookingId);
      // Resumability: the last line committed, so a large import can restart
      // where it stopped instead of from the beginning.
      await prisma.inmateIngestionBatch.update({
        where: { batchId: batch.batchId },
        data: { resumeCursor: entry.lineNumber },
      });
    }

    // Cross-source comparison, departures and watch-list hits are batch-level:
    // a conflict needs both sides, and the other source may have been ingested
    // hours earlier.
    const conflictCount = await reconcileBatch(prisma, {
      batchId: batch.batchId,
      bookingIds: [...observedBookingIds],
      rosterDate,
    });
    const departureCount = await recordDepartures(prisma, {
      batchId: batch.batchId,
      facility: request.facility,
      observedBookingIds,
      rosterDate,
      rosterIsFullPopulation: (request.rosterKind ?? 'full_population') === 'full_population',
    });
    const watchListCount = await recordWatchListMatches(prisma, {
      batchId: batch.batchId,
      bookingsByInmate,
      rosterDate,
    });
    counts.conflicts = conflictCount;
    counts.departures = departureCount;
    counts.watchListHits = watchListCount;

    await prisma.inmateIngestionBatch.update({
      where: { batchId: batch.batchId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        recordsNew: counts.newInmates,
        recordsMatched: counts.matched,
        recordsDuplicate: counts.duplicates,
        recordsForReview: counts.needsReview,
        recordsFailed: counts.failed,
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.inmateIngestionBatch.update({
      where: { batchId: batch.batchId },
      data: { status: 'failed', finishedAt: new Date(), failureReason: reason },
    });
    issues.push({ severity: 'error', code: 'resolution_failed', message: reason });
    return {
      batchId: batch.batchId, dryRun: false, status: 'failed', sourceType, sourceSha256,
      counts, issues, failureReason: reason, durationMs: Date.now() - startedAt,
    };
  }

  if (issues.length > 0) {
    await prisma.inmateIngestionIssue.createMany({
      data: issues.map((i) => ({
        batchId: batch.batchId,
        lineNumber: i.lineNumber ?? null,
        severity: i.severity,
        code: i.code,
        message: i.message,
      })),
    });
  }

  return {
    batchId: batch.batchId, dryRun: false, status: 'completed', sourceType, sourceSha256,
    counts, issues, extractionStats: parsed.stats, durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------

/**
 * Phase 1 then phases 2 and 3: find candidates by every blocking key, then ask
 * the resolver to rank and the policy to decide.
 *
 * The candidate query used to be a single exact-surname lookup here. It is now a
 * module of its own, because "who could this be" and "which of them is it" are
 * different questions with opposite goals — recall against precision.
 */
async function resolveOne(record: NormalizedRecord, lineNumber: number, document: SourceDocument) {
  const generated = await generateCandidates(prisma, record);
  const incomingBookingKey = bookingContentHash(record);

  const existing = await prisma.inmateBooking.findUnique({
    where: { contentHash: incomingBookingKey },
    select: { contentHash: true },
  });

  return resolveIdentity({
    record,
    candidates: generated.candidates,
    existingBookingKeys: new Set(existing ? [existing.contentHash] : []),
    incomingBookingKey,
    sourceDocument: { ...document, lineNumber },
    candidateSetTruncated: generated.truncated,
  });
}

/**
 * Write the record, and the person and booking when the decision allows it.
 *
 * Returns what it wrote, because the batch-level passes — cross-source
 * reconciliation, departures, watch-list hits — need to know which bookings this
 * run actually observed.
 */
async function persist(args: {
  batchId: string;
  documentId: string;
  sourceType: string;
  rosterDate: Date | null;
  record: NormalizedRecord;
  lineNumber: number;
  result: ResolutionResult;
  rawRows: { __lineNumber?: string }[];
}): Promise<{ inmateId: string | null; bookingId: string | null }> {
  const { batchId, record, lineNumber, result } = args;
  const raw = args.rawRows.find((r) => Number(r.__lineNumber ?? -1) === lineNumber) ?? {};
  let writtenInmateId: string | null = null;
  let writtenBookingId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const ingestionRecord = await tx.inmateIngestionRecord.create({
      data: {
        batchId,
        lineNumber,
        rawPayload: raw as unknown as object,
        normalizedPayload: serializable(record) as unknown as object,
        resolution: result.outcome,
        resolvedInmateId: result.inmateId ?? null,
        confidence: result.evidence.confidence,
        matchTier: result.evidence.tier,
        matchEvidence: result.evidence as unknown as object,
        sourcePage: result.evidence.sourceDocuments[0]?.lineNumber ? null : null,
        extractionMethod: args.sourceType === 'csv' ? 'csv'
          : args.sourceType === 'pdf_ocr' ? 'ocr' : 'text_layer',
        // OCR is a transcription of an image and can misread characters, so the
        // extraction is trusted less than a machine-written export. This is
        // separate from match confidence: a perfectly confident match on a badly
        // transcribed row is still a badly transcribed row.
        extractionConfidence: args.sourceType === 'pdf_ocr' ? 70 : 100,
      },
    });

    // The confidence analysis, as a queryable row as well as JSON above.
    const matchId = await recordIdentityMatch(tx, ingestionRecord.recordId, result);

    // A row needing review must not change the repository before a person has
    // looked at it, and a duplicate is already held.
    if (result.outcome === 'needs_review') {
      await enqueueForReview(tx, { importRecordId: ingestionRecord.recordId, matchId, batchId, result });
      return;
    }
    if (result.outcome === 'duplicate') {
      // Still an observation: the same booking seen again is evidence that the
      // jail is still listing it, which is how a departure is distinguished from
      // a gap in the sources.
      const existing = await tx.inmateBooking.findUnique({
        where: { contentHash: bookingContentHash(record) },
        select: { bookingId: true, inmateId: true },
      });
      if (existing) {
        const { observationId, attributes } = await recordObservation(tx, {
          bookingId: existing.bookingId,
          batchId,
          documentId: args.documentId,
          sourceType: args.sourceType,
          sourcePage: null,
          sourceRow: lineNumber,
          rosterDate: args.rosterDate,
          record,
        });
        await recordBookingChanges(tx, {
          batchId,
          inmateId: existing.inmateId,
          bookingId: existing.bookingId,
          observationId,
          rosterDate: args.rosterDate,
          attributes,
          isNewBooking: false,
        });
        await tx.inmateBooking.update({
          where: { bookingId: existing.bookingId },
          data: { lastObservedAt: new Date() },
        });
        writtenInmateId = existing.inmateId;
        writtenBookingId = existing.bookingId;
      }
      return;
    }
    if (result.outcome === 'failed') return;

    let inmateId = result.inmateId;
    let isFirstAppearance = false;

    if (result.outcome === 'new_inmate') {
      const keys = deriveNameKeys(record.last);
      const created = await tx.inmate.create({
        data: {
          canonicalFirst: record.first,
          canonicalLast: record.last,
          canonicalMiddle: record.middle ?? null,
          suffix: record.suffix ?? null,
          phoneticLast: keys.phonetic,
          collapsedLast: keys.collapsed,
          nameKeyVersion: NAME_KEY_VERSION,
          dateOfBirth: record.dateOfBirth ? new Date(record.dateOfBirth) : null,
          sex: record.sex ?? null,
          race: record.race ?? null,
          identityConfidence: result.evidence.confidence,
          firstSeenAt: new Date(record.bookedAt),
          lastSeenAt: new Date(record.bookedAt),
        },
      });
      inmateId = created.inmateId;
      isFirstAppearance = true;
    } else if (inmateId) {
      // "Newly discovered" is a property of ingestion, recorded now. Recomputing
      // it later from a moving baseline would change historical reports whenever
      // older data was backfilled.
      const priorBookings = await tx.inmateBooking.count({ where: { inmateId } });
      isFirstAppearance = priorBookings === 0;
    }

    if (!inmateId) return;

    const booking = await tx.inmateBooking.create({
      data: {
        inmateId,
        facility: record.facility,
        externalBookingId: record.externalBookingId ?? null,
        bookedAt: new Date(record.bookedAt),
        releasedAt: record.releasedAt ? new Date(record.releasedAt) : null,
        arrestingAgency: record.arrestingAgency ?? null,
        bailAmountCents: record.bailAmountCents ?? null,
        housingLocation: record.housingLocation ?? null,
        contentHash: bookingContentHash(record),
        sourceBatchId: batchId,
        sourceRecordId: ingestionRecord.recordId,
        isFirstAppearance,
        custodyStatus: record.releasedAt ? 'released' : 'in_custody',
        lastObservedAt: new Date(),
        charges: {
          create: record.charges.map((c) => ({
            statuteCode: c.statuteCode ?? null,
            statuteSection: c.statuteSection ?? null,
            description: c.description ?? null,
            severity: c.severity,
            counts: c.counts,
            bailAmountCents: c.bailAmountCents ?? null,
            rawText: c.rawText,
          })),
        },
      },
    });

    await tx.inmateIngestionRecord.update({
      where: { recordId: ingestionRecord.recordId },
      data: { bookingId: booking.bookingId },
    });

    const { observationId, attributes } = await recordObservation(tx, {
      bookingId: booking.bookingId,
      batchId,
      documentId: args.documentId,
      sourceType: args.sourceType,
      sourcePage: null,
      sourceRow: lineNumber,
      rosterDate: args.rosterDate,
      record,
    });

    await recordBookingChanges(tx, {
      batchId,
      inmateId,
      bookingId: booking.bookingId,
      observationId,
      rosterDate: args.rosterDate,
      attributes,
      isNewBooking: true,
    });

    // Every spelling ever seen, so a search by any of them finds the person.
    //
    // Deliberately findFirst-then-write rather than upsert. The natural key
    // includes middle name and date of birth, both nullable, and in PostgreSQL
    // two NULLs are distinct — so a unique constraint over them never fires and
    // an upsert would insert a new alias row on every roster for anyone missing
    // a middle name.
    const aliasDob = record.dateOfBirth ? new Date(record.dateOfBirth) : null;
    const existingAlias = await tx.inmateAlias.findFirst({
      where: {
        inmateId,
        last: record.last,
        first: record.first,
        middle: record.middle ?? null,
        dateOfBirth: aliasDob,
      },
      select: { aliasId: true },
    });

    if (existingAlias) {
      await tx.inmateAlias.update({
        where: { aliasId: existingAlias.aliasId },
        data: { occurrences: { increment: 1 } },
      });
    } else {
      const aliasKeys = deriveNameKeys(record.last);
      await tx.inmateAlias.create({
        data: {
          inmateId,
          last: record.last,
          first: record.first,
          middle: record.middle ?? null,
          suffix: record.suffix ?? null,
          dateOfBirth: aliasDob,
          sourceBatchId: batchId,
          phoneticLast: aliasKeys.phonetic,
          collapsedLast: aliasKeys.collapsed,
          nameKeyVersion: NAME_KEY_VERSION,
        },
      });
    }

    // The facility's own person identifier, if the roster supplies one. The
    // strongest identity evidence available on the next roster, so it is recorded
    // whenever seen — including for a person first matched by name.
    if (record.externalPersonId) {
      const existingId = await tx.inmateExternalId.findUnique({
        where: { facility_externalId: { facility: record.facility, externalId: record.externalPersonId } },
        select: { externalIdRow: true, inmateId: true },
      });
      if (!existingId) {
        await tx.inmateExternalId.create({
          data: {
            inmateId,
            facility: record.facility,
            externalId: record.externalPersonId,
            firstSeenBatchId: batchId,
          },
        });
      } else if (existingId.inmateId === inmateId) {
        await tx.inmateExternalId.update({
          where: { externalIdRow: existingId.externalIdRow },
          data: { occurrences: { increment: 1 } },
        });
      }
      // An identifier already bound to a *different* person is left alone: it is
      // a data problem, and silently rebinding it would move identity evidence
      // from one person to another without a record.
    }

    await tx.inmate.update({
      where: { inmateId },
      data: {
        bookingCount: { increment: 1 },
        lastSeenAt: new Date(record.bookedAt),
        // A weaker match lowers confidence in the identity; a stronger one does
        // not raise it, because the weak evidence still happened.
        identityConfidence: Math.min(result.evidence.confidence, 100),
      },
    });

    writtenInmateId = inmateId;
    writtenBookingId = booking.bookingId;
  });

  return { inmateId: writtenInmateId, bookingId: writtenBookingId };
}

// ---------------------------------------------------------------------------

function emptyCounts(): IngestionCounts {
  return { total: 0, newInmates: 0, matched: 0, duplicates: 0, needsReview: 0, failed: 0 };
}

function tally(counts: IngestionCounts, outcome: string): void {
  if (outcome === 'new_inmate') counts.newInmates++;
  else if (outcome === 'matched') counts.matched++;
  else if (outcome === 'duplicate') counts.duplicates++;
  else if (outcome === 'needs_review') counts.needsReview++;
  else if (outcome === 'failed') counts.failed++;
}

/** BigInt does not survive JSON, and these payloads are stored as jsonb. */
function serializable(record: NormalizedRecord): unknown {
  return JSON.parse(JSON.stringify(record, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function failed(
  request: IngestionRequest,
  startedAt: number,
  reason: string,
  issues: IngestionIssue[],
  sourceSha256 = '',
  sourceType = 'csv',
): IngestionOutcome {
  return {
    batchId: null,
    dryRun: request.dryRun,
    status: 'failed',
    sourceType,
    sourceSha256,
    counts: emptyCounts(),
    issues: [...issues, { severity: 'error', code: 'ingestion_failed', message: reason }],
    failureReason: reason,
    durationMs: Date.now() - startedAt,
  };
}
