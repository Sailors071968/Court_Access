// ============================================
// Court Access — Case Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createCase, listCases, getCaseById, updateCase } from '../services/caseService.js';
import { createCaseSchema } from '../utils/validationUtils.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleCreateCase(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const parsed = createCaseSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new AppError('Validation failed: ' + parsed.error.message, 400);
  }
  const result = await createCase({
    tenantId: request.user.tenantId,
    ...parsed.data,
  });
  return reply.status(201).send(result);
}

export async function handleListCases(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const result = await listCases(request.user.tenantId);
  return reply.send(result);
}

export async function handleGetCase(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const { id } = request.params as { id: string };
  const result = await getCaseById(id, request.user.tenantId);
  return reply.send(result);
}

export async function handleUpdateCase(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const result = await updateCase(id, request.user.tenantId, body);
  return reply.send(result);
}
