// ============================================================================
// Admin Routes — Stats, User/Case Listing, Cascading Delete Endpoints
// Roles: admin, staff only (enforced by ROUTE_PERMISSIONS in authMiddleware)
// Uses raw SQL to avoid Prisma model generation dependency.
// DB tables: "User" (id, email, name, role, ...), "Case" (id, userId, caseName, ...),
//            "EvidenceRecord" (id, caseId, storageKey, filename, ...)
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { collectBillingReadinessMetrics } from '../billing/billingMetricsService.js';

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
  // GET /api/admin/billing/metrics — Stripe billing readiness metrics
  // =========================================================================
  app.get('/api/admin/billing/metrics', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    try {
      const metrics = await collectBillingReadinessMetrics();
      return metrics;
    } catch (err) {
      console.error('[AdminRoutes] Failed to fetch billing metrics:', err);
      return reply.code(500).send({ error: 'Failed to fetch billing metrics' });
    }
  });

  // =========================================================================
  // GET /api/admin/stats — Dashboard statistics
  // =========================================================================
  app.get('/api/admin/stats', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    try {
      const [userRows, caseRows, evidenceRows] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) as count FROM "User"'),
        prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) as count FROM "Case"'),
        prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) as count FROM "EvidenceRecord"'),
      ]);

      return {
        totalUsers: Number(userRows[0]?.count ?? 0),
        activeCases: Number(caseRows[0]?.count ?? 0),
        documents: Number(evidenceRows[0]?.count ?? 0),
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
        id: string;
        name: string;
        email: string;
        role: string;
        status: string | null;
      }>>('SELECT id, name, email, role, status FROM "User" ORDER BY "createdAt" DESC LIMIT 200');

      return { users: users.map((u) => ({ userId: u.id, name: u.name, email: u.email, role: u.role, status: u.status || 'active' })) };
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
      const cases = await prisma.$queryRawUnsafe<Array<{
        id: string;
        userId: string;
        caseName: string;
        caseNumber: string;
        status: string;
        createdAt: Date;
      }>>('SELECT id, "userId", "caseName", "caseNumber", status, "createdAt" FROM "Case" ORDER BY "createdAt" DESC LIMIT 200');

      return {
        cases: cases.map((c) => ({
          caseId: c.id,
          title: c.caseName,
          status: c.status,
          caseNumber: c.caseNumber,
          ownerId: c.userId,
          createdAt: c.createdAt,
        })),
      };
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

    // Prevent staff from deleting admin users (role hierarchy)
    if (adminUser.role !== 'admin') {
      const targetCheck = await prisma.$queryRawUnsafe<Array<{ role: string }>>(
        'SELECT role FROM "User" WHERE id = $1',
        userId,
      );
      if (targetCheck?.[0]?.role === 'admin') {
        return reply.code(403).send({ error: 'Only admins can delete other admin accounts' });
      }
    }

    try {
      // 1. Look up the user
      const targetUser = await prisma.$queryRawUnsafe<Array<{ id: string; email: string }>>(
        'SELECT id, email FROM "User" WHERE id = $1',
        userId,
      );

      if (!targetUser || targetUser.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // 2. Find all cases owned by this user
      const userCases = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM "Case" WHERE "userId" = $1',
        userId,
      );
      const caseIds = userCases.map((c) => c.id);

      // 3. Delete R2 objects first (outside transaction — best-effort)
      if (caseIds.length > 0) {
        const placeholders = caseIds.map((_, i) => `$${i + 1}`).join(',');
        const allEvidence = await prisma.$queryRawUnsafe<Array<{ id: string; storageKey: string | null }>>(
          `SELECT id, "storageKey" FROM "EvidenceRecord" WHERE "caseId" IN (${placeholders})`,
          ...caseIds,
        );
        for (const ev of allEvidence) {
          if (ev.storageKey) await deleteS3Object(ev.storageKey);
        }
        for (const cId of caseIds) {
          await deleteS3Prefix(`evidence/${cId}/`);
        }
      }

      // 4. Cascading DB delete (evidence -> cases -> user)
      if (caseIds.length > 0) {
        const placeholders = caseIds.map((_, i) => `$${i + 1}`).join(',');
        await prisma.$executeRawUnsafe(
          `DELETE FROM "EvidenceRecord" WHERE "caseId" IN (${placeholders})`,
          ...caseIds,
        );
        await prisma.$executeRawUnsafe('DELETE FROM "Case" WHERE "userId" = $1', userId);
      }
      await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', userId);

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
      const caseRecord = await prisma.$queryRawUnsafe<Array<{ id: string; caseName: string; userId: string }>>(
        'SELECT id, "caseName", "userId" FROM "Case" WHERE id = $1',
        caseId,
      );

      if (!caseRecord || caseRecord.length === 0) {
        return reply.code(404).send({ error: 'Case not found' });
      }

      // 1. Delete R2 objects first (outside transaction — best-effort)
      const allEvidence = await prisma.$queryRawUnsafe<Array<{ id: string; storageKey: string | null }>>(
        'SELECT id, "storageKey" FROM "EvidenceRecord" WHERE "caseId" = $1',
        caseId,
      );
      for (const ev of allEvidence) {
        if (ev.storageKey) await deleteS3Object(ev.storageKey);
      }
      await deleteS3Prefix(`evidence/${caseId}/`);

      // 2. Cascading DB delete (evidence -> case)
      await prisma.$executeRawUnsafe('DELETE FROM "EvidenceRecord" WHERE "caseId" = $1', caseId);
      await prisma.$executeRawUnsafe('DELETE FROM "Case" WHERE id = $1', caseId);

      console.log(`[AdminRoutes] Admin ${user.email} deleted case "${caseRecord[0].caseName}" (${caseId})`);

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
      const evidence = await prisma.$queryRawUnsafe<Array<{ id: string; storageKey: string | null; filename: string }>>(
        'SELECT id, "storageKey", filename FROM "EvidenceRecord" WHERE id = $1',
        evidenceId,
      );

      if (!evidence || evidence.length === 0) {
        return reply.code(404).send({ error: 'Evidence not found' });
      }

      // Delete S3 object
      if (evidence[0].storageKey) {
        await deleteS3Object(evidence[0].storageKey);
      }

      // Delete DB record
      await prisma.$executeRawUnsafe('DELETE FROM "EvidenceRecord" WHERE id = $1', evidenceId);

      console.log(`[AdminRoutes] Admin ${user.email} deleted evidence "${evidence[0].filename}" (${evidenceId})`);

      return { message: 'Evidence deleted', evidenceId };
    } catch (err) {
      console.error('[AdminRoutes] Failed to delete evidence:', err);
      return reply.code(500).send({ error: 'Failed to delete evidence' });
    }
  });
}
