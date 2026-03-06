// ============================================
// Court Access — Authentication Middleware
// Phase 36/40: JWT-based auth + tenant isolation
// ============================================

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../services/prismaClient.js';

/**
 * Authenticate a request using JWT Bearer token.
 * Sets req.user with the authenticated user record.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    // Set tenant header for downstream services
    req.headers['x-tenant-id'] = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — sets req.user if token present, continues regardless.
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      req.user = jwt.verify(token, config.jwtSecret);
      req.headers['x-tenant-id'] = req.user.id;
    } catch {
      // Invalid token — continue without user
    }
  }
  next();
}

/**
 * Require a specific role.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '24h' }
  );
}

/**
 * Audit log middleware — logs access to protected resources.
 */
export function auditLog(action) {
  return async (req, res, next) => {
    if (req.user) {
      try {
        await prisma.userAuditLog.create({
          data: {
            userId: req.user.id,
            action,
            resource: req.params.caseId || req.params.evidenceId || '',
            ipAddress: req.ip || req.connection?.remoteAddress || '',
            metadata: {
              method: req.method,
              path: req.originalUrl,
            },
          },
        });
      } catch {
        // Don't block request if audit log fails
      }
    }
    next();
  };
}
