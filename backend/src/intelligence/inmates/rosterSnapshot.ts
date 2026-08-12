// ============================================================================
// Certified roster snapshots — immutable baselines for next-day comparison.
//
// Primary Engineering Directive Step 5:
//   Never compare against raw PDFs.
//   Compare against yesterday's certified roster snapshot.
// ============================================================================

import prisma from '../../lib/prisma.js';
import {
  buildCanonicalRoster,
  buildCanonicalRosterFromNormalized,
  PROCESSING_VERSION,
  type CanonicalRoster,
} from './canonicalRoster.js';
import { validateCanonicalRoster, type ParseValidationResult } from './parseValidation.js';
import type { RawRecord } from './types.js';

export type SnapshotStatus = 'extracted' | 'validated' | 'certified';

export interface SnapshotMemberView {
  name: string;
  normalizedName: string;
  xref: string | null;
  housing: string | null;
  classification: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  inmateId: string | null;
  bookingId: string | null;
  sourcePage: number | null;
  sourceRow: number | null;
}

/**
 * Persist a canonical roster as an immutable snapshot.
 * If the same contentHash already exists for the facility+date, returns it.
 */
export async function persistRosterSnapshot(args: {
  roster: CanonicalRoster;
  validation: ParseValidationResult;
  sourceUploadId?: string | null;
  sourceBatchId?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
}): Promise<{ snapshotId: string; status: SnapshotStatus; created: boolean }> {
  const rosterDate = new Date(`${args.roster.rosterDate}T00:00:00.000Z`);
  const existing = await prisma.inmateRosterSnapshot.findUnique({
    where: {
      facility_rosterDate_contentHash: {
        facility: args.roster.facility,
        rosterDate,
        contentHash: args.roster.contentHash,
      },
    },
    select: { snapshotId: true, status: true },
  });
  if (existing) {
    return {
      snapshotId: existing.snapshotId,
      status: existing.status as SnapshotStatus,
      created: false,
    };
  }

  const status: SnapshotStatus = args.validation.ok ? 'validated' : 'extracted';
  const created = await prisma.inmateRosterSnapshot.create({
    data: {
      facility: args.roster.facility,
      rosterDate,
      county: args.roster.county,
      status,
      sourceUploadId: args.sourceUploadId ?? null,
      sourceBatchId: args.sourceBatchId ?? null,
      sourceDocumentSha256: args.roster.sourceSha256,
      originalFilename: args.roster.sourcePdf,
      pageCount: args.roster.pageCount,
      inmateCount: args.roster.inmates.length,
      contentHash: args.roster.contentHash,
      parserVersion: args.roster.parserVersion,
      processingVersion: args.roster.processingVersion || PROCESSING_VERSION,
      validationOk: args.validation.ok,
      validationErrors: {
        errors: args.validation.errors,
        warnings: args.validation.warnings,
      } as object,
      uploadedById: args.uploadedById ?? null,
      uploadedByName: args.uploadedByName ?? null,
      validatedAt: args.validation.ok ? new Date() : null,
      members: {
        create: args.roster.inmates.map((m) => ({
          ordinal: m.ordinal,
          name: m.name,
          normalizedName: m.normalizedName,
          xref: m.xref,
          housing: m.housing,
          classification: m.classification,
          gender: m.gender,
          dateOfBirth: m.dateOfBirth,
          releaseDate: m.releaseDate,
          sourcePage: m.sourcePage,
          sourceRow: m.sourceRow,
          extractionConfidence: m.extractionConfidence,
          evidence: m.evidence as object,
        })),
      },
    },
    select: { snapshotId: true, status: true },
  });

  return {
    snapshotId: created.snapshotId,
    status: created.status as SnapshotStatus,
    created: true,
  };
}

/** Promote a validated snapshot to engineering-certified after daily PASS. */
export async function certifyRosterSnapshot(snapshotId: string): Promise<void> {
  await prisma.inmateRosterSnapshot.update({
    where: { snapshotId },
    data: { status: 'certified', certifiedAt: new Date() },
  });
}

/**
 * Load yesterday's baseline snapshot for comparison.
 * Prefers certified, then validated. Never returns extracted-only failures.
 */
export async function loadPriorCertifiedSnapshot(
  facility: string,
  opsDate: string,
): Promise<{
  snapshotId: string;
  rosterDate: string;
  status: SnapshotStatus;
  members: SnapshotMemberView[];
} | null> {
  const opsStart = new Date(`${opsDate.slice(0, 10)}T00:00:00.000Z`);
  const prior = new Date(opsStart);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const priorEnd = opsStart;

  const include = { members: { orderBy: { ordinal: 'asc' as const } } };
  const whereBase = {
    facility,
    rosterDate: { gte: prior, lt: priorEnd },
    validationOk: true,
  };
  // Prefer engineering-certified, then validated (never extracted-only failures).
  const row =
    (await prisma.inmateRosterSnapshot.findFirst({
      where: { ...whereBase, status: 'certified' },
      orderBy: [{ certifiedAt: 'desc' }, { extractedAt: 'desc' }],
      include,
    }))
    ?? (await prisma.inmateRosterSnapshot.findFirst({
      where: { ...whereBase, status: 'validated' },
      orderBy: [{ validatedAt: 'desc' }, { extractedAt: 'desc' }],
      include,
    }));
  if (!row) return null;

  return {
    snapshotId: row.snapshotId,
    rosterDate: row.rosterDate.toISOString().slice(0, 10),
    status: row.status as SnapshotStatus,
    members: row.members.map((m) => ({
      name: m.name,
      normalizedName: m.normalizedName,
      xref: m.xref,
      housing: m.housing,
      classification: m.classification,
      gender: m.gender,
      dateOfBirth: m.dateOfBirth,
      inmateId: m.inmateId,
      bookingId: m.bookingId,
      sourcePage: m.sourcePage,
      sourceRow: m.sourceRow,
    })),
  };
}

/**
 * Build + validate + persist a snapshot from a completed ingestion batch.
 * Returns validation failure details so the caller can halt comparison.
 */
export async function snapshotFromBatch(args: {
  batchId: string;
  uploadId?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  emptyPages?: number[];
}): Promise<{
  roster: CanonicalRoster;
  validation: ParseValidationResult;
  snapshotId: string | null;
  status: SnapshotStatus | null;
}> {
  const batch = await prisma.inmateIngestionBatch.findUniqueOrThrow({
    where: { batchId: args.batchId },
    include: { document: true },
  });
  const rosterDate = batch.rosterDate?.toISOString().slice(0, 10);
  if (!rosterDate) {
    const empty = buildCanonicalRoster({
      facility: batch.facility,
      rosterDate: new Date().toISOString().slice(0, 10),
      records: [],
    });
    const validation = validateCanonicalRoster(empty);
    validation.ok = false;
    validation.errors.push({
      code: 'missing_roster_date',
      message: 'Batch has no roster date; cannot build a certified snapshot.',
      severity: 'error',
    });
    return { roster: empty, validation, snapshotId: null, status: null };
  }

  const records = await prisma.inmateIngestionRecord.findMany({
    where: { batchId: args.batchId },
    select: {
      normalizedPayload: true,
      rawPayload: true,
      sourcePage: true,
      lineNumber: true,
      extractionConfidence: true,
    },
  });

  const roster = buildCanonicalRosterFromNormalized({
    facility: batch.facility,
    rosterDate,
    rows: records.map((r) => ({
      normalized: r.normalizedPayload as {
        last?: string; first?: string; externalBookingId?: string;
        dateOfBirth?: string; housingLocation?: string; sex?: string;
      } | null,
      raw: r.rawPayload as Record<string, unknown> | null,
      sourcePage: r.sourcePage,
      lineNumber: r.lineNumber,
      extractionConfidence: r.extractionConfidence,
    })),
    pageCount: batch.document?.pageCount ?? null,
    sourcePdf: batch.sourceFilename,
    sourceSha256: batch.sourceSha256,
    parserVersion: null,
  });

  const validation = validateCanonicalRoster(roster, { emptyPages: args.emptyPages });
  const persisted = await persistRosterSnapshot({
    roster,
    validation,
    sourceUploadId: args.uploadId,
    sourceBatchId: args.batchId,
    uploadedById: args.uploadedById,
    uploadedByName: args.uploadedByName,
  });

  return {
    roster,
    validation,
    snapshotId: persisted.snapshotId,
    status: persisted.status,
  };
}

/** Build a canonical roster from raw parse output (pre-ingest validation). */
export function validateParsedRecords(args: {
  facility: string;
  rosterDate: string;
  records: RawRecord[];
  pageCount?: number | null;
  sourcePdf?: string | null;
  sourceSha256?: string | null;
  emptyPages?: number[];
  minInmates?: number;
}): { roster: CanonicalRoster; validation: ParseValidationResult } {
  const roster = buildCanonicalRoster({
    facility: args.facility,
    rosterDate: args.rosterDate,
    records: args.records,
    pageCount: args.pageCount,
    sourcePdf: args.sourcePdf,
    sourceSha256: args.sourceSha256,
  });
  const validation = validateCanonicalRoster(roster, {
    emptyPages: args.emptyPages,
    minInmates: args.minInmates,
  });
  return { roster, validation };
}
