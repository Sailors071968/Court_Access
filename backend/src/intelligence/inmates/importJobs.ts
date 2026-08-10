// ============================================================================
// Bulk Import Jobs — resumable upload + asynchronous processing.
//
// Built for historical imports of hundreds or thousands of roster files. The
// browser never holds the HTTP connection open for ingestion; it creates a job,
// uploads in small batches (with retry), and polls. Closing the tab does not
// lose progress: pending files are identified by sha256, so re-selecting the
// same folder resumes without re-sending completed bytes.
// ============================================================================

import { extname } from 'node:path';

import prisma from '../../lib/prisma.js';
import { startProcessing, storeUpload, SUPPORTED_FACILITIES, type SupportedFacility } from './rosterUploads.js';

export const IMPORT_JOB_STATUSES = [
  'pending', 'uploading', 'queued', 'processing', 'completed', 'failed', 'cancelled',
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export const IMPORT_FILE_STATUSES = [
  'pending', 'uploading', 'uploaded', 'skipped_duplicate',
  'failed_upload', 'queued', 'processing', 'completed', 'failed_processing', 'cancelled',
] as const;

export interface ManifestFile {
  name: string;
  sizeBytes: number;
  sha256: string;
}

export interface JobMetrics {
  uploadDurationMs: number | null;
  processingDurationMs: number | null;
  filesPerMinute: number | null;
  rowsPerSecond: number | null;
  parserThroughputRowsPerSec: number | null;
  importQueueDepth: number;
  averageFileSizeBytes: number | null;
  totalRowsRead: number;
  lastUpdatedAt: string;
}

function fileKindOf(name: string): 'csv' | 'pdf' | null {
  const ext = extname(name).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.pdf') return 'pdf';
  return null;
}

async function recountJob(jobId: string): Promise<void> {
  const rows = await prisma.inmateImportJobFile.groupBy({
    by: ['status'],
    where: { jobId },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  });

  const count = (status: string) => rows.find((r) => r.status === status)?._count._all ?? 0;
  const files = await prisma.inmateImportJobFile.findMany({
    where: { jobId },
    select: {
      status: true, sizeBytes: true, originalName: true,
      uploadDurationMs: true, processDurationMs: true, rowsRead: true,
      uploadFinishedAt: true, processFinishedAt: true,
    },
  });

  const uploadedBytes = files
    .filter((f) => ['uploaded', 'queued', 'processing', 'completed', 'failed_processing', 'skipped_duplicate'].includes(f.status))
    .reduce((sum, f) => sum + (f.status === 'skipped_duplicate' ? 0 : f.sizeBytes), 0);

  const job = await prisma.inmateImportJob.findUnique({ where: { jobId } });
  if (!job) return;

  const current = files.find((f) => f.status === 'uploading' || f.status === 'processing')
    ?? files.find((f) => f.status === 'pending');

  const totalRows = files.reduce((sum, f) => sum + (f.rowsRead ?? 0), 0);
  const uploadDurationMs = job.uploadStartedAt && job.uploadFinishedAt
    ? job.uploadFinishedAt.getTime() - job.uploadStartedAt.getTime()
    : job.uploadStartedAt
      ? Date.now() - job.uploadStartedAt.getTime()
      : null;
  const processingDurationMs = job.processStartedAt && job.processFinishedAt
    ? job.processFinishedAt.getTime() - job.processStartedAt.getTime()
    : job.processStartedAt
      ? Date.now() - job.processStartedAt.getTime()
      : null;

  const completedFiles = count('completed') + count('skipped_duplicate');
  const filesPerMinute = uploadDurationMs && uploadDurationMs > 0
    ? (count('uploaded') + count('skipped_duplicate') + count('queued') + count('processing') + count('completed') + count('failed_processing')) / (uploadDurationMs / 60_000)
    : null;
  const rowsPerSecond = processingDurationMs && processingDurationMs > 0
    ? totalRows / (processingDurationMs / 1000)
    : null;

  const metrics: JobMetrics = {
    uploadDurationMs,
    processingDurationMs,
    filesPerMinute: filesPerMinute !== null ? Math.round(filesPerMinute * 10) / 10 : null,
    rowsPerSecond: rowsPerSecond !== null ? Math.round(rowsPerSecond * 10) / 10 : null,
    parserThroughputRowsPerSec: rowsPerSecond !== null ? Math.round(rowsPerSecond * 10) / 10 : null,
    importQueueDepth: count('queued') + count('pending') + count('uploaded'),
    averageFileSizeBytes: files.length
      ? Math.round(files.reduce((s, f) => s + f.sizeBytes, 0) / files.length)
      : null,
    totalRowsRead: totalRows,
    lastUpdatedAt: new Date().toISOString(),
  };

  // Derive job status from file states unless cancelled.
  let status = job.status;
  if (job.status !== 'cancelled') {
    if (count('failed_upload') + count('failed_processing') > 0
      && completedFiles + count('failed_upload') + count('failed_processing') + count('skipped_duplicate') === job.totalFiles
      && count('pending') + count('uploading') + count('uploaded') + count('queued') + count('processing') === 0) {
      status = completedFiles > 0 ? 'completed' : 'failed';
    } else if (count('processing') + count('queued') > 0) {
      status = 'processing';
    } else if (count('uploaded') > 0 && count('pending') + count('uploading') === 0 && !job.autoProcess) {
      status = 'queued';
    } else if (count('uploading') + count('pending') > 0) {
      status = 'uploading';
    } else if (
      count('pending') + count('uploading') + count('uploaded') + count('queued') + count('processing') === 0
      && job.totalFiles > 0
    ) {
      status = 'completed';
    }
  }

  const uploadFinishedAt = count('pending') + count('uploading') === 0 && job.uploadStartedAt
    ? (job.uploadFinishedAt ?? new Date())
    : job.uploadFinishedAt;
  const processFinishedAt = count('queued') + count('processing') + count('uploaded') === 0 && job.processStartedAt
    ? (job.processFinishedAt ?? new Date())
    : job.processFinishedAt;

  await prisma.inmateImportJob.update({
    where: { jobId },
    data: {
      status,
      filesPending: count('pending'),
      filesUploading: count('uploading'),
      filesUploaded: count('uploaded'),
      filesSkippedDuplicate: count('skipped_duplicate'),
      filesFailedUpload: count('failed_upload'),
      filesQueued: count('queued'),
      filesProcessing: count('processing'),
      filesCompleted: count('completed'),
      filesFailedProcessing: count('failed_processing'),
      uploadedBytes: BigInt(uploadedBytes),
      currentFilename: current?.originalName ?? null,
      uploadFinishedAt,
      processFinishedAt,
      metrics: metrics as object,
    },
  });
}

export async function createImportJob(args: {
  facility: string;
  rosterDate?: string;
  label?: string;
  autoProcess?: boolean;
  createdById: string;
  createdByName?: string;
  files: ManifestFile[];
}) {
  if (!SUPPORTED_FACILITIES.includes(args.facility as SupportedFacility)) {
    throw new Error(`Version 1 handles Sacramento County only. "${args.facility}" is not configured.`);
  }
  if (args.files.length === 0) {
    throw new Error('Add at least one file to the import job.');
  }

  const normalised: ManifestFile[] = [];
  const seen = new Set<string>();
  for (const file of args.files) {
    const kind = fileKindOf(file.name);
    if (!kind) continue;
    const sha = file.sha256.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha)) {
      throw new Error(`Invalid sha256 for "${file.name}".`);
    }
    if (seen.has(sha)) continue;
    seen.add(sha);
    normalised.push({ name: file.name, sizeBytes: Math.max(0, Math.floor(file.sizeBytes)), sha256: sha });
  }
  if (normalised.length === 0) {
    throw new Error('No CSV or PDF files were recognised in the manifest.');
  }

  const existing = await prisma.inmateRosterUpload.findMany({
    where: { facility: args.facility, sha256: { in: normalised.map((f) => f.sha256) } },
    select: { uploadId: true, sha256: true, status: true, originalName: true },
  });
  const byHash = new Map(existing.map((e) => [e.sha256, e]));

  const jobId = crypto.randomUUID();
  const decisions: {
    name: string;
    sha256: string;
    action: 'upload' | 'skip_duplicate';
    existingUploadId?: string;
    jobFileId: string;
  }[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.inmateImportJob.create({
      data: {
        jobId,
        facility: args.facility,
        rosterDate: args.rosterDate ? new Date(args.rosterDate) : null,
        label: args.label ?? `${normalised.length} file import`,
        status: 'pending',
        autoProcess: args.autoProcess !== false,
        createdById: args.createdById,
        createdByName: args.createdByName ?? null,
        totalFiles: normalised.length,
        filesPending: 0,
        totalBytes: BigInt(normalised.reduce((s, f) => s + f.sizeBytes, 0)),
      },
    });

    for (const file of normalised) {
      const jobFileId = crypto.randomUUID();
      const prior = byHash.get(file.sha256);
      const skip = Boolean(prior && (prior.status === 'completed' || prior.status === 'uploaded' || prior.status === 'processing' || prior.status === 'queued'));
      const kind = fileKindOf(file.name)!;

      await tx.inmateImportJobFile.create({
        data: {
          jobFileId,
          jobId,
          originalName: file.name,
          sizeBytes: file.sizeBytes,
          sha256: file.sha256,
          fileKind: kind,
          status: skip ? 'skipped_duplicate' : 'pending',
          duplicateOfUploadId: skip ? prior!.uploadId : null,
          uploadFinishedAt: skip ? new Date() : null,
        },
      });

      decisions.push({
        name: file.name,
        sha256: file.sha256,
        action: skip ? 'skip_duplicate' : 'upload',
        existingUploadId: skip ? prior!.uploadId : undefined,
        jobFileId,
      });
    }
  });

  await recountJob(jobId);

  // If everything was a duplicate, mark upload finished immediately.
  const pending = decisions.filter((d) => d.action === 'upload').length;
  if (pending === 0) {
    await prisma.inmateImportJob.update({
      where: { jobId },
      data: {
        status: 'completed',
        uploadStartedAt: new Date(),
        uploadFinishedAt: new Date(),
        processFinishedAt: new Date(),
      },
    });
  }

  return { job: await getImportJob(jobId), decisions };
}

export async function listImportJobs(args: { limit: number; offset: number; status?: string }) {
  const where = args.status ? { status: args.status } : {};
  const [total, rows] = await Promise.all([
    prisma.inmateImportJob.count({ where }),
    prisma.inmateImportJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: args.offset,
      take: args.limit,
    }),
  ]);
  return { total, jobs: rows.map(jobView) };
}

export async function getImportJob(jobId: string) {
  const job = await prisma.inmateImportJob.findUnique({ where: { jobId } });
  if (!job) return null;
  return jobView(job);
}

export async function listJobFiles(jobId: string, args?: { status?: string; limit?: number; offset?: number }) {
  const where: { jobId: string; status?: string } = { jobId };
  if (args?.status) where.status = args.status;
  const [total, rows] = await Promise.all([
    prisma.inmateImportJobFile.count({ where }),
    prisma.inmateImportJobFile.findMany({
      where,
      orderBy: [{ status: 'asc' }, { originalName: 'asc' }],
      skip: args?.offset ?? 0,
      take: args?.limit ?? 200,
    }),
  ]);
  return {
    total,
    files: rows.map((f) => ({
      jobFileId: f.jobFileId,
      originalName: f.originalName,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      fileKind: f.fileKind,
      status: f.status,
      uploadId: f.uploadId,
      batchIndex: f.batchIndex,
      error: f.error,
      duplicateOfUploadId: f.duplicateOfUploadId,
      uploadDurationMs: f.uploadDurationMs,
      processDurationMs: f.processDurationMs,
      rowsRead: f.rowsRead,
    })),
  };
}

/** Files the client still needs to send (for resume). */
export async function pendingUploadsForJob(jobId: string) {
  const files = await prisma.inmateImportJobFile.findMany({
    where: { jobId, status: { in: ['pending', 'failed_upload'] } },
    orderBy: { originalName: 'asc' },
    select: {
      jobFileId: true, originalName: true, sizeBytes: true, sha256: true, fileKind: true, status: true, error: true,
    },
  });
  return { files };
}

export async function markBatchUploading(jobId: string, jobFileIds: string[], batchIndex: number) {
  await prisma.inmateImportJob.update({
    where: { jobId },
    data: {
      status: 'uploading',
      uploadStartedAt: (await prisma.inmateImportJob.findUnique({ where: { jobId } }))?.uploadStartedAt ?? new Date(),
    },
  });
  await prisma.inmateImportJobFile.updateMany({
    where: { jobId, jobFileId: { in: jobFileIds }, status: { in: ['pending', 'failed_upload'] } },
    data: { status: 'uploading', batchIndex, uploadStartedAt: new Date(), error: null },
  });
  await recountJob(jobId);
}

export async function storeJobFileUpload(args: {
  jobId: string;
  jobFileId: string;
  stream: NodeJS.ReadableStream;
  uploadedById: string;
  uploadedByName?: string;
}) {
  const job = await prisma.inmateImportJob.findUnique({ where: { jobId: args.jobId } });
  if (!job) return { error: 'Import job not found.' };
  if (job.status === 'cancelled') return { error: 'This import job was cancelled.' };

  const jobFile = await prisma.inmateImportJobFile.findFirst({
    where: { jobId: args.jobId, jobFileId: args.jobFileId },
  });
  if (!jobFile) return { error: 'Job file not found.' };
  if (jobFile.status === 'skipped_duplicate') {
    return { skipped: true as const, reason: 'Already imported', duplicateOfUploadId: jobFile.duplicateOfUploadId };
  }
  if (jobFile.status === 'uploaded' || jobFile.status === 'completed' || jobFile.status === 'queued' || jobFile.status === 'processing') {
    return { skipped: true as const, reason: 'Already uploaded', uploadId: jobFile.uploadId };
  }

  const started = Date.now();
  await prisma.inmateImportJobFile.update({
    where: { jobFileId: args.jobFileId },
    data: { status: 'uploading', uploadStartedAt: new Date(), error: null },
  });
  await prisma.inmateImportJob.update({
    where: { jobId: args.jobId },
    data: {
      status: 'uploading',
      currentFilename: jobFile.originalName,
      uploadStartedAt: job.uploadStartedAt ?? new Date(),
    },
  });

  const stored = await storeUpload({
    facility: job.facility,
    originalName: jobFile.originalName,
    stream: args.stream,
    uploadedById: args.uploadedById,
    uploadedByName: args.uploadedByName,
    rosterDate: job.rosterDate ? job.rosterDate.toISOString().slice(0, 10) : undefined,
    jobId: args.jobId,
    jobFileId: args.jobFileId,
    expectedSha256: jobFile.sha256,
  });

  if ('error' in stored) {
    await prisma.inmateImportJobFile.update({
      where: { jobFileId: args.jobFileId },
      data: {
        status: 'failed_upload',
        error: stored.error,
        uploadFinishedAt: new Date(),
        uploadDurationMs: Date.now() - started,
      },
    });
    await recountJob(args.jobId);
    return { error: stored.error };
  }

  // Fingerprint mismatch: client claimed one hash, bytes were another.
  if (stored.sha256 !== jobFile.sha256) {
    await prisma.inmateImportJobFile.update({
      where: { jobFileId: args.jobFileId },
      data: {
        status: 'failed_upload',
        error: `Fingerprint mismatch: manifest ${jobFile.sha256.slice(0, 12)}… vs bytes ${stored.sha256.slice(0, 12)}…`,
        uploadFinishedAt: new Date(),
        uploadDurationMs: Date.now() - started,
      },
    });
    await recountJob(args.jobId);
    return { error: 'Fingerprint mismatch between manifest and uploaded bytes.' };
  }

  await prisma.inmateImportJobFile.update({
    where: { jobFileId: args.jobFileId },
    data: {
      status: 'uploaded',
      uploadId: stored.uploadId,
      uploadFinishedAt: new Date(),
      uploadDurationMs: Date.now() - started,
      error: null,
    },
  });
  await recountJob(args.jobId);

  return {
    uploadId: stored.uploadId,
    jobFileId: args.jobFileId,
    sha256: stored.sha256,
    sizeBytes: stored.sizeBytes,
    duplicateOf: stored.duplicateOf,
  };
}

export async function markBatchUploadFailed(jobId: string, jobFileIds: string[], reason: string) {
  await prisma.inmateImportJobFile.updateMany({
    where: { jobId, jobFileId: { in: jobFileIds }, status: { in: ['uploading', 'pending'] } },
    data: { status: 'failed_upload', error: reason, uploadFinishedAt: new Date() },
  });
  await recountJob(jobId);
}

/**
 * After the client finishes (or resumes) uploading, queue processing for every
 * file that landed. Returns immediately; work continues in the background.
 */
export async function startJobProcessing(args: { jobId: string; userId: string }) {
  const job = await prisma.inmateImportJob.findUnique({ where: { jobId: args.jobId } });
  if (!job) throw new Error('Import job not found.');
  if (job.status === 'cancelled') throw new Error('This import job was cancelled.');

  const ready = await prisma.inmateImportJobFile.findMany({
    where: { jobId: args.jobId, status: 'uploaded', uploadId: { not: null } },
    select: { uploadId: true, jobFileId: true },
  });

  const uploadIds = ready.map((r) => r.uploadId!).filter(Boolean);
  if (uploadIds.length === 0) {
    // Nothing left to ingest — finalize counters/status (e.g. all skipped).
    await recountJob(args.jobId);
    const current = await prisma.inmateImportJob.findUnique({ where: { jobId: args.jobId } });
    if (current && current.status !== 'cancelled' && current.filesPending === 0 && current.filesUploading === 0) {
      await prisma.inmateImportJob.update({
        where: { jobId: args.jobId },
        data: {
          status: current.filesFailedProcessing + current.filesFailedUpload > 0 && current.filesCompleted === 0
            ? 'failed'
            : 'completed',
          uploadFinishedAt: current.uploadFinishedAt ?? new Date(),
          processFinishedAt: current.processFinishedAt ?? new Date(),
        },
      });
    }
    return { started: [] as string[], skipped: [] as { uploadId: string; reason: string }[] };
  }

  await prisma.inmateImportJob.update({
    where: { jobId: args.jobId },
    data: {
      status: 'processing',
      processStartedAt: job.processStartedAt ?? new Date(),
      uploadFinishedAt: job.uploadFinishedAt ?? new Date(),
    },
  });
  await prisma.inmateImportJobFile.updateMany({
    where: { jobFileId: { in: ready.map((r) => r.jobFileId) } },
    data: { status: 'queued' },
  });

  const outcome = await startProcessing({
    uploadIds,
    userId: args.userId,
    onUploadSettled: async (uploadId, result) => {
      const file = await prisma.inmateImportJobFile.findFirst({ where: { uploadId } });
      if (!file) return;
      await prisma.inmateImportJobFile.update({
        where: { jobFileId: file.jobFileId },
        data: {
          status: result.ok ? 'completed' : 'failed_processing',
          error: result.ok ? null : result.reason,
          processStartedAt: result.startedAt,
          processFinishedAt: new Date(),
          processDurationMs: result.durationMs,
          rowsRead: result.rowsRead ?? null,
        },
      });
      await recountJob(file.jobId);
    },
  });

  await recountJob(args.jobId);
  return outcome;
}

export async function cancelImportJob(jobId: string, reason?: string) {
  await prisma.inmateImportJobFile.updateMany({
    where: { jobId, status: { in: ['pending', 'failed_upload', 'uploaded'] } },
    data: { status: 'cancelled', error: reason ?? 'Cancelled by operator' },
  });
  await prisma.inmateImportJob.update({
    where: { jobId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: reason ?? 'Cancelled by operator',
      currentFilename: null,
    },
  });
  await recountJob(jobId);
  return getImportJob(jobId);
}

/** If autoProcess is on and nothing remains to upload, kick processing. */
export async function maybeAutoProcess(jobId: string, userId: string) {
  const job = await prisma.inmateImportJob.findUnique({ where: { jobId } });
  if (!job?.autoProcess || job.status === 'cancelled') return null;
  // failed_upload does not block auto-process: those files can be retried later
  // while successfully uploaded files continue into the ingestion queue.
  const pending = await prisma.inmateImportJobFile.count({
    where: { jobId, status: { in: ['pending', 'uploading'] } },
  });
  if (pending > 0) return null;
  const ready = await prisma.inmateImportJobFile.count({
    where: { jobId, status: 'uploaded' },
  });
  if (ready === 0) {
    await recountJob(jobId);
    return null;
  }
  return startJobProcessing({ jobId, userId });
}

function jobView(job: {
  jobId: string;
  facility: string;
  rosterDate: Date | null;
  label: string | null;
  status: string;
  autoProcess: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  uploadStartedAt: Date | null;
  uploadFinishedAt: Date | null;
  processStartedAt: Date | null;
  processFinishedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  totalFiles: number;
  filesPending: number;
  filesUploading: number;
  filesUploaded: number;
  filesSkippedDuplicate: number;
  filesFailedUpload: number;
  filesQueued: number;
  filesProcessing: number;
  filesCompleted: number;
  filesFailedProcessing: number;
  totalBytes: bigint;
  uploadedBytes: bigint;
  currentFilename: string | null;
  failureReason: string | null;
  metrics: unknown;
}) {
  const done = job.filesCompleted + job.filesSkippedDuplicate + job.filesFailedUpload + job.filesFailedProcessing;
  return {
    jobId: job.jobId,
    facility: job.facility,
    rosterDate: job.rosterDate ? job.rosterDate.toISOString().slice(0, 10) : null,
    label: job.label,
    status: job.status,
    autoProcess: job.autoProcess,
    createdById: job.createdById,
    createdByName: job.createdByName,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    uploadStartedAt: job.uploadStartedAt?.toISOString() ?? null,
    uploadFinishedAt: job.uploadFinishedAt?.toISOString() ?? null,
    processStartedAt: job.processStartedAt?.toISOString() ?? null,
    processFinishedAt: job.processFinishedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    cancelReason: job.cancelReason,
    totalFiles: job.totalFiles,
    filesPending: job.filesPending,
    filesUploading: job.filesUploading,
    filesUploaded: job.filesUploaded,
    filesSkippedDuplicate: job.filesSkippedDuplicate,
    filesFailedUpload: job.filesFailedUpload,
    filesQueued: job.filesQueued,
    filesProcessing: job.filesProcessing,
    filesCompleted: job.filesCompleted,
    filesFailedProcessing: job.filesFailedProcessing,
    totalBytes: Number(job.totalBytes),
    uploadedBytes: Number(job.uploadedBytes),
    currentFilename: job.currentFilename,
    failureReason: job.failureReason,
    progressPercent: job.totalFiles > 0 ? Math.round((done / job.totalFiles) * 1000) / 10 : 0,
    metrics: job.metrics as JobMetrics | null,
  };
}
