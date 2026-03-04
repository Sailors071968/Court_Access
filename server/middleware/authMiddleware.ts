// ============================================
// Court Access — Auth Middleware (JWT)
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Authenticate request via JWT Bearer token.
 */
export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    request.user = decoded;
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

/**
 * Require specific role(s).
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError('Authentication required', 401);
    }
    if (!roles.includes(request.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
  };
}
