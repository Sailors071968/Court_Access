// ============================================================================
// HTTP surface for bulk Import Jobs.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';

import type { AuthenticatedRequest } from '../../security/authMiddleware.js';
import { recordAccess } from './auditLog.js';
import { processImportJobMultipartUpload } from './importJobMultipartUpload.js';
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
      const outcome = await processImportJobMultipartUpload({
        request: request as Parameters<typeof processImportJobMultipartUpload>[0]['request'],
        jobId,
        deps: {
          getImportJob,
          markBatchUploading,
          markBatchUploadFailed,
          storeJobFileUpload,
          maybeAutoProcess,
          recordAccess: async (args) =>
            recordAccess({
              userId: args.userId,
              action: 'import_job_batch_uploaded',
              parameters: args.parameters,
              ipAddress: args.ipAddress,
            }),
        },
      });
      return reply.code(outcome.statusCode).send(outcome.body);
    });
  });

  console.log('[Server] Import job routes registered: /api/admin/intelligence/import-jobs/*');
}
