// ============================================================================
// Gold Standard upload portal — administrator-only API.
//
// The browser creates a session, streams each file in chunks, asks what the
// server holds if it needs to resume, then asks for a preview and finally
// commits. Import and the pipeline then run in the background while the
// session reports which stage it is on, so the operator is never left
// watching a spinner with no explanation.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { discoverFiles, importCertificationCase } from './certificationImport.js';
import { runCertification } from './certificationRun.js';
import { estimateProcessing, measure } from './mediaProbe.js';
import {
  CHUNK_BYTES,
  createUploadSession,
  discardStaging,
  receiveChunk,
  setProgress,
  stagedManifest,
} from './uploadPortal.js';

/** The module is administrator-only regardless of the route map. */
function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'The certification upload portal is available to administrators only.',
    });
    return false;
  }
  return true;
}

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'webp']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg']);

export async function registerUploadPortalRoutes(app: FastifyInstance): Promise<void> {
  // Multipart is registered in its own encapsulated scope so chunk uploads do
  // not disturb JSON parsing on the rest of the API.
  await app.register(async function certificationUploadPlugin(instance) {
    await instance.register(multipart, {
      limits: {
        // A generous ceiling above the client's chunk size, so an oversized
        // chunk is rejected rather than buffered without bound.
        fileSize: CHUNK_BYTES * 4,
        files: 1,
      },
    });

    // -----------------------------------------------------------------------
    // PUT one chunk
    // -----------------------------------------------------------------------
    instance.put('/api/certification/uploads/:uploadSessionId/chunk', async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (!requireAdministrator(request, reply)) return;
      const { uploadSessionId } = request.params as { uploadSessionId: string };

      let data;
      try {
        data = await request.file();
      } catch (err) {
        return reply.code(400).send({
          error: 'Invalid upload',
          message: `The chunk could not be read: ${(err as Error).message}`,
        });
      }
      if (!data) {
        return reply.code(400).send({ error: 'Invalid upload', message: 'No chunk was included in the request.' });
      }

      const fields = data.fields as Record<string, { value?: string } | undefined>;
      const relativePath = fields.relativePath?.value;
      const declaredOffset = parseInt(fields.offset?.value ?? '0', 10);
      const totalSize = parseInt(fields.totalSize?.value ?? '0', 10);
      const lastModifiedMs = parseInt(fields.lastModified?.value ?? '0', 10);
      const isFinal = fields.isFinal?.value === 'true';

      if (!relativePath) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'The chunk did not say which file it belongs to (relativePath).',
        });
      }
      if (!Number.isFinite(declaredOffset) || declaredOffset < 0) {
        return reply.code(400).send({ error: 'Bad Request', message: 'offset must be a byte position.' });
      }
      // totalSize is the only thing that lets the server prove the transfer
      // arrived whole. Missing or unparseable, parseInt yields 0 or NaN and the
      // completion check silently does nothing — so the upload would be
      // accepted, hashed, and its hash recorded as provenance for bytes nobody
      // verified. Refuse rather than accept an unverifiable file.
      if (!Number.isFinite(totalSize) || totalSize <= 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'totalSize must be the full byte length of the file, so the server can verify the transfer arrived complete.',
        });
      }

      const result = await receiveChunk({
        uploadSessionId,
        relativePath,
        declaredOffset,
        totalSize,
        lastModifiedMs: lastModifiedMs || undefined,
        isFinal,
        stream: data.file,
        tenantId: request.user!.tenantId,
      });

      if (!result.ok) {
        return reply.code(result.status).send({
          error: result.error,
          message: result.message,
          ...(result.offset !== undefined ? { offset: result.offset } : {}),
        });
      }

      return reply.send({ offset: result.offset, complete: result.complete });
    });
  });

  // -------------------------------------------------------------------------
  // Create a session
  // -------------------------------------------------------------------------
  app.post('/api/certification/uploads', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const body = (request.body ?? {}) as {
      reference?: string;
      label?: string;
      description?: string;
      fileCount?: number;
      totalBytes?: number;
    };

    if (!body.reference || !body.label) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'A reference and a label are required before files can be sent.',
      });
    }

    const clash = await prisma.certificationCase.findUnique({ where: { reference: body.reference } });
    if (clash) {
      return reply.code(409).send({
        error: 'Conflict',
        message:
          `A certification corpus with reference "${body.reference}" already exists. ` +
          'Corpora are permanent; choose a new reference rather than overwriting one.',
      });
    }

    const session = await createUploadSession({
      reference: body.reference,
      label: body.label,
      description: body.description,
      declaredFileCount: body.fileCount ?? 0,
      declaredBytes: body.totalBytes ?? 0,
      user: { userId: request.user!.userId, tenantId: request.user!.tenantId },
    });

    return reply.code(201).send({
      uploadSessionId: session.uploadSessionId,
      chunkBytes: CHUNK_BYTES,
      status: session.status,
    });
  });

  // -------------------------------------------------------------------------
  // What the server holds — used to resume after an interruption
  // -------------------------------------------------------------------------
  app.get('/api/certification/uploads/:uploadSessionId/manifest', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadSessionId } = request.params as { uploadSessionId: string };

    const session = await prisma.certificationUploadSession.findUnique({ where: { uploadSessionId } });
    if (!session || session.tenantId !== request.user!.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such upload session.' });
    }

    const files = await stagedManifest(session.stagingDir);
    return reply.send({
      uploadSessionId,
      status: session.status,
      chunkBytes: CHUNK_BYTES,
      held: files.map((f) => ({ relativePath: f.relativePath, bytes: f.bytes })),
      heldBytes: files.reduce((s, f) => s + f.bytes, 0),
      declaredFileCount: session.declaredFileCount,
      declaredBytes: session.declaredBytes.toString(),
    });
  });

  // -------------------------------------------------------------------------
  // Live status — what the pipeline is doing right now
  // -------------------------------------------------------------------------
  app.get('/api/certification/uploads/:uploadSessionId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadSessionId } = request.params as { uploadSessionId: string };

    const session = await prisma.certificationUploadSession.findUnique({ where: { uploadSessionId } });
    if (!session || session.tenantId !== request.user!.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such upload session.' });
    }

    return reply.send({
      uploadSessionId,
      reference: session.reference,
      label: session.label,
      status: session.status,
      stage: session.stage,
      stageDetail: session.stageDetail,
      progressCurrent: session.progressCurrent,
      progressTotal: session.progressTotal,
      certificationCaseId: session.certificationCaseId,
      certificationRunId: session.certificationRunId,
      error: session.error,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    });
  });

  // -------------------------------------------------------------------------
  // Preview: what arrived, and what processing it implies
  // -------------------------------------------------------------------------
  app.get('/api/certification/uploads/:uploadSessionId/preview', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadSessionId } = request.params as { uploadSessionId: string };

    const session = await prisma.certificationUploadSession.findUnique({ where: { uploadSessionId } });
    if (!session || session.tenantId !== request.user!.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such upload session.' });
    }

    // The scratch directory must live outside the staging tree. Expanding an
    // archive into the staging directory would leave its members sitting
    // alongside the delivered files, and the import that follows would take
    // them for part of the delivery.
    const { files, warnings } = await discoverFiles(session.stagingDir, {
      expandArchives: true,
      scratchDir: path.join('/tmp', 'courtaccess-certification-preview', uploadSessionId),
    });

    if (files.length === 0) {
      return reply.code(409).send({
        error: 'Nothing uploaded',
        message: 'No files have arrived for this session yet, so there is nothing to preview.',
      });
    }

    let documents = 0;
    let videos = 0;
    let audio = 0;
    let images = 0;
    let totalPages = 0;
    let videoSeconds = 0;
    let audioSeconds = 0;
    const unmeasured: Array<{ file: string; reason: string }> = [];
    const byExtension: Record<string, number> = {};

    for (const f of files) {
      byExtension[f.extension || 'none'] = (byExtension[f.extension || 'none'] ?? 0) + 1;

      const m = await measure(f.absolutePath, f.fileName).catch(() => ({
        durationSeconds: null,
        pageCount: null,
        note: 'The file could not be measured.',
      }));

      if (VIDEO_EXT.has(f.extension)) {
        videos++;
        if (m.durationSeconds) videoSeconds += m.durationSeconds;
        else unmeasured.push({ file: f.relativePath, reason: m.note ?? 'Duration unknown.' });
      } else if (AUDIO_EXT.has(f.extension)) {
        audio++;
        if (m.durationSeconds) audioSeconds += m.durationSeconds;
        else unmeasured.push({ file: f.relativePath, reason: m.note ?? 'Duration unknown.' });
      } else if (IMAGE_EXT.has(f.extension)) {
        images++;
        totalPages += m.pageCount ?? 1;
      } else {
        documents++;
        if (m.pageCount) totalPages += m.pageCount;
        else if (m.note) unmeasured.push({ file: f.relativePath, reason: m.note });
      }
    }

    const estimate = estimateProcessing({
      documentCount: documents,
      totalPages,
      imageCount: images,
      videoSeconds,
      audioSeconds,
    });

    return reply.send({
      uploadSessionId,
      reference: session.reference,
      label: session.label,
      fileCount: files.length,
      totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
      detected: { documents, videos, audio, images, totalPages, videoSeconds, audioSeconds },
      byExtension,
      estimate,
      // Anything that could not be measured is named, not averaged away.
      unmeasured,
      warnings,
      files: files.slice(0, 1000).map((f) => ({
        relativePath: f.relativePath,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
        modifiedAt: f.modifiedAt,
        fromArchive: f.extractedFromArchive ?? null,
      })),
      truncated: files.length > 1000,
    });
  });

  // -------------------------------------------------------------------------
  // Commit: import, then run the certification, reporting progress throughout
  // -------------------------------------------------------------------------
  app.post('/api/certification/uploads/:uploadSessionId/commit', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadSessionId } = request.params as { uploadSessionId: string };

    const session = await prisma.certificationUploadSession.findUnique({ where: { uploadSessionId } });
    if (!session || session.tenantId !== request.user!.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such upload session.' });
    }
    if (session.status !== 'staging') {
      return reply.code(409).send({
        error: 'Already committed',
        message: `This upload is already ${session.status}.`,
      });
    }

    const held = await stagedManifest(session.stagingDir);
    if (held.length === 0) {
      return reply.code(409).send({
        error: 'Nothing uploaded',
        message: 'No files arrived for this session, so there is nothing to certify.',
      });
    }

    await setProgress(uploadSessionId, {
      status: 'importing',
      stage: 'Starting import',
      stageDetail: `${held.length} file(s) received`,
      progressCurrent: 0,
      progressTotal: held.length,
    });

    const user = { userId: request.user!.userId, tenantId: request.user!.tenantId };

    // The work runs in the background; the browser follows the session status.
    void (async () => {
      try {
        const imported = await importCertificationCase({
          reference: session.reference,
          label: session.label,
          description: session.description ?? undefined,
          sourceDirectory: session.stagingDir,
          expandArchives: true,
          user,
          onProgress: (u) =>
            setProgress(uploadSessionId, {
              stage: u.stage,
              stageDetail: u.detail ?? null,
              ...(u.current !== undefined ? { progressCurrent: u.current } : {}),
              ...(u.total !== undefined ? { progressTotal: u.total } : {}),
            }),
        });

        await setProgress(uploadSessionId, {
          status: 'processing',
          certificationCaseId: imported.certificationCaseId,
          stage: 'Building repositories',
          stageDetail: 'Timeline, knowledge graph, CALCRIM and contradictions',
          progressCurrent: 0,
          progressTotal: 1,
        });

        const run = await runCertification(imported.certificationCaseId);

        await setProgress(uploadSessionId, {
          status: 'completed',
          certificationRunId: run.certificationRunId,
          stage: 'Certification complete',
          stageDetail: `${run.metrics.extraction.documentsWithText} document(s) yielded text`,
          progressCurrent: 1,
          progressTotal: 1,
          completedAt: new Date(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await setProgress(uploadSessionId, {
          status: 'failed',
          stage: 'Failed',
          stageDetail: message.slice(0, 500),
          error: message.slice(0, 2000),
          completedAt: new Date(),
        });
      }
    })();

    return reply.code(202).send({
      uploadSessionId,
      status: 'importing',
      message: 'Import started. Follow progress on the upload session.',
    });
  });

  // -------------------------------------------------------------------------
  // Cancel and clean up
  // -------------------------------------------------------------------------
  app.delete('/api/certification/uploads/:uploadSessionId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadSessionId } = request.params as { uploadSessionId: string };

    const session = await prisma.certificationUploadSession.findUnique({ where: { uploadSessionId } });
    if (!session || session.tenantId !== request.user!.tenantId) {
      return reply.code(404).send({ error: 'Not Found', message: 'No such upload session.' });
    }
    if (session.status === 'importing' || session.status === 'processing') {
      return reply.code(409).send({
        error: 'In progress',
        message: 'Processing has already started for this upload and cannot be cancelled.',
      });
    }

    await discardStaging(session.stagingDir);
    await prisma.certificationUploadSession.update({
      where: { uploadSessionId },
      data: { status: 'cancelled', stage: 'Cancelled', completedAt: new Date() },
    });

    return reply.send({ uploadSessionId, status: 'cancelled' });
  });

  console.log('[Server] Certification upload portal registered (administrator only): /api/certification/uploads/*');
}

/** Exposed for the staging directory to exist before the first upload. */
export async function ensureStagingRoot(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true }).catch(() => {});
}
