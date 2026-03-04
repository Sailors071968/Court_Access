// ============================================
// Court Access — Auth Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerUser, loginUser, getCurrentUser } from '../services/authService.js';
import { registerSchema, loginSchema } from '../utils/validationUtils.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new AppError('Validation failed: ' + parsed.error.message, 400);
  }
  const result = await registerUser(parsed.data);
  return reply.status(201).send(result);
}

export async function handleLogin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new AppError('Validation failed: ' + parsed.error.message, 400);
  }
  const result = await loginUser(parsed.data);
  return reply.send(result);
}

export async function handleLogout(_request: FastifyRequest, reply: FastifyReply) {
  // JWT is stateless — client discards token
  return reply.send({ message: 'Logged out' });
}

export async function handleMe(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    throw new AppError('Authentication required', 401);
  }
  const user = await getCurrentUser(request.user.userId);
  return reply.send(user);
}
