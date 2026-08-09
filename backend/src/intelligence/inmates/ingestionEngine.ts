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
import { attachBooking, createPersonFromRecord } from './bookingWriter.js';
import { generateCandidates } from './candidateGeneration.js';
import { collapseWithinBatch, bookingContentHash } from './deduplication.js';
import {
  enqueueForReview, recordBookingChanges, recordDepartures, recordIdentityMatch,
  recordObservation, reconcileBatch,
} from './evidenceRecording.js';
import { resolveIdentity } from './identityResolution.js';
import { NORMALIZATION_VERSION, normalizeRecord } from './normalization.js';
import { publishBatchIntelligence } from '../platform/publication.js';
import { resolveProfile } from '../platform/parserProfiles.js';
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

  // Progress reporting must never be able to fail an import. Whoever is watching
  // may have closed the page, and a throw from a status writer would abort a
  // roster that was importing correctly.
  const report: NonNullable<IngestionRequest['onStage']> = (stage, detail) => {
    try {
      request.onStage?.(stage, detail);
    } catch {
      // Deliberately swallowed. See above.
    }
  };

  // The versioned profile decides how this document is read, chosen by roster date
  // so a document from before a layout change is parsed with the profile that was
  // correct for it. Falling back to the compiled-in map keeps a facility with no
  // profile working, and the batch records that it happened.
  const profile = await resolveProfile({
    facility: request.facility,
    sourceType: extname(request.filePath).toLowerCase() === '.pdf' ? 'pdf_text' : 'csv',
    rosterDate: request.rosterDate ? new Date(request.rosterDate) : null,
  });
  const map = profile.columnMap ?? getColumnMap(request.facility);
  if (!map) {
    return failed(request, startedAt, `No column map is registered for facility "${request.facility}".`, issues);
  }
  if (profile.fallback) {
    issues.push({
      severity: 'warning',
      code: 'no_parser_profile',
      message: `No versioned parser profile exists for ${request.facility}; the compiled-in column map was used. Provenance for this import is weaker than for one parsed under a profile, and it cannot be reprocessed against a corrected mapping.`,
    });
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
    // Scoped to the facility. Identical bytes are the same roster only for the
    // same facility: a shared regional export, or a mis-filed import being filed
    // correctly, must still import. Matching on the hash alone made the second
    // facility's roster silently write nothing and report the first one's batch.
    const previous = await prisma.inmateIngestionBatch.findFirst({
      where: { sourceSha256, facility: request.facility, status: 'completed' },
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
  report('parsing');
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
  report('normalizing', { total: parsed.records.length });
  const normalized: { lineNumber: number; record: NormalizedRecord }[] = [];
  for (const row of parsed.records) {
    const lineNumber = Number(row.__lineNumber ?? 0);
    const outcome = normalizeRecord(row, map);
    for (const issue of outcome.issues) issues.push({ ...issue, lineNumber });
    if (outcome.record) normalized.push({ lineNumber, record: outcome.record });
  }

  // Rosters repeat a person once per charge; those rows are one booking.
  // --- Validate against the profile that read the document -----------------
  //
  // After parsing and normalizing, before a single row is written. A profile that
  // no longer matches the export produces mostly-empty rows, and an import of empty
  // rows is indistinguishable from a quiet day at the jail — so the document is
  // checked against what the profile promised about it, and a mismatch fails the
  // batch rather than half-filling the repository.
  if (profile.validationRules) {
    const { validateDocument } = await import('./parsers/sacramento.js');

    // How many rows carried a value for each canonical field.
    const coverage: Record<string, number> = {};
    for (const entry of normalized) {
      const record = entry.record as unknown as Record<string, unknown>;
      for (const field of ['last', 'first', 'dateOfBirth', 'externalBookingId',
                           'externalPersonId', 'bookedAt', 'bailAmountCents',
                           'housingLocation', 'courtDate', 'projectedReleaseAt']) {
        if (record[field] !== undefined && record[field] !== null) {
          coverage[field] = (coverage[field] ?? 0) + 1;
        }
      }
      if (entry.record.charges.length > 0) coverage.charges = (coverage.charges ?? 0) + 1;
    }

    const headersFound = Object.keys(parsed.records[0] ?? {}).filter((h) => h !== '__lineNumber');
    const mappedHeaders = new Set(
      Object.values(map.fields).flat().map((h) => String(h).toLowerCase()),
    );
    const unmappedHeaders = headersFound.filter((h) => !mappedHeaders.has(h.toLowerCase()));

    const findings = validateDocument({
      rules: profile.validationRules as never,
      headers: headersFound,
      coverage,
      rowsParsed: normalized.length,
      rowsFailed: parsed.stats.unparseableLines,
      unmappedHeaders,
    });

    for (const finding of findings) {
      issues.push({ severity: finding.severity, code: finding.code, message: finding.message });
    }

    if (findings.some((f) => f.severity === 'error')) {
      return failed(
        request, startedAt,
        'The document did not match the parser profile that read it. Nothing was written. Publish a new profile version rather than accepting the loss.',
        issues, sourceSha256, parsed.stats.ocrUsed ? 'pdf_ocr' : sourceType,
      );
    }
  }

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
      parserProfileId: profile.profileId,
      parserVersion: profile.version,
      normalizationVersion: profile.normalizationVersion ?? NORMALIZATION_VERSION,
      ocrVersion: parsed.stats.ocrUsed ? (profile.ocrVersion ?? 'tesseract:unrecorded') : null,
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
  const rosterDate = request.rosterDate ? new Date(request.rosterDate) : null;

  try {
    report('matching', { processed: 0, total: collapsed.length });
    let processed = 0;
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
      // Resumability: the last line committed, so a large import can restart
      // where it stopped instead of from the beginning.
      await prisma.inmateIngestionBatch.update({
        where: { batchId: batch.batchId },
        data: { resumeCursor: entry.lineNumber },
      });
      processed += 1;
      report('saving', { processed, total: collapsed.length });
    }
    report('concluding', { processed, total: collapsed.length });

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
    counts.conflicts = conflictCount;
    counts.departures = departureCount;

    // Evidence is now complete for this batch, so the engines can conclude from it.
    // Watch lists are evaluated inside this pass, against intelligence rather than
    // against the roster — which is why nothing here matches people to lists.
    const published = await publishBatchIntelligence({
      batchId: batch.batchId,
      versions: {
        parserProfileId: profile.profileId ?? undefined,
        parserVersion: profile.version === null ? undefined : String(profile.version),
        normalizationVersion: profile.normalizationVersion ?? NORMALIZATION_VERSION,
      },
    });
    counts.watchListHits = published.watchListHits;

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

  report('complete');

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
        // The booking row carries current truth, and every screen and the printed
        // report read it rather than the observation history. Updating only
        // lastObservedAt left it holding the first roster's values forever: the jail
        // raised this bail to $75,000 and the report kept printing $50,000, which an
        // operator would quote to a customer.
        //
        // Only fields the source actually stated are written. A roster that omits a
        // column has not set it to nothing, and letting an absence overwrite a known
        // value would lose data every time a source published less than the last one.
        await tx.inmateBooking.update({
          where: { bookingId: existing.bookingId },
          data: {
            lastObservedAt: new Date(),
            ...(record.bailAmountCents !== undefined ? { bailAmountCents: record.bailAmountCents } : {}),
            ...(record.housingLocation !== undefined ? { housingLocation: record.housingLocation } : {}),
            ...(record.releasedAt !== undefined ? { releasedAt: new Date(record.releasedAt), custodyStatus: 'released' } : {}),
            ...(record.projectedReleaseAt !== undefined ? { projectedReleaseAt: new Date(record.projectedReleaseAt) } : {}),
            ...(record.courtDate !== undefined ? { courtDate: new Date(record.courtDate) } : {}),
            ...(record.courtName !== undefined ? { courtName: record.courtName } : {}),
            ...(record.outstandingWarrants !== undefined ? { outstandingWarrants: record.outstandingWarrants } : {}),
            ...(record.arrestType !== undefined ? { arrestType: record.arrestType } : {}),
            // A booking that was marked as having left the roster is listed again, so
            // it has not left. Cleared, or a person restored to the roster would stay
            // absent from the population screen.
            departedRosterAt: null,
          },
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
      const created = await createPersonFromRecord(tx, { record, confidence: result.evidence.confidence });
      inmateId = created.inmateId;
      isFirstAppearance = true;
    } else if (inmateId) {
      // "Newly discovered" is a property of ingestion, recorded now. Recomputing it
      // later from a moving baseline would change historical reports whenever older
      // data was backfilled.
      const priorBookings = await tx.inmateBooking.count({ where: { inmateId } });
      isFirstAppearance = priorBookings === 0;
    }

    if (!inmateId) return;

    // Shared with the review queue, so a reviewer-approved merge writes exactly what
    // an automatic one writes.
    const { bookingId } = await attachBooking(tx, {
      inmateId,
      record,
      batchId,
      recordId: ingestionRecord.recordId,
      documentId: args.documentId,
      sourceType: args.sourceType,
      sourcePage: null,
      sourceRow: lineNumber,
      rosterDate: args.rosterDate,
      isFirstAppearance,
      confidence: result.evidence.confidence,
    });

    writtenInmateId = inmateId;
    writtenBookingId = bookingId;
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
