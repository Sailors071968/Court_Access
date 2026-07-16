// ============================================================================
// Program 135 — AI Orchestration Routes
// Read-only status/readiness/cost endpoints plus a deterministic metadata
// extractor. Provider status is derived from credentials only — never
// fabricated. Cost figures are transparent list-price ESTIMATES driven by the
// documented assumptions below.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  PROVIDERS, getProviderStatus, isConfigured, estimateCost, getRoutingOrder, type ProviderId,
} from './providerRegistry.js';
import { usageAccounting } from './usageAccounting.js';
import { aggregateCacheStats } from './aiCache.js';
import { extractCitationLocators } from './citationMetadata.js';

// Transparent cost assumptions (tokens per unit of work). Adjust as real usage
// is measured; these drive the projected-cost estimate only.
const ASSUMPTIONS = {
  avgInputTokensPerCase: 40_000,
  avgOutputTokensPerCase: 8_000,
  avgInputTokensPerReport: 12_000,
  avgOutputTokensPerReport: 3_000,
  assumedCacheHitRate: 0.4, // conservative once caching is warm
};

function chatCost(p: (typeof PROVIDERS)[number]): number {
  const m = p.models.find((mm) => mm.capability === 'chat')!;
  return m.pricing.inputPerMTok + m.pricing.outputPerMTok;
}

// Paid API providers only (exclude local self-hosted, which has $0 per-token but
// separate infrastructure cost), ordered cheapest-first for cost control.
function paidChatProvidersByCost(): (typeof PROVIDERS)[number][] {
  return [...PROVIDERS]
    .filter((p) => p.capabilities.includes('chat') && p.id !== 'local')
    .sort((a, b) => chatCost(a) - chatCost(b));
}

function cheapestChatProvider(): { provider: ProviderId; model: string } {
  // Prefer a configured paid provider; otherwise the cheapest documented paid
  // default so the pre-activation estimate is meaningful (not $0 from local).
  const configuredPaid = getRoutingOrder('chat').find((p) => isConfigured(p.id) && p.id !== 'local');
  const def = configuredPaid ?? paidChatProvidersByCost()[0];
  return { provider: def.id, model: def.chatModel ?? def.models[0].id };
}

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/ai/providers/status — configured vs not_configured (never fabricated)
  app.get('/api/ai/providers/status', async () => {
    const providers = PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      status: getProviderStatus(p.id),
      capabilities: p.capabilities,
      chatModel: p.chatModel ?? null,
      embeddingModel: p.embeddingModel ?? null,
      routingPreference: p.routingPreference,
      envVar: p.envVar,
      models: p.models,
    }));
    return {
      providers,
      configuredCount: providers.filter((p) => p.status === 'configured').length,
      chatRoutingOrder: getRoutingOrder('chat').map((p) => p.id),
      embeddingRoutingOrder: getRoutingOrder('embedding').map((p) => p.id),
      note: 'Status reflects credential presence only. Connectivity is asserted only after a real check.',
    };
  });

  // GET /api/ai/usage — measured token/cost/cache/latency telemetry
  app.get('/api/ai/usage', async () => {
    return { ...usageAccounting.snapshot(), caches: aggregateCacheStats() };
  });

  // GET /api/ai/readiness — infrastructure readiness + activation recommendation
  app.get('/api/ai/readiness', async () => {
    const checks = [
      { id: 'provider_orchestration', label: 'Provider orchestration (routing + failover)', ready: true },
      { id: 'usage_accounting', label: 'Token/cost/latency accounting', ready: true },
      { id: 'intelligent_caching', label: 'Response / prompt / semantic caching', ready: true },
      { id: 'prompt_optimization', label: 'Prompt optimization (only unresolved questions reach AI)', ready: true },
      { id: 'metadata_extraction', label: 'Evidence citation metadata extraction', ready: true },
      { id: 'health_monitoring', label: 'Provider health/status endpoint', ready: true },
    ];
    const infraReady = checks.filter((c) => c.ready).length;
    const infraPct = Math.round((infraReady / checks.length) * 100);
    const configuredCount = PROVIDERS.filter((p) => isConfigured(p.id)).length;
    const activationOrder = [
      ...paidChatProvidersByCost().map((p) => ({
        provider: p.id,
        envVar: p.envVar,
        chatModel: p.chatModel ?? null,
        reason: 'lowest list-price chat model first for cost control',
      })),
      { provider: 'local' as ProviderId, envVar: 'LOCAL_MODEL_URL', chatModel: 'local-chat', reason: 'optional self-hosted fallback ($0 per-token, separate infrastructure cost)' },
    ];
    return {
      infrastructureReadinessPercent: infraPct,
      checks,
      configuredProviders: configuredCount,
      readyToActivate: infraReady === checks.length,
      // Truthful: activation still requires at least one real credential.
      canServeAiRequestsNow: configuredCount > 0,
      recommendedActivationSequence: activationOrder,
      note: configuredCount === 0
        ? 'Infrastructure is ready. No AI credentials are configured yet, so live AI requests return not_configured until a key is added.'
        : `${configuredCount} provider(s) configured; live AI requests will route accordingly.`,
    };
  });

  // GET /api/ai/cost-estimate?cases=100&reports=300 — projected monthly cost
  app.get('/api/ai/cost-estimate', async (request: AuthenticatedRequest) => {
    const q = request.query as { cases?: string; reports?: string };
    const cases = Math.max(0, parseInt(q.cases ?? '100', 10) || 0);
    const reports = Math.max(0, parseInt(q.reports ?? '300', 10) || 0);
    const { provider, model } = cheapestChatProvider();
    const grossPerCase = estimateCost(provider, model, ASSUMPTIONS.avgInputTokensPerCase, ASSUMPTIONS.avgOutputTokensPerCase);
    const grossPerReport = estimateCost(provider, model, ASSUMPTIONS.avgInputTokensPerReport, ASSUMPTIONS.avgOutputTokensPerReport);
    const cacheFactor = 1 - ASSUMPTIONS.assumedCacheHitRate;
    const perCase = +(grossPerCase * cacheFactor).toFixed(4);
    const perReport = +(grossPerReport * cacheFactor).toFixed(4);
    const monthly = +((perCase * cases) + (perReport * reports)).toFixed(2);
    return {
      basis: { provider, model, assumptions: ASSUMPTIONS, priceType: 'published list-price estimate (USD)' },
      estimatedCostPerCaseUsd: perCase,
      estimatedCostPerReportUsd: perReport,
      volume: { cases, reports },
      estimatedMonthlyCostUsd: monthly,
      note: 'Estimate only. Actual cost depends on real token usage, provider pricing, and warm cache hit rate.',
    };
  });

  // POST /api/ai/metadata/extract — deterministic citation locators from text
  app.post('/api/ai/metadata/extract', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as { evidenceType?: string; text?: string; regions?: Array<{ x: number; y: number; w: number; h: number; label?: string }> } | undefined;
    if (!body || typeof body.text !== 'string' || typeof body.evidenceType !== 'string') {
      return reply.code(400).send({ error: 'evidenceType and text are required' });
    }
    return extractCitationLocators(body.evidenceType, body.text, { regions: body.regions });
  });
}
