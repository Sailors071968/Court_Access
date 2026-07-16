// ============================================================================
// Program 135 — AI Usage & Cost Accounting
// Records per-provider token, cost, latency, error, and cache telemetry for
// every orchestrated AI call. Values are measured, never fabricated: when no
// providers are configured the snapshot reports zero activity honestly. Also
// mirrors counters into the existing metricsCollector (courtaccess_llm_*).
// ============================================================================

import { metrics } from '../observability/metricsCollector.js';
import { estimateCost, type ProviderId } from './providerRegistry.js';

export interface ProviderUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMsTotal: number;
  errors: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface UsageRecord {
  provider: ProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cached: boolean;
  error?: boolean;
}

function empty(): ProviderUsage {
  return {
    calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0,
    costUsd: 0, latencyMsTotal: 0, errors: 0, cacheHits: 0, cacheMisses: 0,
  };
}

class UsageAccounting {
  private byProvider = new Map<ProviderId, ProviderUsage>();

  record(r: UsageRecord): void {
    const u = this.byProvider.get(r.provider) ?? empty();
    u.calls += 1;
    if (r.error) u.errors += 1;
    if (r.cached) {
      u.cacheHits += 1;
    } else {
      u.cacheMisses += 1;
      u.promptTokens += r.promptTokens;
      u.completionTokens += r.completionTokens;
      u.totalTokens += r.promptTokens + r.completionTokens;
      u.costUsd = +(u.costUsd + estimateCost(r.provider, r.model, r.promptTokens, r.completionTokens)).toFixed(6);
    }
    u.latencyMsTotal += r.latencyMs;
    this.byProvider.set(r.provider, u);

    // Mirror into Prometheus-style metrics (registered but previously unwired).
    metrics.incrementCounter('courtaccess_llm_calls_total', { provider: r.provider, cached: String(r.cached) });
    if (!r.cached) {
      metrics.incrementCounter('courtaccess_llm_tokens_total', { provider: r.provider }, r.promptTokens + r.completionTokens);
    }
    metrics.observeHistogram('courtaccess_llm_latency_ms', r.latencyMs, { provider: r.provider });
  }

  snapshot(): {
    providers: Record<string, ProviderUsage>;
    totals: ProviderUsage;
    cacheHitRate: number;
    routingEfficiency: number;
  } {
    const providers: Record<string, ProviderUsage> = {};
    const totals = empty();
    for (const [id, u] of this.byProvider) {
      providers[id] = u;
      totals.calls += u.calls;
      totals.promptTokens += u.promptTokens;
      totals.completionTokens += u.completionTokens;
      totals.totalTokens += u.totalTokens;
      totals.costUsd = +(totals.costUsd + u.costUsd).toFixed(6);
      totals.latencyMsTotal += u.latencyMsTotal;
      totals.errors += u.errors;
      totals.cacheHits += u.cacheHits;
      totals.cacheMisses += u.cacheMisses;
    }
    const cacheDenom = totals.cacheHits + totals.cacheMisses;
    // Routing efficiency = share of calls that succeeded without error.
    const routingEfficiency = totals.calls === 0 ? 0 : +((totals.calls - totals.errors) / totals.calls).toFixed(4);
    return {
      providers,
      totals,
      cacheHitRate: cacheDenom === 0 ? 0 : +(totals.cacheHits / cacheDenom).toFixed(4),
      routingEfficiency,
    };
  }

  reset(): void {
    this.byProvider.clear();
  }
}

export const usageAccounting = new UsageAccounting();
