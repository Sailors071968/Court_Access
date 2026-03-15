// ============================================================================
// CourtAccess — Discount Code API Routes (Fastify)
// Backend-managed discount codes with CRUD + public validation endpoint.
// Replaces the localStorage-only approach so codes work across all browsers.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  createDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
  deleteDiscountCode,
} from '../models/discountCode.js';
import {
  validateDiscountCode,
  applyDiscountCode,
} from './discountService.js';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerDiscountRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // Public — Validate a discount code (used during registration)
  // =========================================================================

  // GET /api/discount-codes/validate?code=HUNT100
  app.get('/api/discount-codes/validate', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.code(400).send({ valid: false, errorReason: 'No discount code provided' });
    }
    const result = await validateDiscountCode(code);
    return reply.send(result);
  });

  // =========================================================================
  // Admin — Full CRUD for discount codes
  // =========================================================================

  // GET /api/admin/discount-codes — list all codes (admin/staff only)
  app.get('/api/admin/discount-codes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      return reply.code(403).send({ error: 'Admin or staff access required' });
    }
    const codes = await getDiscountCodes();
    return { codes };
  });

  // POST /api/admin/discount-codes — create a new discount code
  app.post('/api/admin/discount-codes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      return reply.code(403).send({ error: 'Admin or staff access required' });
    }

    const body = request.body as {
      codeName: string;
      codeValue: string;
      discountType: 'percent' | 'fixed';
      discountValue: number;
      active?: boolean;
      usageLimit?: number | null;
      expiresAt?: string | null;
    };

    if (!body.codeName || !body.codeValue || !body.discountType || body.discountValue == null) {
      return reply.code(400).send({
        error: 'Missing required fields',
        required: ['codeName', 'codeValue', 'discountType', 'discountValue'],
      });
    }

    try {
      const code = await createDiscountCode({
        codeName: body.codeName,
        codeValue: body.codeValue,
        discountType: body.discountType,
        discountValue: body.discountValue,
        active: body.active !== false,
        usageLimit: body.usageLimit ?? null,
        expiresAt: body.expiresAt ?? null,
      });
      console.log(`[DiscountRoutes] Created discount code: ${code.codeValue} (${code.codeId})`);
      return reply.code(201).send({ code });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create discount code';
      return reply.code(409).send({ error: message });
    }
  });

  // PATCH /api/admin/discount-codes/:codeId — update a discount code
  app.patch('/api/admin/discount-codes/:codeId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      return reply.code(403).send({ error: 'Admin or staff access required' });
    }

    const { codeId } = request.params as { codeId: string };
    const body = request.body as Record<string, unknown>;

    // Only pick allowed fields to prevent overwriting protected fields (usageCount, codeId, createdAt)
    const sanitized: Partial<Pick<import('../models/discountCode.js').DiscountCode, 'codeName' | 'codeValue' | 'active' | 'expiresAt' | 'usageLimit' | 'discountValue' | 'discountType'>> = {};
    if (body.codeName !== undefined) sanitized.codeName = body.codeName as string;
    if (body.codeValue !== undefined && typeof body.codeValue === 'string') sanitized.codeValue = body.codeValue.toUpperCase();
    if (body.active !== undefined) sanitized.active = body.active as boolean;
    if (body.expiresAt !== undefined) sanitized.expiresAt = body.expiresAt as string | null;
    if (body.usageLimit !== undefined) sanitized.usageLimit = body.usageLimit as number | null;
    if (body.discountValue !== undefined) sanitized.discountValue = body.discountValue as number;
    if (body.discountType !== undefined) sanitized.discountType = body.discountType as 'percent' | 'fixed';

    try {
      const updated = await updateDiscountCode(codeId, sanitized);
      if (!updated) {
        return reply.code(404).send({ error: 'Discount code not found' });
      }

      console.log(`[DiscountRoutes] Updated discount code: ${updated.codeValue} (${codeId})`);
      return { code: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update discount code';
      return reply.code(409).send({ error: message });
    }
  });

  // DELETE /api/admin/discount-codes/:codeId — delete a discount code
  app.delete('/api/admin/discount-codes/:codeId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      return reply.code(403).send({ error: 'Admin or staff access required' });
    }

    const { codeId } = request.params as { codeId: string };
    try {
      const deleted = await deleteDiscountCode(codeId);
      if (!deleted) {
        return reply.code(404).send({ error: 'Discount code not found' });
      }

      console.log(`[DiscountRoutes] Deleted discount code: ${codeId}`);
      return { message: 'Discount code deleted', codeId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cannot delete discount code with existing usage records';
      return reply.code(409).send({ error: message });
    }
  });

  // POST /api/discount-codes/apply — apply a code (authenticated, deducts usage)
  app.post('/api/discount-codes/apply', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { code } = request.body as { code?: string };
    if (!code) {
      return reply.code(400).send({ valid: false, errorReason: 'No discount code provided' });
    }

    const result = await applyDiscountCode(code, user.userId);
    return reply.send(result);
  });
}
