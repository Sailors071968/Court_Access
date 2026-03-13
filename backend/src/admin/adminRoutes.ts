// ============================================================================
// Admin Routes — Stats, User/Case Listing, Cascading Delete Endpoints
// Roles: admin, staff only (enforced by ROUTE_PERMISSIONS in authMiddleware)
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// R2 / S3 Configuration (reused from evidenceRoutes)
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'courtaccess-evidence';

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

/** Delete all S3 objects under a given prefix with pagination (handles >1000 objects) */
async function deleteS3Prefix(prefix: string): Promise<number> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID) return 0;
  const s3 = getS3Client();
  let deleted = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const listed = await s3.send(listCmd);
      const objects = listed.Contents;
      if (!objects || objects.length === 0) break;

      const deleteCmd = new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
      });
      await s3.send(deleteCmd);
      deleted += objects.length;

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    console.error(`[AdminRoutes] Failed to delete S3 prefix ${prefix}:`, err);
  }
  return deleted;
}

/** Delete a single S3 object by key */
async function deleteS3Object(key: string): Promise<void> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !key) return;
  try {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (err) {
    console.error(`[AdminRoutes] Failed to delete S3 object ${key}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // GET /api/admin/stats — Dashboard statistics
  // =========================================================================
  app.get('/api/admin/stats', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    try {
      const [userCount, caseCount, evidenceCount] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) as count FROM users'),
        prisma.criminalCase.count({ where: { deletedAt: null } }),
        prisma.evidence.count(),
      ]);

      const totalUsers = Number(userCount[0]?.count ?? 0);

      return {
        totalUsers,
        activeCases: caseCount,
        documents: evidenceCount,
      };
    } catch (err) {
      console.error('[AdminRoutes] Failed to fetch stats:', err);
      return reply.code(500).send({ error: 'Failed to fetch stats' });
    }
  });

  // =========================================================================
  // GET /api/admin/users — List all users
  // =========================================================================
  app.get('/api/admin/users', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    try {
      const users = await prisma.$queryRawUnsafe<Array<{
        userId: string;
        name: string;
        email: string;
        role: string;
      }>>('SELECT "userId", name, email, role FROM users ORDER BY "createdAt" DESC LIMIT 200');

      return { users: users.map((u) => ({ ...u, status: 'active' })) };
    } catch (err) {
      console.error('[AdminRoutes] Failed to list users:', err);
      return reply.code(500).send({ error: 'Failed to list users' });
    }
  });

  // =========================================================================
  // GET /api/admin/cases — List all cases (cross-tenant, admin only)
  // =========================================================================
  app.get('/api/admin/cases', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    try {
      const cases = await prisma.criminalCase.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          caseId: true,
          title: true,
          status: true,
          tenantId: true,
          caseNumber: true,
          createdAt: true,
        },
      });

      return { cases };
    } catch (err) {
      console.error('[AdminRoutes] Failed to list cases:', err);
      return reply.code(500).send({ error: 'Failed to list cases' });
    }
  });

  // =========================================================================
  // DELETE /api/admin/users/:userId — Delete user + cascading cleanup
  // Deletes: user record, all their cases, all evidence (DB + R2), all
  //          narrative claims, claim validations, impeachment candidates
  // =========================================================================
  app.delete('/api/admin/users/:userId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const adminUser = request.user;
    if (!adminUser) return reply.code(401).send({ error: 'Authentication required' });

    const { userId } = request.params as { userId: string };

    // Prevent self-deletion
    if (userId === adminUser.userId) {
      return reply.code(400).send({ error: 'Cannot delete your own account' });
    }

    try {
      // 1. Look up the user to get tenantId
      const targetUser = await prisma.$queryRawUnsafe<Array<{ userId: string; tenantId: string; email: string }>>(
        'SELECT "userId", "tenantId", email FROM users WHERE "userId" = $1',
        userId,
      );

      if (!targetUser || targetUser.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const tenantId = targetUser[0].tenantId;

      // 2. Find all cases owned by this user
      const userCases = await prisma.criminalCase.findMany({
        where: { ownerId: userId, tenantId },
        select: { caseId: true },
      });
      const caseIds = userCases.map((c) => c.caseId);

      // 3. Delete R2 objects first (outside transaction — best-effort)
      //    Scope to per-case prefixes to avoid deleting other users' files in same tenant
      if (caseIds.length > 0) {
        const allEvidence = await prisma.evidence.findMany({
          where: { caseId: { in: caseIds }, tenantId },
          select: { evidenceId: true, s3Key: true },
        });
        for (const ev of allEvidence) {
          if (ev.s3Key) await deleteS3Object(ev.s3Key);
        }
        for (const cId of caseIds) {
          await deleteS3Prefix(`evidence/${tenantId}/${cId}/`);
        }
      }

      // 4. Cascading DB delete inside a transaction (atomic)
      await prisma.$transaction(async (tx) => {
        if (caseIds.length > 0) {
          await tx.impeachmentCandidate.deleteMany({ where: { caseId: { in: caseIds }, tenantId } });
          await tx.claimValidation.deleteMany({ where: { caseId: { in: caseIds }, tenantId } });
          await tx.normalizedClaimEvent.deleteMany({ where: { caseId: { in: caseIds }, tenantId } });
          await tx.narrativeClaim.deleteMany({ where: { caseId: { in: caseIds }, tenantId } });
          await tx.evidence.deleteMany({ where: { caseId: { in: caseIds }, tenantId } });
          await tx.criminalCase.deleteMany({ where: { caseId: { in: caseIds }, tenantId } });
        }
        await tx.$executeRawUnsafe('DELETE FROM users WHERE "userId" = $1', userId);
      });

      console.log(`[AdminRoutes] Admin ${adminUser.email} deleted user ${targetUser[0].email} (${userId}), ${caseIds.length} cases cascaded`);

      return {
        message: 'User deleted',
        userId,
        casesDeleted: caseIds.length,
      };
    } catch (err) {
      console.error('[AdminRoutes] Failed to delete user:', err);
      return reply.code(500).send({ error: 'Failed to delete user' });
    }
  });

  // =========================================================================
  // DELETE /api/admin/cases/:caseId — Delete case + cascading cleanup
  // Deletes: case record, all evidence (DB + R2), timeline events,
  //          narrative claims, claim validations, impeachment candidates
  // =========================================================================
  app.delete('/api/admin/cases/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };

    try {
      const caseRecord = await prisma.criminalCase.findUnique({
        where: { caseId },
        select: { caseId: true, tenantId: true, title: true },
      });

      if (!caseRecord) {
        return reply.code(404).send({ error: 'Case not found' });
      }

      const { tenantId } = caseRecord;

      // 1. Delete R2 objects first (outside transaction — best-effort)
      const allEvidence = await prisma.evidence.findMany({
        where: { caseId, tenantId },
        select: { evidenceId: true, s3Key: true },
      });
      for (const ev of allEvidence) {
        if (ev.s3Key) await deleteS3Object(ev.s3Key);
      }
      await deleteS3Prefix(`evidence/${tenantId}/${caseId}/`);

      // 2. Cascading DB delete inside a transaction (atomic)
      await prisma.$transaction(async (tx) => {
        await tx.impeachmentCandidate.deleteMany({ where: { caseId, tenantId } });
        await tx.claimValidation.deleteMany({ where: { caseId, tenantId } });
        await tx.normalizedClaimEvent.deleteMany({ where: { caseId, tenantId } });
        await tx.narrativeClaim.deleteMany({ where: { caseId, tenantId } });
        await tx.evidence.deleteMany({ where: { caseId, tenantId } });
        await tx.criminalCase.delete({ where: { caseId } });
      });

      console.log(`[AdminRoutes] Admin ${user.email} deleted case "${caseRecord.title}" (${caseId})`);

      return {
        message: 'Case deleted',
        caseId,
        evidenceDeleted: allEvidence.length,
      };
    } catch (err) {
      console.error('[AdminRoutes] Failed to delete case:', err);
      return reply.code(500).send({ error: 'Failed to delete case' });
    }
  });

  // =========================================================================
  // DELETE /api/admin/evidence/:evidenceId — Delete single evidence + R2
  // =========================================================================
  app.delete('/api/admin/evidence/:evidenceId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { evidenceId } = request.params as { evidenceId: string };

    try {
      const evidence = await prisma.evidence.findUnique({
        where: { evidenceId },
        select: { evidenceId: true, s3Key: true, fileName: true },
      });

      if (!evidence) {
        return reply.code(404).send({ error: 'Evidence not found' });
      }

      // Delete S3 object
      if (evidence.s3Key) {
        await deleteS3Object(evidence.s3Key);
      }

      // Delete DB record
      await prisma.evidence.delete({ where: { evidenceId } });

      console.log(`[AdminRoutes] Admin ${user.email} deleted evidence "${evidence.fileName}" (${evidenceId})`);

      return { message: 'Evidence deleted', evidenceId };
    } catch (err) {
      console.error('[AdminRoutes] Failed to delete evidence:', err);
      return reply.code(500).send({ error: 'Failed to delete evidence' });
    }
  });
}
