// ============================================================================
// CourtAccess — Billing & Usage Routes (Fastify)
// Subscription plans, AI credits, usage enforcement, credit packs.
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { getRequestContext } from '../security/authMiddleware.js';
import {
  getAllPlans,
  getPlanById,
  getUserSubscription,
  setUserSubscription,
  type SubscriptionPlanId,
} from './subscriptionService.js';
import {
  getCreditBalance,
  getAvailableCredits,
  getUserUsageHistory,
  getUserUsageByType,
  calculateCreditCost,
  deductCredits,
  addPurchasedCredits,
  getCreditPack,
  CREDIT_COSTS,
  CREDIT_PACKS,
  type AnalysisType,
} from './aiCreditService.js';
import {
  checkPageLimit,
  checkCreditLimit,
  getUserUsageDashboard,
  recordPageUpload,
} from './usageEnforcementService.js';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // Subscription Plans
  // =========================================================================

  // GET /api/billing/plans — list all subscription plans
  app.get('/api/billing/plans', async (_req: FastifyRequest, reply: FastifyReply) => {
    const plans = getAllPlans();
    return reply.send({ plans });
  });

  // GET /api/billing/plans/:planId — get a specific plan
  app.get('/api/billing/plans/:planId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { planId } = req.params as { planId: string };
    const plan = getPlanById(planId as SubscriptionPlanId);
    if (!plan) {
      return reply.status(404).send({ error: 'Plan not found' });
    }
    return reply.send({ plan });
  });

  // GET /api/billing/subscription — get current user's subscription
  app.get('/api/billing/subscription', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const subscription = await getUserSubscription(userId);
    const plan = getPlanById(subscription.planId);
    return reply.send({ subscription, plan });
  });

  // POST /api/billing/subscription — update user's subscription
  app.post('/api/billing/subscription', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const body = req.body as {
      planId: SubscriptionPlanId;
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
    };

    const plan = getPlanById(body.planId);
    if (!plan) {
      return reply.status(400).send({ error: 'Invalid plan ID' });
    }

    const subscription = await setUserSubscription(
      userId,
      body.planId,
      body.stripeSubscriptionId,
      body.stripeCustomerId,
    );
    return reply.send({ subscription, plan });
  });

  // =========================================================================
  // AI Credits
  // =========================================================================

  // GET /api/billing/credits — get user's credit balance
  app.get('/api/billing/credits', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const balance = await getCreditBalance(userId);
    const available = await getAvailableCredits(userId);
    return reply.send({ balance, available });
  });

  // GET /api/billing/credits/history — get user's credit usage history
  app.get('/api/billing/credits/history', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const query = req.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const history = await getUserUsageHistory(userId, limit);
    return reply.send({ history, total: history.length });
  });

  // GET /api/billing/credits/by-type — get credit usage broken down by analysis type
  app.get('/api/billing/credits/by-type', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const byType = await getUserUsageByType(userId);
    return reply.send({ usage: byType });
  });

  // GET /api/billing/credits/costs — get credit cost configuration
  app.get('/api/billing/credits/costs', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ costs: CREDIT_COSTS });
  });

  // POST /api/billing/credits/calculate — calculate credit cost for an operation
  app.post('/api/billing/credits/calculate', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { analysisType: AnalysisType; units: number };
    const cost = calculateCreditCost(body.analysisType, body.units);
    return reply.send({ analysisType: body.analysisType, units: body.units, creditCost: cost });
  });

  // POST /api/billing/credits/deduct — deduct credits for an analysis
  app.post('/api/billing/credits/deduct', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const body = req.body as {
      credits: number;
      analysisType: AnalysisType;
      caseId?: string;
    };

    const success = await deductCredits(userId, body.credits, body.analysisType, body.caseId);
    if (!success) {
      return reply.status(402).send({
        error: 'Insufficient credits',
        available: await getAvailableCredits(userId),
        required: body.credits,
      });
    }

    return reply.send({
      success: true,
      remaining: await getAvailableCredits(userId),
    });
  });

  // =========================================================================
  // Credit Packs
  // =========================================================================

  // GET /api/billing/credit-packs — list available credit packs
  app.get('/api/billing/credit-packs', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ packs: CREDIT_PACKS });
  });

  // POST /api/billing/credit-packs/purchase — purchase a credit pack
  app.post('/api/billing/credit-packs/purchase', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const body = req.body as { packId: string };
    const pack = getCreditPack(body.packId);

    if (!pack) {
      return reply.status(400).send({ error: 'Invalid credit pack ID' });
    }

    // In production, this would verify Stripe payment first
    const balance = await addPurchasedCredits(userId, pack.credits);
    return reply.send({
      success: true,
      creditsAdded: pack.credits,
      balance,
    });
  });

  // =========================================================================
  // Usage Enforcement
  // =========================================================================

  // GET /api/billing/usage — get user's usage dashboard
  app.get('/api/billing/usage', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const dashboard = await getUserUsageDashboard(userId);
    return reply.send({ usage: dashboard });
  });

  // POST /api/billing/usage/check-pages — check if upload is allowed
  app.post('/api/billing/usage/check-pages', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const body = req.body as { pageCount: number };
    const check = await checkPageLimit(userId, body.pageCount);
    return reply.send({ check });
  });

  // POST /api/billing/usage/check-credits — check if analysis is allowed
  app.post('/api/billing/usage/check-credits', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const body = req.body as { requiredCredits: number };
    const check = await checkCreditLimit(userId, body.requiredCredits);
    return reply.send({ check });
  });

  // POST /api/billing/usage/record-upload — record pages uploaded
  app.post('/api/billing/usage/record-upload', async (req: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = getRequestContext(req);
    if (!ctx) return reply.code(401).send({ error: 'Authentication required' });
    const userId = ctx.userId;
    const body = req.body as { pageCount: number };
    const record = await recordPageUpload(userId, body.pageCount);
    return reply.send({ record });
  });
}
