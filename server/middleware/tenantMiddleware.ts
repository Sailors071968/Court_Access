// ============================================
// Court Access — Tenant Isolation Middleware
// Enforces tenant boundary on every request.
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errorHandler.js';

/**
 * Ensure authenticated user has a valid tenantId.
 * Must run after authMiddleware.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    throw new AppError('Authentication required', 401);
  }
  if (!request.user.tenantId) {
    throw new AppError('Tenant context missing', 403);
  }
}

/**
 * Validate that a resource belongs to the requesting tenant.
 * Binary PASS/FAIL — consistent with constitutional engine pattern.
 */
export function enforceTenantBoundary(
  requestTenantId: string,
  resourceTenantId: string
): 'PASS' | 'FAIL' {
  return requestTenantId === resourceTenantId ? 'PASS' : 'FAIL';
}
