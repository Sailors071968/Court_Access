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
import { requireCaseAccess, sendForbidden } from '../membership/resourceAuthMiddleware.js';
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
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

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

    // ============================================================
    // 🔒 ENFORCE CHARGES BEFORE GENERATING UPLOAD URL
    // ============================================================
    const charges = await prisma.charge.findMany({
      where: { caseId: body.caseId }
    });

    if (!charges.length) {
      return reply.code(400).send({
        error: 'No charges defined for this case',
        message: 'You must add at least one charge before uploading evidence'
      });
    }

    // Validate evidence type
    if (!VALID_EVIDENCE_TYPES.includes(body.evidenceType as EvidenceType)) {
      return reply.code(400).send({
        error: `Invalid evidenceType. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
      });
    }

    // Validate case access (permission enforcement)
    if (!(await requireCaseAccess(user, body.caseId, 'upload'))) {
      return sendForbidden(reply);
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
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

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

    // ============================================================
    // 🔒 ENFORCE CHARGES BEFORE EVIDENCE REGISTRATION
    // ============================================================
    const charges = await prisma.charge.findMany({
      where: { caseId: body.caseId }
    });

    if (!charges.length) {
      return reply.code(400).send({
        error: 'No charges defined for this case',
        message: 'You must add at least one charge before registering evidence'
      });
    }

    if (!VALID_EVIDENCE_TYPES.includes(body.evidenceType as EvidenceType)) {
      return reply.code(400).send({
        error: `Invalid evidenceType. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
      });
    }

    if (!(await requireCaseAccess(user, body.caseId, 'upload'))) {
      return sendForbidden(reply);
    }

    // Validate s3Key matches expected tenant-scoped path
    const expectedPrefix = `evidence/${user.tenantId}/${body.caseId}/`;
    if (!body.s3Key.startsWith(expectedPrefix)) {
      return reply.code(403).send({ error: 'Invalid s3Key: does not match expected tenant path' });
    }

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
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    if (!(await requireCaseAccess(user, caseId, 'view'))) {
      return sendForbidden(reply);
    }

    try {
      const evidenceList = await prisma.evidence.findMany({
        where: {
          caseId,
          tenantId: user.tenantId,
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

  // GET /api/evidence/uploads — List the tenant's uploaded evidence (for the
  // Documents/Uploads workspace). Registered BEFORE '/api/evidence/:evidenceId'
  // so the literal 'uploads' segment is not captured as an evidenceId.
  app.get('/api/evidence/uploads', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    try {
      const uploads = await prisma.evidence.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { uploadedAt: 'desc' },
        take: 200,
      });

      const fileType = (fileName: string, mimeType: string): 'pdf' | 'mp4' | 'jpg' => {
        const lower = `${fileName} ${mimeType}`.toLowerCase();
        if (lower.includes('pdf')) return 'pdf';
        if (lower.includes('mp4') || lower.includes('video')) return 'mp4';
        return 'jpg';
      };
      const status = (e: { processingStatus: string | null; analysisStatus: string | null }): 'analyzed' | 'processing' | 'pending' => {
        if (e.analysisStatus === 'complete' || e.processingStatus === 'complete') return 'analyzed';
        if (e.processingStatus === 'processing' || e.analysisStatus === 'processing') return 'processing';
        return 'pending';
      };
      const formatSize = (bytes: bigint): string => {
        const n = Number(bytes);
        if (n === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(n) / Math.log(1024));
        return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
      };

      return {
        data: uploads.map((e) => ({
          id: e.evidenceId,
          name: e.fileName,
          size: formatSize(e.size),
          date: e.uploadedAt.toISOString(),
          status: status(e),
          type: fileType(e.fileName, e.mimeType ?? ''),
        })),
      };
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to list uploads:', err);
      return reply.code(500).send({ error: 'Failed to list uploads' });
    }
  });

  // GET /api/evidence/:evidenceId — Get a single evidence record
  app.get('/api/evidence/:evidenceId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { evidenceId } = request.params as { evidenceId: string };

    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          evidenceId,
          tenantId: user.tenantId,
        },
      });

      if (!evidence) {
        return sendForbidden(reply);
      }

      if (!(await requireCaseAccess(user, evidence.caseId, 'view'))) {
        return sendForbidden(reply);
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
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { evidenceId } = request.params as { evidenceId: string };

    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          evidenceId,
          tenantId: user.tenantId,
        },
      });

      if (!evidence) {
        return sendForbidden(reply);
      }

      if (!(await requireCaseAccess(user, evidence.caseId, 'edit'))) {
        return sendForbidden(reply);
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
