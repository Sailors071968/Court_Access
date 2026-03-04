// ============================================
// Court Access — User Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getUserProfile, updateUserProfile } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleGetProfile(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const profile = await getUserProfile(request.user.userId, request.user.tenantId);
  return reply.send(profile);
}

export async function handleUpdateProfile(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const body = request.body as { name?: string; phone?: string; smsEnabled?: boolean };
  const updated = await updateUserProfile(request.user.userId, request.user.tenantId, body);
  return reply.send(updated);
}
