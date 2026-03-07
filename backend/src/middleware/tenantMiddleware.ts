// ============================================
// Court Access — Tenant Isolation Middleware
// ============================================

import type { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'Tenant context missing' });
    return;
  }
  next();
}

/**
 * Binary PASS/FAIL tenant boundary check.
 * Consistent with constitutional engine pattern.
 */
export function enforceTenantBoundary(
  requestTenantId: string,
  resourceTenantId: string
): 'PASS' | 'FAIL' {
  return requestTenantId === resourceTenantId ? 'PASS' : 'FAIL';
}
