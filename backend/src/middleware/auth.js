// ============================================
// Court Access — Authentication Middleware
// Phase 36/40/96I: JWT-based auth + tenant isolation + refresh tokens
// ============================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import prisma from '../services/prismaClient.js';

// Phase 96I: Token expiration constants
const ACCESS_TOKEN_EXPIRY = '15m';   // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days

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
 * Generate an access token (short-lived, 15 minutes).
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
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Phase 96I: Generate a refresh token (long-lived, 7 days).
 * Stores a SHA-256 hash of the token in the database.
 * Returns the raw token string (sent to client).
 */
export async function generateRefreshToken(userId) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Phase 96I: Verify a refresh token.
 * Returns the database record if valid, null otherwise.
 */
export async function verifyRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.revoked) return null;
  if (new Date() > record.expiresAt) return null;

  return record;
}

/**
 * Phase 96I: Revoke a refresh token.
 */
export async function revokeRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

/**
 * Phase 96I: Revoke all refresh tokens for a user.
 */
export async function revokeAllUserRefreshTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
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
