// ============================================================================
// Core Evidence System — Evidence API (Parts 2-4)
// Presigned upload URL, evidence metadata CRUD, tenant isolation.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { getRequestContext } from '../security/authMiddleware.js';
import { validateEvidenceUpload } from './evidenceValidation.js';
import { enqueueEvidenceIngestion } from './evidenceProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Cloudflare R2 Configuration (S3-compatible)
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'courtaccess-evidence';
const PRESIGN_EXPIRY_SECONDS = 3600; // 1 hour

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// ---------------------------------------------------------------------------
// Evidence Types
// ---------------------------------------------------------------------------

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

const VIDEO_EVIDENCE_TYPES: EvidenceType[] = ['bodycam', 'dashcam', 'witness_video'];

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerEvidenceRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/evidence/upload-url — Generate presigned S3 upload URL (Part 3)
  app.post('/api/evidence/upload-url', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(request);
    if (!ctx) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const user = request.user!;

    const body = request.body as {
      caseId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      evidenceType: string;
    };

    // Validate required fields
    if (!body.caseId || !body.fileName || !body.fileType || !body.fileSize || !body.evidenceType) {
      return reply.code(400).send({
        error: 'Missing required fields',
        required: ['caseId', 'fileName', 'fileType', 'fileSize', 'evidenceType'],
      });
    }

    // Validate evidence type
    if (!VALID_EVIDENCE_TYPES.includes(body.evidenceType as EvidenceType)) {
      return reply.code(400).send({
        error: `Invalid evidenceType. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
      });
    }

    // Validate case access (tenant isolation)
    try {
      const caseRecord = await prisma.criminalCase.findFirst({
        where: {
          caseId: body.caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!caseRecord) {
        return reply.code(403).send({ error: 'Forbidden: case not found or access denied' });
      }
    } catch (err) {
      console.error('[EvidenceRoutes] Case access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify case access' });
    }

    // Validate evidence upload limits
    const validation = await validateEvidenceUpload(user.tenantId, body.caseId, body.fileSize, body.evidenceType);
    if (!validation.allowed) {
      return reply.code(validation.statusCode).send({
        error: validation.error,
        limit: validation.limit,
        current: validation.current,
      });
    }

    // Generate S3 key and presigned URL
    const fileId = crypto.randomUUID();
    const s3Key = `evidence/${user.tenantId}/${body.caseId}/${fileId}/${body.fileName}`;

    try {
      const s3 = getS3Client();
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: s3Key,
        ContentType: body.fileType,
        ContentLength: body.fileSize,
        Metadata: {
          tenantId: user.tenantId,
          caseId: body.caseId,
          evidenceType: body.evidenceType,
          uploadedBy: user.userId,
        },
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });

      return {
        uploadUrl,
        fileId,
        s3Key,
        expiresIn: PRESIGN_EXPIRY_SECONDS,
      };
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to generate presigned URL:', err);
      return reply.code(500).send({ error: 'Failed to generate upload URL' });
    }
  });

  // POST /api/evidence — Register evidence metadata (Part 4)
  app.post('/api/evidence', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(request);
    if (!ctx) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const user = request.user!;

    const body = request.body as {
      caseId: string;
      fileName: string;
      mimeType?: string;
      size: number;
      duration?: number;
      pageCount?: number;
      evidenceType: string;
      s3Key: string;
    };

    // Validate required fields
    if (!body.caseId || !body.fileName || !body.size || !body.evidenceType || !body.s3Key) {
      return reply.code(400).send({
        error: 'Missing required fields',
        required: ['caseId', 'fileName', 'size', 'evidenceType', 's3Key'],
      });
    }

    if (!VALID_EVIDENCE_TYPES.includes(body.evidenceType as EvidenceType)) {
      return reply.code(400).send({
        error: `Invalid evidenceType. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
      });
    }

    // Verify case access
    try {
      const caseRecord = await prisma.criminalCase.findFirst({
        where: {
          caseId: body.caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!caseRecord) {
        return reply.code(403).send({ error: 'Forbidden: case not found or access denied' });
      }
    } catch (err) {
      console.error('[EvidenceRoutes] Case access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify case access' });
    }

    // Validate s3Key matches expected tenant-scoped path (prevent cross-tenant access)
    const expectedPrefix = `evidence/${user.tenantId}/${body.caseId}/`;
    if (!body.s3Key.startsWith(expectedPrefix)) {
      return reply.code(403).send({ error: 'Invalid s3Key: does not match expected tenant path' });
    }

    // Create DB record first
    let evidence;
    try {
      evidence = await prisma.evidence.create({
        data: {
          caseId: body.caseId,
          tenantId: user.tenantId,
          fileName: body.fileName,
          mimeType: body.mimeType ?? null,
          size: BigInt(body.size),
          duration: body.duration ?? null,
          pageCount: body.pageCount ?? null,
          evidenceType: body.evidenceType,
          s3Key: body.s3Key,
          uploadedBy: user.userId,
        },
      });
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to create evidence record:', err);
      return reply.code(500).send({ error: 'Failed to register evidence' });
    }

    // Enqueue evidence processing (Part 5) — separate try-catch so a queue
    // failure doesn't mask the successful DB insert or return a misleading 500.
    let processingWarning: string | undefined;
    try {
      await enqueueEvidenceIngestion({
        evidenceId: evidence.evidenceId,
        caseId: body.caseId,
        tenantId: user.tenantId,
        fileName: body.fileName,
        evidenceType: body.evidenceType,
        s3Key: body.s3Key,
        size: body.size,
        isVideo: VIDEO_EVIDENCE_TYPES.includes(body.evidenceType as EvidenceType),
      });
    } catch (queueErr) {
      console.error('[EvidenceRoutes] Failed to enqueue processing (record saved):', queueErr);
      processingWarning = 'Evidence registered but processing could not be started. It will be retried automatically.';
    }

    // Serialize BigInt for JSON response
    return reply.code(201).send({
      evidence: {
        ...evidence,
        size: evidence.size.toString(),
      },
      ...(processingWarning ? { warning: processingWarning } : {}),
    });
  });

  // GET /api/cases/:caseId/evidence — List evidence for a case
  app.get('/api/cases/:caseId/evidence', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(request);
    if (!ctx) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    // Verify case access
    let caseRecord;
    try {
      caseRecord = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
      });
    } catch (err) {
      console.error('[EvidenceRoutes] Case access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify case access' });
    }

    if (!caseRecord) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const evidenceList = await prisma.evidence.findMany({
        where: {
          caseId,
          tenantId: ctx.tenantId,
        },
        orderBy: {
          uploadedAt: 'desc',
        },
      });

      // Serialize BigInt for JSON response
      return {
        evidence: evidenceList.map((e) => ({
          ...e,
          size: e.size.toString(),
        })),
      };
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to list evidence:', err);
      return reply.code(500).send({ error: 'Failed to list evidence' });
    }
  });

  // GET /api/evidence/:evidenceId — Get a single evidence record
  app.get('/api/evidence/:evidenceId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(request);
    if (!ctx) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { evidenceId } = request.params as { evidenceId: string };

    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          evidenceId,
          tenantId: ctx.tenantId,
        },
      });

      if (!evidence) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return {
        evidence: {
          ...evidence,
          size: evidence.size.toString(),
        },
      };
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to get evidence:', err);
      return reply.code(500).send({ error: 'Failed to get evidence' });
    }
  });

  // DELETE /api/evidence/:evidenceId — Delete evidence record
  app.delete('/api/evidence/:evidenceId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(request);
    if (!ctx) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { evidenceId } = request.params as { evidenceId: string };

    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          evidenceId,
          tenantId: ctx.tenantId,
        },
      });

      if (!evidence) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Delete S3 object first, then DB record
      try {
        const s3 = getS3Client();
        const deleteCommand = new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: evidence.s3Key ?? undefined,
        });
        await s3.send(deleteCommand);
      } catch (s3Err) {
        console.error('[EvidenceRoutes] Failed to delete S3 object (proceeding with DB delete):', s3Err);
        // Continue with DB deletion even if S3 fails — log for manual cleanup
      }

      await prisma.evidence.delete({
        where: { evidenceId },
      });

      return { message: 'Evidence deleted', evidenceId };
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to delete evidence:', err);
      return reply.code(500).send({ error: 'Failed to delete evidence' });
    }
  });
}
