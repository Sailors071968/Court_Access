// ============================================================================
// Program 135 — Provider Orchestrator
// Unified entry point for AI chat/embedding calls with automatic routing,
// failover, caching, and usage/cost accounting. Providers are only invoked
// when their credential is present; when none are configured the orchestrator
// returns a truthful `not_configured` result (it NEVER fabricates a response).
// Callers are pluggable so behavior is deterministically testable offline.
// ============================================================================

import {
  getRoutingOrder, isConfigured, getProvider, type Capability, type ProviderId,
} from './providerRegistry.js';
import { responseCache, semanticCache, hashKey, type CacheStats } from './aiCache.js';
import { usageAccounting } from './usageAccounting.js';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  /** Extra parts that make an identical request cache to the same key. */
  cacheKeyParts?: Array<string | number>;
  temperature?: number;
}

export type ChatOutcome =
  | { status: 'ok'; provider: ProviderId; model: string; text: string; cached: boolean; usage: { promptTokens: number; completionTokens: number }; routedThrough: RouteAttempt[] }
  | { status: 'not_configured'; text: null; routedThrough: RouteAttempt[] }
  | { status: 'error'; error: string; routedThrough: RouteAttempt[] };

export interface RouteAttempt { provider: ProviderId; outcome: 'not_configured' | 'error' | 'ok' | 'skipped'; detail?: string }

/** A provider caller performs one real upstream request. */
export type ProviderCaller = (
  provider: ProviderId,
  model: string,
  req: ChatRequest,
) => Promise<{ text: string; promptTokens: number; completionTokens: number }>;

/** ~4 characters per token is the standard rough estimate. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

// Registry of real callers. Populated lazily; tests can override via setCaller.
const callers: Partial<Record<ProviderId, ProviderCaller>> = {};

export function setCaller(provider: ProviderId, caller: ProviderCaller | undefined): void {
  if (caller) callers[provider] = caller;
  else delete callers[provider];
}

export interface OrchestratorOptions {
  env?: NodeJS.ProcessEnv;
  useCache?: boolean;
}

export async function chat(req: ChatRequest, opts: OrchestratorOptions = {}): Promise<ChatOutcome> {
  const env = opts.env ?? process.env;
  const useCache = opts.useCache !== false;
  const capability: Capability = 'chat';
  const key = hashKey('chat', req.model ?? '', ...req.messages.map((m) => `${m.role}:${m.content}`), ...(req.cacheKeyParts ?? []));

  // 1) Cache lookup (response then semantic).
  if (useCache) {
    const cached = responseCache.get(key) ?? semanticCache.get(key);
    if (cached) {
      const order = getRoutingOrder(capability, env);
      const provider = order.find((p) => isConfigured(p.id, env))?.id ?? order[0].id;
      usageAccounting.record({ provider, model: req.model ?? getProvider(provider)?.chatModel ?? 'unknown', promptTokens: cached.usage.promptTokens, completionTokens: cached.usage.completionTokens, latencyMs: 0, cached: true });
      return { status: 'ok', provider, model: req.model ?? getProvider(provider)?.chatModel ?? 'unknown', text: cached.text, cached: true, usage: cached.usage, routedThrough: [{ provider, outcome: 'ok', detail: 'cache' }] };
    }
  }

  // 2) Route + failover across configured providers.
  const order = getRoutingOrder(capability, env);
  const attempts: RouteAttempt[] = [];
  for (const def of order) {
    if (!isConfigured(def.id, env)) {
      attempts.push({ provider: def.id, outcome: 'not_configured' });
      continue;
    }
    const model = req.model ?? def.chatModel ?? 'unknown';
    const caller = callers[def.id];
    if (!caller) {
      attempts.push({ provider: def.id, outcome: 'skipped', detail: 'no caller registered' });
      continue;
    }
    const started = Date.now();
    try {
      const res = await caller(def.id, model, req);
      const latencyMs = Date.now() - started;
      usageAccounting.record({ provider: def.id, model, promptTokens: res.promptTokens, completionTokens: res.completionTokens, latencyMs, cached: false });
      if (useCache) responseCache.set(key, { text: res.text, usage: { promptTokens: res.promptTokens, completionTokens: res.completionTokens } });
      attempts.push({ provider: def.id, outcome: 'ok' });
      return { status: 'ok', provider: def.id, model, text: res.text, cached: false, usage: { promptTokens: res.promptTokens, completionTokens: res.completionTokens }, routedThrough: attempts };
    } catch (e) {
      const latencyMs = Date.now() - started;
      usageAccounting.record({ provider: def.id, model, promptTokens: 0, completionTokens: 0, latencyMs, cached: false, error: true });
      attempts.push({ provider: def.id, outcome: 'error', detail: e instanceof Error ? e.message : String(e) });
      // fall through to next provider (failover)
    }
  }

  const anyConfigured = order.some((p) => isConfigured(p.id, env));
  if (!anyConfigured) return { status: 'not_configured', text: null, routedThrough: attempts };
  return { status: 'error', error: 'All configured providers failed', routedThrough: attempts };
}

export function cacheStatsSnapshot(): Record<string, CacheStats> {
  return { response: responseCache.stats(), semantic: semanticCache.stats() };
}
