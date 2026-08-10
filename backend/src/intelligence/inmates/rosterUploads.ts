// ============================================================================
// Roster uploads and dashboard-driven processing.
//
// Version 1 is manual: an administrator uploads today's Sacramento County CSV and
// PDF, presses Process Import, and watches it run. There is no scheduler and no
// queue, which is a scope decision rather than an oversight — the operational
// question this sprint answers is whether the intelligence is any good, and that
// does not need automation to answer.
//
// Two things shape the code here.
//
// Processing runs in the background of the request that started it. The alternative
// was holding an HTTP connection open for a roster that may take a minute, which
// fails on any proxy timeout and gives the operator nothing to look at meanwhile.
// The upload row carries the stage, so the dashboard polls rather than waits.
//
// The uploaded bytes are kept. Reprocessing a file after a parser profile is
// corrected is the whole reason parser profiles are versioned, and it needs the
// original document — a pipeline that discarded its input could never do it.
// ============================================================================

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import prisma from '../../lib/prisma.js';
import { runIngestion } from './ingestionEngine.js';
import type { IngestionStage } from './types.js';

/**
 * Where uploaded rosters live.
 *
 * Outside the release directory, so a deployment that replaces the release does not
 * delete the evidence. Overridable for a host that keeps data elsewhere.
 */
export const UPLOAD_ROOT = process.env.NIIS_UPLOAD_DIR
  ? resolve(process.env.NIIS_UPLOAD_DIR)
  : '/var/lib/courtaccess/niis-uploads';

/** Version 1 is Sacramento County only. Stated once, here. */
export const SUPPORTED_FACILITIES = ['sacramento'] as const;
export type SupportedFacility = (typeof SUPPORTED_FACILITIES)[number];

/** 200 MB. A county roster is a few megabytes; this is a guard, not a target. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Maximum files accepted in one multipart request.
 *
 * The Admin UI chunks larger drops into requests of this size. Raising it without
 * chunking the client would recreate the failure mode where a 1,000-file folder
 * becomes one enormous POST that nginx or the browser aborts.
 */
export const UPLOAD_FILES_PER_REQUEST = 50;

const ALLOWED_EXTENSIONS = new Set(['.csv', '.pdf']);

export interface StoreUploadArgs {
  facility: string;
  originalName: string;
  stream: NodeJS.ReadableStream;
  uploadedById: string;
  uploadedByName?: string;
  rosterDate?: string;
  rosterKind?: 'full_population' | 'incremental';
  jobId?: string;
  jobFileId?: string;
  /** When set, the digested hash must match or the upload is refused. */
  expectedSha256?: string;
}

export interface StoredUpload {
  uploadId: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  fileKind: 'csv' | 'pdf';
  /** A previous upload of identical bytes for the same facility, when there is one.
   *  Surfaced rather than rejected: uploading the same file twice is a mistake worth
   *  telling the operator about, not one worth refusing. */
  duplicateOf?: { uploadId: string; uploadedAt: string; status: string };
}

/**
 * Write an uploaded file to disk and register it.
 *
 * Hashed while streaming rather than by re-reading, so a large PDF is not held in
 * memory and not read twice. The size limit is enforced as bytes arrive: checking
 * afterwards would mean a hostile upload had already been written in full.
 */
export async function storeUpload(args: StoreUploadArgs): Promise<StoredUpload | { error: string }> {
  const extension = extname(args.originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { error: `Only CSV and PDF rosters can be uploaded. "${args.originalName}" is neither.` };
  }
  if (!SUPPORTED_FACILITIES.includes(args.facility as SupportedFacility)) {
    return {
      error: `Version 1 handles Sacramento County only. "${args.facility}" is not configured.`,
    };
  }

  await mkdir(UPLOAD_ROOT, { recursive: true });

  const uploadId = crypto.randomUUID();
  const storedPath = join(UPLOAD_ROOT, `${uploadId}${extension}`);

  const hash = createHash('sha256');
  let sizeBytes = 0;
  let tooLarge = false;

  const measured = new (await import('node:stream')).Transform({
    transform(chunk: Buffer, _enc, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > MAX_UPLOAD_BYTES) {
        tooLarge = true;
        callback(new Error('upload_too_large'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(args.stream, measured, createWriteStream(storedPath));
  } catch (err) {
    // A partial file is worse than none: it would parse as a truncated roster and
    // look like a short day at the jail.
    await unlink(storedPath).catch(() => undefined);
    if (tooLarge) {
      return { error: `The file exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.` };
    }
    return { error: `The upload did not complete: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (sizeBytes === 0) {
    await unlink(storedPath).catch(() => undefined);
    return { error: 'The uploaded file is empty.' };
  }

  const sha256 = hash.digest('hex');
  const fileKind = extension === '.pdf' ? 'pdf' : 'csv';

  if (args.expectedSha256 && args.expectedSha256.toLowerCase() !== sha256) {
    await unlink(storedPath).catch(() => undefined);
    return {
      error:
        `Fingerprint mismatch for "${args.originalName}": ` +
        `expected ${args.expectedSha256.slice(0, 12)}…, received ${sha256.slice(0, 12)}….`,
    };
  }

  const priorUpload = await prisma.inmateRosterUpload.findFirst({
    where: { sha256, facility: args.facility },
    orderBy: { uploadedAt: 'desc' },
    select: { uploadId: true, uploadedAt: true, status: true },
  });

  await prisma.inmateRosterUpload.create({
    data: {
      uploadId,
      facility: args.facility,
      originalName: args.originalName,
      storedPath,
      sizeBytes,
      sha256,
      fileKind,
      rosterDate: args.rosterDate ? new Date(args.rosterDate) : null,
      rosterKind: args.rosterKind ?? 'full_population',
      uploadedById: args.uploadedById,
      uploadedByName: args.uploadedByName ?? null,
      status: 'uploaded',
      jobId: args.jobId ?? null,
      jobFileId: args.jobFileId ?? null,
    },
  });

  return {
    uploadId,
    originalName: args.originalName,
    sizeBytes,
    sha256,
    fileKind,
    duplicateOf: priorUpload
      ? { uploadId: priorUpload.uploadId, uploadedAt: priorUpload.uploadedAt.toISOString(), status: priorUpload.status }
      : undefined,
  };
}

/**
 * Start processing one or more uploads.
 *
 * Claims each upload before returning, so pressing Process Import twice cannot run
 * the same file concurrently — two ingestions of one roster would race on the same
 * bookings and the loser would record spurious conflicts against itself.
 *
 * Ordering matters: CSV before PDF. The CSV is the machine-written source and the
 * PDF may be scanned, and cross-source reconciliation prefers the machine-written
 * value. Ingesting the PDF first would still reach the same conclusion, but every
 * disagreement would be recorded as a change from the OCR value to the real one,
 * which reads as though the jail changed something when only the source did.
 */
export type UploadSettledResult = {
  ok: boolean;
  reason?: string;
  startedAt: Date;
  durationMs: number;
  rowsRead?: number;
};

export async function startProcessing(args: {
  uploadIds: string[];
  userId: string;
  onUploadSettled?: (uploadId: string, result: UploadSettledResult) => Promise<void> | void;
}): Promise<{ started: string[]; skipped: { uploadId: string; reason: string }[] }> {
  const started: string[] = [];
  const skipped: { uploadId: string; reason: string }[] = [];

  const uploads = await prisma.inmateRosterUpload.findMany({
    where: { uploadId: { in: args.uploadIds } },
    // CSV first. See above.
    orderBy: [{ fileKind: 'asc' }, { uploadedAt: 'asc' }],
  });

  const found = new Set(uploads.map((u) => u.uploadId));
  for (const id of args.uploadIds) {
    if (!found.has(id)) skipped.push({ uploadId: id, reason: 'No such upload.' });
  }

  for (const upload of uploads) {
    if (upload.status === 'processing' || upload.status === 'queued') {
      skipped.push({ uploadId: upload.uploadId, reason: 'Already processing.' });
      continue;
    }
    try {
      await stat(upload.storedPath);
    } catch {
      skipped.push({ uploadId: upload.uploadId, reason: 'The stored file is missing from disk.' });
      continue;
    }

    // The claim. Conditional on the row not already being claimed, so two
    // simultaneous requests cannot both win.
    const claimed = await prisma.inmateRosterUpload.updateMany({
      where: { uploadId: upload.uploadId, status: { notIn: ['processing', 'queued'] } },
      data: {
        status: 'queued',
        stage: null,
        progressDone: null,
        progressTotal: null,
        failureReason: null,
        processingStartedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      skipped.push({ uploadId: upload.uploadId, reason: 'Already processing.' });
      continue;
    }
    started.push(upload.uploadId);
  }

  // Sequentially in the background. Concurrent imports of the same facility would
  // interleave observations of the same bookings and produce conflicts that are an
  // artefact of the scheduling rather than of the sources.
  void processSequentially(started, args.userId, args.onUploadSettled);

  return { started, skipped };
}

async function processSequentially(
  uploadIds: string[],
  userId: string,
  onUploadSettled?: (uploadId: string, result: UploadSettledResult) => Promise<void> | void,
): Promise<void> {
  for (const uploadId of uploadIds) {
    const startedAt = new Date();
    try {
      const settled = await processOne(uploadId, userId);
      if (onUploadSettled) await onUploadSettled(uploadId, settled);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await prisma.inmateRosterUpload.update({
        where: { uploadId },
        data: {
          status: 'failed',
          stage: null,
          failureReason: reason,
          processedAt: new Date(),
        },
      }).catch(() => undefined);
      if (onUploadSettled) {
        await onUploadSettled(uploadId, {
          ok: false,
          reason,
          startedAt,
          durationMs: Date.now() - startedAt.getTime(),
        });
      }
    }
  }
}

async function processOne(uploadId: string, userId: string): Promise<UploadSettledResult> {
  const upload = await prisma.inmateRosterUpload.findUnique({ where: { uploadId } });
  const wallStart = new Date();
  if (!upload) {
    return { ok: false, reason: 'Upload disappeared before processing.', startedAt: wallStart, durationMs: 0 };
  }

  const startedAt = Date.now();
  await prisma.inmateRosterUpload.update({
    where: { uploadId },
    data: { status: 'processing', stage: 'parsing' },
  });

  // Throttled: a roster of two thousand rows would otherwise issue two thousand
  // writes purely to animate a progress bar.
  let lastWrite = 0;
  const writeStage = (stage: IngestionStage, detail?: { processed?: number; total?: number }) => {
    const now = Date.now();
    const isMilestone = stage !== 'saving';
    if (!isMilestone && now - lastWrite < 400) return;
    lastWrite = now;
    void prisma.inmateRosterUpload.update({
      where: { uploadId },
      data: {
        stage,
        progressDone: detail?.processed ?? null,
        progressTotal: detail?.total ?? null,
      },
    }).catch(() => undefined);
  };

  const outcome = await runIngestion({
    filePath: upload.storedPath,
    facility: upload.facility,
    trigger: 'manual',
    dryRun: false,
    rosterKind: upload.rosterKind === 'incremental' ? 'incremental' : 'full_population',
    rosterDate: upload.rosterDate?.toISOString().slice(0, 10),
    userId,
    onStage: writeStage,
  });

  const durationMs = Date.now() - startedAt;
  await prisma.inmateRosterUpload.update({
    where: { uploadId },
    data: {
      status: outcome.status === 'completed' ? 'completed' : 'failed',
      stage: outcome.status === 'completed' ? 'complete' : null,
      batchId: outcome.batchId,
      processedAt: new Date(),
      durationMs,
      failureReason: outcome.failureReason ?? null,
      resultCounts: outcome.counts as unknown as object,
      progressDone: outcome.counts.total,
      progressTotal: outcome.counts.total,
    },
  });

  return {
    ok: outcome.status === 'completed',
    reason: outcome.failureReason ?? undefined,
    startedAt: wallStart,
    durationMs,
    rowsRead: outcome.counts.total,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface UploadView {
  uploadId: string;
  facility: string;
  filename: string;
  fileKind: string;
  sizeBytes: number;
  sha256: string;
  rosterDate: string | null;
  rosterKind: string;
  uploadedAt: string;
  uploadedById: string;
  uploadedByName: string | null;
  status: string;
  stage: string | null;
  progressDone: number | null;
  progressTotal: number | null;
  batchId: string | null;
  processedAt: string | null;
  durationMs: number | null;
  failureReason: string | null;
  counts: Record<string, number> | null;
}

function toView(row: {
  uploadId: string; facility: string; originalName: string; fileKind: string;
  sizeBytes: number; sha256: string; rosterDate: Date | null; rosterKind: string;
  uploadedAt: Date; uploadedById: string; uploadedByName: string | null;
  status: string; stage: string | null; progressDone: number | null; progressTotal: number | null;
  batchId: string | null; processedAt: Date | null; durationMs: number | null;
  failureReason: string | null; resultCounts: unknown;
}): UploadView {
  return {
    uploadId: row.uploadId,
    facility: row.facility,
    filename: row.originalName,
    fileKind: row.fileKind,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    rosterDate: row.rosterDate?.toISOString().slice(0, 10) ?? null,
    rosterKind: row.rosterKind,
    uploadedAt: row.uploadedAt.toISOString(),
    uploadedById: row.uploadedById,
    uploadedByName: row.uploadedByName,
    status: row.status,
    stage: row.stage,
    progressDone: row.progressDone,
    progressTotal: row.progressTotal,
    batchId: row.batchId,
    processedAt: row.processedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    failureReason: row.failureReason,
    counts: (row.resultCounts ?? null) as Record<string, number> | null,
  };
}

export async function listUploads(args: { limit: number; offset: number; status?: string }) {
  const where = args.status ? { status: args.status } : {};
  const [total, rows] = await Promise.all([
    prisma.inmateRosterUpload.count({ where }),
    prisma.inmateRosterUpload.findMany({
      where,
      orderBy: [{ uploadedAt: 'desc' }, { uploadId: 'asc' }],
      skip: args.offset,
      take: args.limit,
    }),
  ]);
  return { total, uploads: rows.map(toView) };
}

/** The processing queue: anything not yet finished, plus what finished recently. */
export async function processingQueue() {
  const [active, recent] = await Promise.all([
    prisma.inmateRosterUpload.findMany({
      where: { status: { in: ['uploaded', 'queued', 'processing'] } },
      orderBy: { uploadedAt: 'asc' },
      take: 100,
    }),
    prisma.inmateRosterUpload.findMany({
      where: { status: { in: ['completed', 'failed'] } },
      orderBy: { processedAt: 'desc' },
      take: 20,
    }),
  ]);
  return { active: active.map(toView), recent: recent.map(toView) };
}

export async function getUpload(uploadId: string): Promise<UploadView | null> {
  const row = await prisma.inmateRosterUpload.findUnique({ where: { uploadId } });
  return row ? toView(row) : null;
}

/**
 * Delete an upload that was never processed.
 *
 * Refuses once a batch exists. The uploaded bytes are the evidence behind every
 * conclusion drawn from them, and deleting the file would leave those conclusions
 * unverifiable — which is the one thing the platform is built not to allow.
 */
export async function deleteUpload(uploadId: string): Promise<{ ok: boolean; reason?: string }> {
  const upload = await prisma.inmateRosterUpload.findUnique({
    where: { uploadId },
    select: { storedPath: true, batchId: true, status: true },
  });
  if (!upload) return { ok: false, reason: 'No such upload.' };
  if (upload.batchId) {
    return {
      ok: false,
      reason: 'This file has been processed. It is the evidence behind the intelligence drawn from it and cannot be deleted.',
    };
  }
  if (upload.status === 'processing' || upload.status === 'queued') {
    return { ok: false, reason: 'This file is being processed.' };
  }

  await unlink(upload.storedPath).catch(() => undefined);
  await prisma.inmateRosterUpload.delete({ where: { uploadId } });
  return { ok: true };
}
