// ============================================================================
// HTTP surface for bulk Import Jobs.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';

import type { AuthenticatedRequest } from '../../security/authMiddleware.js';
import { recordAccess } from './auditLog.js';
import {
  cancelImportJob, createImportJob, getImportJob, listImportJobs, listJobFiles,
  markBatchUploadFailed, markBatchUploading, maybeAutoProcess, pendingUploadsForJob,
  startJobProcessing, storeJobFileUpload,
} from './importJobs.js';
import { MAX_UPLOAD_BYTES, UPLOAD_FILES_PER_REQUEST } from './rosterUploads.js';

function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'The Inmate Intelligence System is available to administrators only.',
    });
    return false;
  }
  return true;
}

const clampLimit = (value: unknown, fallback = 50, max = 500): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
};
const offsetOf = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export async function registerImportJobRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/intelligence/import-jobs', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { limit?: string; offset?: string; status?: string };
    return reply.send(await listImportJobs({
      limit: clampLimit(q.limit),
      offset: offsetOf(q.offset),
      status: q.status,
    }));
  });

  app.post('/api/admin/intelligence/import-jobs', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const body = (request.body ?? {}) as {
      facility?: string;
      rosterDate?: string;
      label?: string;
      autoProcess?: boolean;
      files?: { name: string; sizeBytes: number; sha256: string }[];
    };
    try {
      const result = await createImportJob({
        facility: body.facility ?? 'sacramento',
        rosterDate: body.rosterDate,
        label: body.label,
        autoProcess: body.autoProcess,
        createdById: request.user!.userId,
        createdByName: request.user!.email ?? undefined,
        files: body.files ?? [],
      });
      await recordAccess({
        userId: request.user!.userId,
        action: 'import_job_created',
        parameters: {
          jobId: result.job.jobId,
          totalFiles: result.job.totalFiles,
          skipped: result.decisions.filter((d) => d.action === 'skip_duplicate').length,
        },
        ipAddress: request.ip,
      });
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(400).send({
        error: 'Could not create import job',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/admin/intelligence/import-jobs/:jobId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { jobId } = request.params as { jobId: string };
    const job = await getImportJob(jobId);
    if (!job) return reply.code(404).send({ error: 'Not found' });
    return reply.send(job);
  });

  app.get('/api/admin/intelligence/import-jobs/:jobId/files', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { jobId } = request.params as { jobId: string };
    const q = request.query as { status?: string; limit?: string; offset?: string };
    return reply.send(await listJobFiles(jobId, {
      status: q.status,
      limit: clampLimit(q.limit, 200, 2000),
      offset: offsetOf(q.offset),
    }));
  });

  app.get('/api/admin/intelligence/import-jobs/:jobId/pending', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { jobId } = request.params as { jobId: string };
    if (!(await getImportJob(jobId))) return reply.code(404).send({ error: 'Not found' });
    return reply.send(await pendingUploadsForJob(jobId));
  });

  app.post('/api/admin/intelligence/import-jobs/:jobId/process', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { jobId } = request.params as { jobId: string };
    try {
      const outcome = await startJobProcessing({ jobId, userId: request.user!.userId });
      return reply.code(202).send(outcome);
    } catch (err) {
      return reply.code(400).send({
        error: 'Could not start processing',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/admin/intelligence/import-jobs/:jobId/cancel', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { jobId } = request.params as { jobId: string };
    const body = (request.body ?? {}) as { reason?: string };
    const job = await cancelImportJob(jobId, body.reason);
    return reply.send(job);
  });

  // Multipart upload of one chunk of a job.
  await app.register(async function importJobUploadPlugin(instance) {
    await instance.register(multipart, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: UPLOAD_FILES_PER_REQUEST, fields: 100 },
    });

    instance.post('/api/admin/intelligence/import-jobs/:jobId/uploads', async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (!requireAdministrator(request, reply)) return;
      const { jobId } = request.params as { jobId: string };
      if (!(await getImportJob(jobId))) {
        return reply.code(404).send({ error: 'Not found', message: 'Import job not found.' });
      }

      const accepted: unknown[] = [];
      const rejected: { jobFileId?: string; filename: string; reason: string }[] = [];
      const jobFileIds: string[] = [];
      let batchIndex = 0;
      const batchStartedAt = Date.now();

      // INC-001: Multipart fields and files are interleaved. Each file stream MUST be
      // consumed (piped to durable storage) before the parts() iterator advances.
      // Holding streams for a second pass deadlocks busboy once the part exceeds the
      // internal buffer (~100 KB): markBatchUploading never runs, uploadStartedAt stays
      // null, uploadedBytes stays 0, and the browser eventually aborts.
      // Pairing rule: each file part is preceded by a jobFileId field (BulkImportPanel).
      const fieldQueue: string[] = [];

      const trace = (transition: string, fields: Record<string, unknown>) => {
        console.log(JSON.stringify({
          incident: 'INC-001',
          transition,
          ts: new Date().toISOString(),
          durationMs: Date.now() - batchStartedAt,
          jobId,
          ...fields,
        }));
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
          if (part.type !== 'file') continue;

          const jobFileId = fieldQueue.shift();
          if (!jobFileId) {
            rejected.push({ filename: part.filename, reason: 'Missing jobFileId for this file part.' });
            part.file.resume();
            continue;
          }

          jobFileIds.push(jobFileId);
          trace('multipart_file_part', {
            jobFileId,
            filename: part.filename,
            batchIndex,
          });

          // Mark uploading before draining bytes so operators see progress if the
          // transfer is slow — and so aborted mid-stream jobs are not left "pending".
          await markBatchUploading(jobId, [jobFileId], batchIndex);
          trace('jobfile_uploading', { jobFileId, filename: part.filename });

          const fileStartedAt = Date.now();
          const stored = await storeJobFileUpload({
            jobId,
            jobFileId,
            stream: part.file,
            uploadedById: request.user!.userId,
            uploadedByName: request.user!.email ?? undefined,
          });

          if ('error' in stored && stored.error) {
            // Drain any remainder so subsequent parts are not blocked.
            part.file.resume();
            rejected.push({ jobFileId, filename: part.filename, reason: stored.error });
            trace('file_store_fail', {
              jobFileId,
              filename: part.filename,
              error: stored.error,
              durationMs: Date.now() - fileStartedAt,
            });
          } else {
            accepted.push({ ...stored, filename: part.filename, jobFileId });
            const sizeBytes = 'sizeBytes' in stored ? stored.sizeBytes : null;
            const uploadId = 'uploadId' in stored ? stored.uploadId : null;
            trace('file_store_ok', {
              jobFileId,
              filename: part.filename,
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
          await markBatchUploadFailed(jobId, jobFileIds, reason);
        }
        return reply.code(400).send({
          error: 'Upload batch failed',
          message: reason,
          accepted,
          rejected,
        });
      }

      // Kick async processing when the client has finished the last pending file.
      const auto = await maybeAutoProcess(jobId, request.user!.userId);
      const job = await getImportJob(jobId);
      trace('batch_complete', {
        batchIndex,
        accepted: accepted.length,
        rejected: rejected.length,
        uploadedBytes: job?.uploadedBytes ?? null,
        uploadStartedAt: job?.uploadStartedAt ?? null,
        uploadFinishedAt: job?.uploadFinishedAt ?? null,
        status: job?.status ?? null,
        autoProcessStarted: Boolean(auto && 'started' in auto && auto.started.length > 0),
      });

      await recordAccess({
        userId: request.user!.userId,
        action: 'import_job_batch_uploaded',
        parameters: { jobId, accepted: accepted.length, rejected: rejected.length, batchIndex },
        ipAddress: request.ip,
      });

      return reply.code(accepted.length > 0 || rejected.length > 0 ? 201 : 400).send({
        accepted,
        rejected,
        autoProcessStarted: Boolean(auto && 'started' in auto && auto.started.length > 0),
        job,
      });
    });
  });

  console.log('[Server] Import job routes registered: /api/admin/intelligence/import-jobs/*');
}
