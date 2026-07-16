// ============================================================================
// Program 140 — API Command Center routes (SUPER-ADMIN ONLY)
// Aggregates provider status, subscription, system health, and AI models into a
// single executive operations view. Every access is authorization-checked and
// audit-logged. Provider connectivity is derived from real in-process checks
// (datastores) or credential presence (external providers) — connectivity is
// NEVER fabricated; UNKNOWN is returned where verification cannot be performed.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { runDeepHealthCheck, type ComponentHealth } from '../observability/deepHealthCheck.js';
import { getQueueHealth } from '../lib/queues.js';
import {
  PROVIDER_CATALOG, credentialPresent, type ProviderConnectivity, type ProviderCatalogEntry,
} from './providerCatalog.js';
import { PROVIDERS as AI_PROVIDERS, getProviderStatus, estimateCost } from '../ai/providerRegistry.js';
import { usageAccounting } from '../ai/usageAccounting.js';

// Published model spec facts (context window in tokens) used for display only;
// labeled as published specs, not fabricated runtime data.
const MODEL_SPECS: Record<string, { contextWindow: number; capabilities: string[]; preferredWorkloads: string[] }> = {
  'gpt-4o-mini': { contextWindow: 128000, capabilities: ['chat', 'reasoning', 'summarization'], preferredWorkloads: ['Summarization', 'OCR post-processing', 'Citation drafting'] },
  'gpt-4o': { contextWindow: 128000, capabilities: ['chat', 'reasoning', 'vision'], preferredWorkloads: ['Attorney reasoning', 'Knowledge Graph'] },
  'claude-3-5-haiku-latest': { contextWindow: 200000, capabilities: ['chat', 'reasoning'], preferredWorkloads: ['Summarization', 'Fast review'] },
  'claude-3-5-sonnet-latest': { contextWindow: 200000, capabilities: ['chat', 'reasoning'], preferredWorkloads: ['Attorney reasoning', 'Citation generation'] },
  'gemini-1.5-flash': { contextWindow: 1000000, capabilities: ['chat', 'long-context'], preferredWorkloads: ['Long-document OCR', 'Summarization'] },
  'gemini-1.5-pro': { contextWindow: 2000000, capabilities: ['chat', 'reasoning', 'long-context'], preferredWorkloads: ['Attorney reasoning', 'Knowledge Graph'] },
};

function requireAdmin(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user?.userId) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void logSecurityEvent('COMMAND_CENTER_ACCESS_DENIED', user.userId, request.ip, `role=${user.role}`);
    void reply.code(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function connectivityFor(entry: ProviderCatalogEntry, infra: Record<string, ComponentHealth>): {
  status: ProviderConnectivity; latencyMs: number | null; message: string; lastVerified: string | null;
} {
  // Datastores: real in-process verification.
  if (entry.runtimeCheckable) {
    const key = entry.id === 'prisma' ? 'postgres' : entry.id;
    const health = infra[key];
    if (health) {
      const status: ProviderConnectivity = health.status === 'healthy' ? 'verified' : health.status === 'unknown' ? 'unknown' : 'unavailable';
      return { status, latencyMs: health.latencyMs, message: health.message ?? health.status, lastVerified: new Date().toISOString() };
    }
  }
  // External providers: credential presence only; connectivity UNKNOWN (no live call).
  if (!credentialPresent(entry)) {
    return { status: 'not_configured', latencyMs: null, message: 'Credential env var(s) not set', lastVerified: null };
  }
  return { status: 'unknown', latencyMs: null, message: 'Configured; live connectivity not verified in-process (UNKNOWN)', lastVerified: null };
}

export async function registerCommandCenterRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/command-center/overview — full operations snapshot (admin only)
  app.get('/api/command-center/overview', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const user = request.user!;
    void logSecurityEvent('COMMAND_CENTER_ACCESS', user.userId, request.ip);

    const [health, queues] = await Promise.all([
      runDeepHealthCheck().catch(() => null),
      getQueueHealth().catch(() => ({} as Record<string, { waiting: number; active: number; completed: number; failed: number }>)),
    ]);
    const infra = health?.components ?? ({} as Record<string, ComponentHealth>);

    // Providers.
    const providers = PROVIDER_CATALOG.map((entry) => {
      const conn = connectivityFor(entry, infra as Record<string, ComponentHealth>);
      return {
        id: entry.id, label: entry.label, category: entry.category, envVars: entry.envVars,
        configured: credentialPresent(entry),
        connectivity: conn.status,
        latencyMs: conn.latencyMs,
        lastVerified: conn.lastVerified,
        message: conn.message,
        runtimeCheckable: entry.runtimeCheckable,
      };
    });

    // AI models.
    const aiModels = AI_PROVIDERS.flatMap((p) => p.models.filter((m) => m.capability === 'chat').map((m) => {
      const spec = MODEL_SPECS[m.id];
      return {
        provider: p.id, providerLabel: p.label, model: m.id,
        status: getProviderStatus(p.id),
        estimatedCostPer1kTokens: +(((m.pricing.inputPerMTok + m.pricing.outputPerMTok) / 1000)).toFixed(5),
        contextWindow: spec?.contextWindow ?? null,
        capabilities: spec?.capabilities ?? [],
        preferredWorkloads: spec?.preferredWorkloads ?? [],
      };
    }));

    // Subscription (for the requesting admin).
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, include: { subscription: true } }).catch(() => null);
    const sub = dbUser?.subscription ?? null;

    // Repository health (real DB counts).
    const [caseCount, evidenceCount, chargeCount] = await Promise.all([
      prisma.criminalCase.count().catch(() => 0),
      prisma.evidence.count().catch(() => 0),
      prisma.charge.count().catch(() => 0),
    ]);

    const usage = usageAccounting.snapshot();

    // Cost estimate (cheapest paid model).
    const cheapest = AI_PROVIDERS.filter((p) => p.id !== 'local' && p.capabilities.includes('chat'))
      .map((p) => ({ id: p.id, model: p.chatModel ?? p.models[0].id, c: p.models.find((m) => m.capability === 'chat')! }))
      .sort((a, b) => (a.c.pricing.inputPerMTok + a.c.pricing.outputPerMTok) - (b.c.pricing.inputPerMTok + b.c.pricing.outputPerMTok))[0];
    const estMonthly = cheapest ? +((estimateCost(cheapest.id as never, cheapest.model, 40000, 8000) * 0.6 * 100) + (estimateCost(cheapest.id as never, cheapest.model, 12000, 3000) * 0.6 * 300)).toFixed(2) : 0;

    return {
      generatedAt: new Date().toISOString(),
      accessedBy: { userId: user.userId, role: user.role },
      providers,
      providerSummary: {
        total: providers.length,
        verified: providers.filter((p) => p.connectivity === 'verified').length,
        configured: providers.filter((p) => p.configured).length,
        notConfigured: providers.filter((p) => p.connectivity === 'not_configured').length,
        unknown: providers.filter((p) => p.connectivity === 'unknown').length,
        unavailable: providers.filter((p) => p.connectivity === 'unavailable').length,
      },
      aiModels,
      subscription: sub ? {
        planId: sub.planId, status: sub.subscriptionStatus, tier: sub.subscriptionTier,
        billingPeriodEnd: sub.billingPeriodEnd, trialEndsAt: sub.trialEndsAt,
      } : null,
      usage,
      costProjection: { estimatedMonthlyUsd: estMonthly, basis: cheapest ? `${cheapest.id}/${cheapest.model}` : 'UNKNOWN', note: 'Published list-price estimate; 100 cases + 300 reports/mo, 40% cache hit.' },
      systemHealth: {
        overall: health?.status ?? 'unknown',
        uptimeSeconds: health?.uptimeSeconds ?? null,
        components: infra,
        workers: queues,
        repository: { cases: caseCount, evidence: evidenceCount, charges: chargeCount },
      },
    };
  });

  // POST /api/command-center/test/:providerId — runtime verification (admin only)
  app.post('/api/command-center/test/:providerId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const user = request.user!;
    const { providerId } = request.params as { providerId: string };
    const entry = PROVIDER_CATALOG.find((p) => p.id === providerId);
    if (!entry) return reply.code(404).send({ error: 'Unknown provider' });
    void logSecurityEvent('COMMAND_CENTER_PROVIDER_TEST', user.userId, request.ip, `provider=${providerId}`);

    const started = Date.now();
    if (entry.runtimeCheckable) {
      const health = await runDeepHealthCheck().catch(() => null);
      const key = entry.id === 'prisma' ? 'postgres' : entry.id;
      const comp = health?.components?.[key as 'postgres' | 'redis' | 'neo4j'];
      if (comp) {
        return {
          providerId, tested: true,
          result: comp.status === 'healthy' ? 'verified' : comp.status === 'unknown' ? 'unknown' : 'unavailable',
          latencyMs: comp.latencyMs, message: comp.message ?? comp.status, at: new Date().toISOString(),
        };
      }
    }
    if (!credentialPresent(entry)) {
      return { providerId, tested: false, result: 'not_configured', latencyMs: Date.now() - started, message: 'Credential env var(s) not set — cannot verify (UNKNOWN).', at: new Date().toISOString() };
    }
    // Configured external provider: we do not make live third-party calls here.
    return { providerId, tested: false, result: 'unknown', latencyMs: Date.now() - started, message: 'Configured; live third-party verification not performed in-process (UNKNOWN).', at: new Date().toISOString() };
  });
}
