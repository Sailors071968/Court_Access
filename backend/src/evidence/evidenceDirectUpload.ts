// ============================================================================
// Evidence Direct Upload — Multipart file upload endpoint
// Accepts multipart form data, stores file to local disk (or R2 if configured),
// creates Evidence DB record, and runs text extraction + chunking asynchronously.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { validateEvidenceUpload } from './evidenceValidation.js';
import { guessMimeType } from './evidenceContentExtractor.js';
import { processEvidenceFromLocalFile } from './evidenceProcessingService.js';
import prisma from '../lib/prisma.js';

const UPLOAD_DIR = process.env.EVIDENCE_UPLOAD_DIR || '/var/www/courtaccess/uploads/evidence';
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const VALID_EVIDENCE_TYPES = [
  'transcript',
  'police_report',
  'bodycam',
  'dashcam',
  'witness_video',
  'photo',
  'dispatch_log',
  'forensic_report',
  'autopsy_report',
  'other_document',
] as const;

type EvidenceType = typeof VALID_EVIDENCE_TYPES[number];

function serializeEvidence(evidence: {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  mimeType: string | null;
  size: bigint;
  evidenceType: string;
  s3Key: string | null;
  uploadedBy: string;
  uploadedAt: Date;
  processingStatus: string;
  processingError: string | null;
  multiplexDetected: boolean;
  multiplexCount: number | null;
  normalizedPageCount: number | null;
  acuCost: number | null;
  acuConsumed: number;
  analysisStatus: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    evidenceId: evidence.evidenceId,
    caseId: evidence.caseId,
    tenantId: evidence.tenantId,
    fileName: evidence.fileName,
    mimeType: evidence.mimeType,
    size: evidence.size.toString(),
    evidenceType: evidence.evidenceType,
    s3Key: evidence.s3Key,
    uploadedBy: evidence.uploadedBy,
    uploadedAt: evidence.uploadedAt,
    processingStatus: evidence.processingStatus,
    processingError: evidence.processingError,
    multiplexDetected: evidence.multiplexDetected,
    multiplexCount: evidence.multiplexCount,
    normalizedPageCount: evidence.normalizedPageCount,
    acuCost: evidence.acuCost,
    acuConsumed: evidence.acuConsumed,
    analysisStatus: evidence.analysisStatus,
    createdAt: evidence.createdAt,
    updatedAt: evidence.updatedAt,
  };
}

export async function registerDirectUploadRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async function uploadPlugin(instance) {
    await instance.register(multipart, {
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
      },
    });

    instance.post('/api/evidence/upload', async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      let data;
      try {
        data = await request.file();
      } catch (err) {
        console.error('[DirectUpload] Failed to parse multipart:', err);
        return reply.code(400).send({ error: 'Invalid multipart upload' });
      }

      if (!data) {
        return reply.code(400).send({ error: 'No file provided' });
      }

      const fields = data.fields as Record<string, { value?: string } | undefined>;
      const caseId = fields.caseId?.value;
      const evidenceType = fields.evidenceType?.value || 'other_document';

      if (!caseId) {
        return reply.code(400).send({ error: 'Missing required field: caseId' });
      }

      if (!VALID_EVIDENCE_TYPES.includes(evidenceType as EvidenceType)) {
        return reply.code(400).send({
          error: `Invalid evidenceType. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
        });
      }

      try {
        const caseRecord = await prisma.criminalCase.findFirst({
          where: {
            caseId,
            tenantId: user.tenantId,
            deletedAt: null,
          },
        });
        if (!caseRecord) {
          return reply.code(403).send({ error: 'Forbidden: case not found or access denied' });
        }
      } catch (err) {
        console.error('[DirectUpload] Case access check failed:', err);
        return reply.code(500).send({ error: 'Failed to verify case access' });
      }

      const fileId = crypto.randomUUID();
      const rawFileName = data.filename || 'unnamed-file';
      const fileName = path.basename(rawFileName).replace(/\.\./g, '_');
      const mimeType = data.mimetype || guessMimeType(fileName);

      const uploadDir = path.join(UPLOAD_DIR, user.tenantId, caseId);
      await fs.mkdir(uploadDir, { recursive: true });

      const localPath = path.join(uploadDir, `${fileId}_${fileName}`);
      const resolvedLocal = path.resolve(localPath);
      const resolvedBase = path.resolve(UPLOAD_DIR);
      if (!resolvedLocal.startsWith(resolvedBase + path.sep)) {
        return reply.code(400).send({ error: 'Invalid filename' });
      }

      const s3Key = `evidence/${user.tenantId}/${caseId}/${fileId}/${fileName}`;

      let fileSize = 0;
      try {
        const writeStream = createWriteStream(localPath);
        await pipeline(data.file, writeStream);
        if (data.file.truncated) {
          await fs.unlink(localPath).catch(() => {});
          return reply.code(413).send({
            error: 'File too large',
            message: `File exceeds maximum upload size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            maxSize: MAX_FILE_SIZE,
          });
        }
        const stat = await fs.stat(localPath);
        fileSize = stat.size;
      } catch (err) {
        console.error('[DirectUpload] Failed to save file:', err);
        await fs.unlink(localPath).catch(() => {});
        if (err && ((err as { code?: string }).code === 'FST_FILES_LIMIT' || (err as Error)?.message?.includes('Too Large'))) {
          return reply.code(413).send({ error: 'File too large', maxSize: MAX_FILE_SIZE });
        }
        return reply.code(500).send({ error: 'Failed to save uploaded file' });
      }

      const validation = await validateEvidenceUpload(user.tenantId, caseId, fileSize, evidenceType);
      if (!validation.allowed) {
        await fs.unlink(localPath).catch(() => {});
        return reply.code(validation.statusCode).send({
          error: validation.error,
          limit: validation.limit,
          current: validation.current,
        });
      }

      let evidence;
      try {
        evidence = await prisma.evidence.create({
          data: {
            caseId,
            tenantId: user.tenantId,
            fileName,
            mimeType,
            size: BigInt(fileSize),
            evidenceType,
            s3Key,
            uploadedBy: user.userId,
            processingStatus: 'ingesting',
            analysisStatus: 'processing',
          },
        });
      } catch (err) {
        console.error('[DirectUpload] Failed to create evidence record:', err);
        await fs.unlink(localPath).catch(() => {});
        return reply.code(500).send({ error: 'Failed to register evidence' });
      }

      console.log(`[DirectUpload] Evidence ${evidence.evidenceId} saved: ${fileName} (${fileSize} bytes)`);

      processEvidenceFromLocalFile(evidence.evidenceId, user.tenantId, localPath, mimeType).catch((err) => {
        console.error(`[DirectUpload] Background processing failed for ${evidence.evidenceId}:`, err);
      });

      return reply.code(201).send({
        evidence: serializeEvidence(evidence),
      });
    });
  });

  console.log('[Server] Direct evidence upload route registered: POST /api/evidence/upload');
}
