// ============================================================================
// Phase 3 — Evidence Request API Routes
// GET  /api/cases/:caseId/evidence-requests — List AI-detected evidence gaps
// POST /api/evidence-requests/:id/respond — Client responds to a request
// POST /api/cases/:caseId/evidence-requests/detect — Trigger gap detection
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  getEvidenceRequests,
  respondToEvidenceRequest,
  detectEvidenceGaps,
} from '../services/evidenceGapDetectionService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Valid response types
// ---------------------------------------------------------------------------

const VALID_RESPONSE_TYPES = ['requested', 'not_relevant', 'defer'] as const;

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerEvidenceRequestRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/cases/:caseId/evidence-requests — List evidence requests for a case
  app.get('/api/cases/:caseId/evidence-requests', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };
    const query = request.query as {
      status?: string;
      priority?: string;
    };

    // Verify case access (tenant isolation)
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
      console.error('[EvidenceRequestRoutes] Case access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify case access' });
    }

    try {
      const requests = await getEvidenceRequests(caseId, user.tenantId, {
        status: query.status,
        priority: query.priority,
      });

      return {
        requests,
        total: requests.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EvidenceRequestRoutes] Failed to list requests:', err);
      return reply.code(500).send({ error: 'Failed to list evidence requests', message: msg });
    }
  });

  // POST /api/evidence-requests/:id/respond — Client responds to a request
  app.post('/api/evidence-requests/:id/respond', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      responseType?: string;
      deferUntilDate?: string;
      notes?: string;
    };

    // Validate required fields
    if (!body.responseType) {
      return reply.code(400).send({
        error: 'Missing required field: responseType',
        validValues: VALID_RESPONSE_TYPES,
      });
    }

    if (!VALID_RESPONSE_TYPES.includes(body.responseType as typeof VALID_RESPONSE_TYPES[number])) {
      return reply.code(400).send({
        error: `Invalid responseType. Must be one of: ${VALID_RESPONSE_TYPES.join(', ')}`,
      });
    }

    // Validate deferUntilDate if response type is 'defer'
    let deferUntilDate: Date | undefined;
    if (body.responseType === 'defer') {
      if (!body.deferUntilDate) {
        return reply.code(400).send({
          error: 'deferUntilDate is required when responseType is "defer"',
        });
      }
      deferUntilDate = new Date(body.deferUntilDate);
      if (isNaN(deferUntilDate.getTime())) {
        return reply.code(400).send({ error: 'Invalid deferUntilDate format' });
      }
    }

    // Verify the request exists and belongs to the user's tenant
    try {
      const evidenceRequest = await prisma.evidenceRequest.findUnique({
        where: { id },
      });

      if (!evidenceRequest) {
        return reply.code(404).send({ error: 'Evidence request not found' });
      }

      if (evidenceRequest.tenantId !== user.tenantId) {
        return reply.code(403).send({ error: 'Forbidden: access denied' });
      }
    } catch (err) {
      console.error('[EvidenceRequestRoutes] Request access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify request access' });
    }

    try {
      const response = await respondToEvidenceRequest(
        id,
        user.userId,
        body.responseType as 'requested' | 'not_relevant' | 'defer',
        {
          deferUntilDate,
          notes: body.notes,
        },
      );

      return reply.code(201).send({ response });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EvidenceRequestRoutes] Failed to respond:', err);
      return reply.code(500).send({ error: 'Failed to respond to evidence request', message: msg });
    }
  });

  // POST /api/cases/:caseId/evidence-requests/detect — Trigger gap detection manually
  app.post('/api/cases/:caseId/evidence-requests/detect', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    // Verify case access
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
      console.error('[EvidenceRequestRoutes] Case access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify case access' });
    }

    try {
      const result = await detectEvidenceGaps(caseId, user.tenantId);
      return {
        ...result,
        message: 'Evidence gap detection completed',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EvidenceRequestRoutes] Gap detection failed:', err);
      return reply.code(500).send({ error: 'Gap detection failed', message: msg });
    }
  });

  console.log('[Server] Evidence request routes registered (Phase 3 — Evidence Gap Detection)');
}
