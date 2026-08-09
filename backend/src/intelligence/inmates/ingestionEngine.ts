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
import { collapseWithinBatch, bookingContentHash } from './deduplication.js';
import { resolveIdentity } from './identityResolution.js';
import { normalizeRecord } from './normalization.js';
import { getColumnMap } from './parsers/columnMaps.js';
import { parseCsvRoster } from './parsers/csvParser.js';
import { parsePdfRoster } from './parsers/pdfParser.js';
import type {
  IngestionCounts, IngestionIssue, IngestionOutcome, IngestionRequest,
  InmateCandidate, NormalizedRecord, ParseResult, ResolutionPreview, SourceDocument,
} from './types.js';

/** Candidate lookup is an index probe on (last, dob); this bounds a pathological
 *  surname so resolution cannot go quadratic on "SMITH". */
const MAX_CANDIDATES = 200;

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
  // One transaction per batch, so a failure leaves no half-imported roster.
  const batch = await prisma.inmateIngestionBatch.create({
    data: {
      sourceType: parsed.stats.ocrUsed ? 'pdf_ocr' : sourceType,
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

  const document: SourceDocument = {
    batchId: batch.batchId,
    filename: basename(request.filePath),
    sha256: sourceSha256,
    sourceType,
    rosterDate: request.rosterDate,
  };

  try {
    for (const entry of collapsed) {
      const result = await resolveOne(entry.record, entry.lineNumber, { ...document, lineNumber: entry.lineNumber });
      tally(counts, result.outcome);
      await persist(batch.batchId, entry.record, entry.lineNumber, result, parsed.records);
    }

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

/** Load candidates by surname and ask the resolver. */
async function resolveOne(record: NormalizedRecord, lineNumber: number, document: SourceDocument) {
  const rows = await prisma.inmate.findMany({
    where: { canonicalLast: record.last, mergedIntoId: null },
    select: {
      inmateId: true, canonicalFirst: true, canonicalLast: true, canonicalMiddle: true,
      dateOfBirth: true, sex: true, race: true, bookingCount: true,
    },
    take: MAX_CANDIDATES,
  });

  const candidates: InmateCandidate[] = rows;
  const incomingBookingKey = bookingContentHash(record);

  const existing = await prisma.inmateBooking.findUnique({
    where: { contentHash: incomingBookingKey },
    select: { contentHash: true },
  });

  return resolveIdentity({
    record,
    candidates,
    existingBookingKeys: new Set(existing ? [existing.contentHash] : []),
    incomingBookingKey,
    sourceDocument: { ...document, lineNumber },
  });
}

/** Write the record, and the person and booking when the decision allows it. */
async function persist(
  batchId: string,
  record: NormalizedRecord,
  lineNumber: number,
  result: Awaited<ReturnType<typeof resolveOne>>,
  rawRows: { __lineNumber?: string }[],
): Promise<void> {
  const raw = rawRows.find((r) => Number(r.__lineNumber ?? -1) === lineNumber) ?? {};

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
      },
    });

    // A duplicate booking is already held, and a row needing review must not
    // change the repository before a person has looked at it.
    if (result.outcome === 'duplicate' || result.outcome === 'needs_review' || result.outcome === 'failed') return;

    let inmateId = result.inmateId;
    let isFirstAppearance = false;

    if (result.outcome === 'new_inmate') {
      const created = await tx.inmate.create({
        data: {
          canonicalFirst: record.first,
          canonicalLast: record.last,
          canonicalMiddle: record.middle ?? null,
          suffix: record.suffix ?? null,
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

    // Every spelling ever seen, so a search by any of them finds the person.
    //
    // Deliberately findFirst-then-write rather than upsert. The natural key
    // includes middle name and date of birth, both nullable, and in PostgreSQL
    // two NULLs are distinct — so a unique constraint over them never fires and
    // an upsert would insert a new alias row on every roster for anyone missing
    // a middle name. The constraint stays for the fully-populated case; this is
    // what makes the partially-populated case correct.
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
      await tx.inmateAlias.create({
        data: {
          inmateId,
          last: record.last,
          first: record.first,
          middle: record.middle ?? null,
          suffix: record.suffix ?? null,
          dateOfBirth: aliasDob,
          sourceBatchId: batchId,
        },
      });
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
  });
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
