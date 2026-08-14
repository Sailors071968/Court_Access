// ============================================================================
// Import Job multipart byte ingestion (file ingestion subsystem).
//
// INC-001: each file stream MUST be drained before request.parts() advances.
// Deferring streams for a second pass deadlocks busboy above ~100 KB and leaves
// uploadedBytes=0 / uploadStartedAt=null forever.
// ============================================================================

import type { FastifyRequest } from 'fastify';

export type ImportJobMultipartDeps = {
  getImportJob: (jobId: string) => Promise<{
    jobId: string;
    uploadedBytes: number;
    uploadStartedAt: string | null;
    uploadFinishedAt: string | null;
    status: string;
  } | null>;
  markBatchUploading: (jobId: string, jobFileIds: string[], batchIndex: number) => Promise<unknown>;
  markBatchUploadFailed: (jobId: string, jobFileIds: string[], reason: string) => Promise<unknown>;
  storeJobFileUpload: (args: {
    jobId: string;
    jobFileId: string;
    stream: NodeJS.ReadableStream;
    uploadedById: string;
    uploadedByName?: string;
  }) => Promise<
    | { error: string }
    | { skipped: true; reason: string; uploadId?: string | null; duplicateOfUploadId?: string | null }
    | { uploadId: string; jobFileId: string; sha256: string; sizeBytes: number; duplicateOf?: unknown }
  >;
  maybeAutoProcess: (jobId: string, userId: string) => Promise<{ started?: string[] } | null>;
  recordAccess: (args: {
    userId: string;
    action: string;
    parameters: Record<string, unknown>;
    ipAddress?: string;
  }) => Promise<unknown>;
  /** Optional INC-001 trace sink (defaults to console.log JSON). */
  trace?: (transition: string, fields: Record<string, unknown>) => void;
};

export type ImportJobMultipartResult = {
  statusCode: number;
  body: {
    error?: string;
    message?: string;
    accepted: unknown[];
    rejected: { jobFileId?: string; filename: string; reason: string }[];
    autoProcessStarted?: boolean;
    job?: unknown;
  };
};

type MultipartRequest = FastifyRequest & {
  parts: () => AsyncIterableIterator<{
    type: string;
    fieldname?: string;
    value?: unknown;
    filename?: string;
    file?: NodeJS.ReadableStream & { resume: () => void };
  }>;
  user?: { userId: string; email?: string | null; role?: string };
  ip?: string;
};

/**
 * Drain one Import Job upload batch. Used by the HTTP route and by the
 * size-matrix regression that must never let INC-001 return.
 */
export async function processImportJobMultipartUpload(args: {
  request: MultipartRequest;
  jobId: string;
  deps: ImportJobMultipartDeps;
}): Promise<ImportJobMultipartResult> {
  const { request, jobId, deps } = args;
  const job = await deps.getImportJob(jobId);
  if (!job) {
    return {
      statusCode: 404,
      body: { error: 'Not found', message: 'Import job not found.', accepted: [], rejected: [] },
    };
  }

  const accepted: unknown[] = [];
  const rejected: { jobFileId?: string; filename: string; reason: string }[] = [];
  const jobFileIds: string[] = [];
  let batchIndex = 0;
  const batchStartedAt = Date.now();
  const fieldQueue: string[] = [];

  const trace = (transition: string, fields: Record<string, unknown>) => {
    const payload = {
      incident: 'INC-001',
      transition,
      ts: new Date().toISOString(),
      durationMs: Date.now() - batchStartedAt,
      jobId,
      ...fields,
    };
    if (deps.trace) deps.trace(transition, payload);
    else console.log(JSON.stringify(payload));
  };

  trace('multipart_request_open', {
    contentType: request.headers['content-type'] ?? null,
    contentLength: request.headers['content-length'] ?? null,
  });

  try {
    for await (const part of request.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'jobFileId' || part.fieldname === 'jobFileIds') {
          fieldQueue.push(String(part.value));
        } else if (part.fieldname === 'batchIndex') {
          batchIndex = Number(part.value) || 0;
        }
        continue;
      }
      if (part.type !== 'file' || !part.file) continue;

      const jobFileId = fieldQueue.shift();
      if (!jobFileId) {
        rejected.push({ filename: part.filename ?? 'unknown', reason: 'Missing jobFileId for this file part.' });
        part.file.resume();
        continue;
      }

      jobFileIds.push(jobFileId);
      const filename = part.filename ?? 'unknown';
      trace('multipart_file_part', { jobFileId, filename, batchIndex });

      await deps.markBatchUploading(jobId, [jobFileId], batchIndex);
      trace('jobfile_uploading', { jobFileId, filename });

      const fileStartedAt = Date.now();
      const stored = await deps.storeJobFileUpload({
        jobId,
        jobFileId,
        stream: part.file,
        uploadedById: request.user!.userId,
        uploadedByName: request.user!.email ?? undefined,
      });

      if ('error' in stored && stored.error) {
        part.file.resume();
        rejected.push({ jobFileId, filename, reason: stored.error });
        trace('file_store_fail', {
          jobFileId,
          filename,
          error: stored.error,
          durationMs: Date.now() - fileStartedAt,
        });
      } else {
        accepted.push({ ...stored, filename, jobFileId });
        const sizeBytes = 'sizeBytes' in stored ? stored.sizeBytes : null;
        const uploadId = 'uploadId' in stored ? stored.uploadId : null;
        trace('file_store_ok', {
          jobFileId,
          filename,
          uploadId,
          bytes: sizeBytes,
          durationMs: Date.now() - fileStartedAt,
        });
      }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    trace('multipart_abort', { reason, jobFileIds });
    if (jobFileIds.length > 0) {
      await deps.markBatchUploadFailed(jobId, jobFileIds, reason);
    }
    return {
      statusCode: 400,
      body: { error: 'Upload batch failed', message: reason, accepted, rejected },
    };
  }

  const auto = await deps.maybeAutoProcess(jobId, request.user!.userId);
  const jobAfter = await deps.getImportJob(jobId);
  const autoProcessStarted = Boolean(auto && 'started' in auto && (auto.started?.length ?? 0) > 0);
  trace('batch_complete', {
    batchIndex,
    accepted: accepted.length,
    rejected: rejected.length,
    uploadedBytes: jobAfter?.uploadedBytes ?? null,
    uploadStartedAt: jobAfter?.uploadStartedAt ?? null,
    uploadFinishedAt: jobAfter?.uploadFinishedAt ?? null,
    status: jobAfter?.status ?? null,
    autoProcessStarted,
  });

  await deps.recordAccess({
    userId: request.user!.userId,
    action: 'import_job_batch_uploaded',
    parameters: { jobId, accepted: accepted.length, rejected: rejected.length, batchIndex },
    ipAddress: request.ip,
  });

  return {
    statusCode: accepted.length > 0 || rejected.length > 0 ? 201 : 400,
    body: {
      accepted,
      rejected,
      autoProcessStarted,
      job: jobAfter,
    },
  };
}
