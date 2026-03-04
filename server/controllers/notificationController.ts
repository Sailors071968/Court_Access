// ============================================
// Court Access — Notification Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { listNotifications } from '../services/notificationService.js';
import { sendSms } from '../services/twilioService.js';
import { sendEmail } from '../services/emailService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleSendSms(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);

  const { to, message, type } = request.body as { to: string; message: string; type?: string };
  if (!to || !message) throw new AppError('to and message are required', 400);

  const result = await sendSms({
    tenantId: request.user.tenantId,
    userId: request.user.userId,
    to,
    message,
    type: type || 'manual',
  });

  return reply.send(result);
}

export async function handleSendEmail(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);

  const { to, subject, bodyHtml, bodyText, type } = request.body as {
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    type?: string;
  };
  if (!to || !subject) throw new AppError('to and subject are required', 400);

  const result = await sendEmail({
    tenantId: request.user.tenantId,
    userId: request.user.userId,
    to,
    subject,
    bodyHtml: bodyHtml || '',
    bodyText: bodyText || '',
    type: type || 'manual',
  });

  return reply.send(result);
}

export async function handleListNotifications(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const result = await listNotifications(request.user.userId, request.user.tenantId);
  return reply.send(result);
}
