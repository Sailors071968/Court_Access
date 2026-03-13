// ============================================================================
// Core Evidence System — Evidence API (Parts 2-4)
// Presigned upload URL, evidence metadata CRUD, tenant isolation.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { validateEvidenceUpload } from './evidenceValidation.js';
import { enqueueEvidenceIngestion } from './evidenceProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// S3 Configuration
// ---------------------------------------------------------------------------

const S3_BUCKET = process.env.S3_EVIDENCE_BUCKET || 'courtaccess-evidence';
const S3_REGION = process.env.S3_REGION || 'us-west-2';
const PRESIGN_EXPIRY_SECONDS = 3600; // 1 hour

function getS3Client(): S3Client {
  return new S3Client({
    region: S3_REGION,
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
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
        Bucket: S3_BUCKET,
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

    try {
      const evidence = await prisma.evidence.create({
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

      // Enqueue evidence processing (Part 5)
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

      // Serialize BigInt for JSON response
      return reply.code(201).send({
        evidence: {
          ...evidence,
          size: evidence.size.toString(),
        },
      });
    } catch (err) {
      console.error('[EvidenceRoutes] Failed to create evidence record:', err);
      return reply.code(500).send({ error: 'Failed to register evidence' });
    }
  });

  // GET /api/cases/:caseId/evidence — List evidence for a case
  app.get('/api/cases/:caseId/evidence', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    // Verify case access
    const caseRecord = await prisma.criminalCase.findFirst({
      where: {
        caseId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!caseRecord) {
      return reply.code(403).send({ error: 'Forbidden' });
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
        return reply.code(403).send({ error: 'Forbidden' });
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
