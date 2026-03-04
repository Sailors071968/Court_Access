// ============================================
// Court Access — Subscription Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSubscription, cancelSubscription, getSubscriptionStatus, handleStripeWebhook } from '../services/stripeService.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { getStripeClient } from '../config/stripe.js';

export async function handleCreateSubscription(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);

  const { plan, email } = request.body as { plan: 'basic' | 'pro' | 'enterprise'; email: string };
  if (!plan || !email) throw new AppError('plan and email are required', 400);

  const result = await createSubscription(request.user.tenantId, email, plan);
  return reply.status(201).send(result);
}

export async function handleCancelSubscription(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const result = await cancelSubscription(request.user.tenantId);
  return reply.send(result);
}

export async function handleGetSubscriptionStatus(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const result = await getSubscriptionStatus(request.user.tenantId);
  return reply.send(result);
}

export async function handleStripeWebhookEndpoint(request: FastifyRequest, reply: FastifyReply) {
  const sig = request.headers['stripe-signature'] as string;
  if (!sig) throw new AppError('Missing stripe-signature header', 400);

  try {
    const stripe = getStripeClient();
    const rawBody = (request.body as { raw: Buffer }).raw || request.body;
    const event = stripe.webhooks.constructEvent(
      rawBody as string | Buffer,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
    await handleStripeWebhook(event as unknown as { type: string; data: { object: Record<string, unknown> } });
    return reply.send({ received: true });
  } catch (error) {
    throw new AppError('Webhook verification failed: ' + (error as Error).message, 400);
  }
}
