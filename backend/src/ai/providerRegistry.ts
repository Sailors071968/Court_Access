// ============================================================================
// Program 135 — AI Provider Registry
// Declares the supported AI providers, their capabilities, models, and PUBLISHED
// list-price estimates used for cost projection. Provider *status* is derived
// solely from whether the corresponding credential env var is present — status
// is never fabricated. Absent a credential a provider is reported
// `not_configured`; connectivity is only ever claimed after a real check.
// ============================================================================

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'local';
export type Capability = 'chat' | 'embedding';
export type ProviderStatus = 'configured' | 'not_configured';

/** USD per 1,000,000 tokens. Published list-price ESTIMATES, not billed rates. */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface ProviderModel {
  id: string;
  capability: Capability;
  pricing: ModelPricing;
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  envVar: string;
  endpoint: string;
  capabilities: Capability[];
  chatModel?: string;
  embeddingModel?: string;
  models: ProviderModel[];
  /** Lower = preferred when routing (cost/quality balanced default). */
  routingPreference: number;
}

// Published list-price estimates (USD / 1M tokens) as configured defaults.
// These are transparent assumptions for cost projection only.
export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1',
    capabilities: ['chat', 'embedding'],
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    models: [
      { id: 'gpt-4o-mini', capability: 'chat', pricing: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
      { id: 'gpt-4o', capability: 'chat', pricing: { inputPerMTok: 2.5, outputPerMTok: 10 } },
      { id: 'text-embedding-3-small', capability: 'embedding', pricing: { inputPerMTok: 0.02, outputPerMTok: 0 } },
    ],
    routingPreference: 1,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    endpoint: 'https://api.anthropic.com/v1',
    capabilities: ['chat'],
    chatModel: 'claude-3-5-haiku-latest',
    models: [
      { id: 'claude-3-5-haiku-latest', capability: 'chat', pricing: { inputPerMTok: 0.8, outputPerMTok: 4 } },
      { id: 'claude-3-5-sonnet-latest', capability: 'chat', pricing: { inputPerMTok: 3, outputPerMTok: 15 } },
    ],
    routingPreference: 2,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    capabilities: ['chat', 'embedding'],
    chatModel: 'gemini-1.5-flash',
    embeddingModel: 'text-embedding-004',
    models: [
      { id: 'gemini-1.5-flash', capability: 'chat', pricing: { inputPerMTok: 0.075, outputPerMTok: 0.3 } },
      { id: 'gemini-1.5-pro', capability: 'chat', pricing: { inputPerMTok: 1.25, outputPerMTok: 5 } },
      { id: 'text-embedding-004', capability: 'embedding', pricing: { inputPerMTok: 0, outputPerMTok: 0 } },
    ],
    routingPreference: 3,
  },
  {
    id: 'local',
    label: 'Local / Self-Hosted Model',
    envVar: 'LOCAL_MODEL_URL',
    endpoint: '',
    capabilities: ['chat', 'embedding'],
    chatModel: 'local-chat',
    embeddingModel: 'local-embedding',
    // Local models incur infrastructure cost, not per-token API cost.
    models: [
      { id: 'local-chat', capability: 'chat', pricing: { inputPerMTok: 0, outputPerMTok: 0 } },
      { id: 'local-embedding', capability: 'embedding', pricing: { inputPerMTok: 0, outputPerMTok: 0 } },
    ],
    routingPreference: 4,
  },
] as const;

export function getProvider(id: ProviderId): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Status is derived purely from credential presence — never fabricated. */
export function getProviderStatus(
  id: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): ProviderStatus {
  const def = getProvider(id);
  if (!def) return 'not_configured';
  const value = env[def.envVar];
  return value && value.trim().length > 0 ? 'configured' : 'not_configured';
}

export function isConfigured(id: ProviderId, env: NodeJS.ProcessEnv = process.env): boolean {
  return getProviderStatus(id, env) === 'configured';
}

/**
 * Deterministic routing order for a capability: configured providers first
 * (by routing preference), then not-configured providers (as documented
 * failover targets). Only providers supporting the capability are included.
 */
export function getRoutingOrder(
  capability: Capability,
  env: NodeJS.ProcessEnv = process.env,
): ProviderDefinition[] {
  const capable = PROVIDERS.filter((p) => p.capabilities.includes(capability));
  return [...capable].sort((a, b) => {
    const aC = isConfigured(a.id, env) ? 0 : 1;
    const bC = isConfigured(b.id, env) ? 0 : 1;
    if (aC !== bC) return aC - bC;
    return a.routingPreference - b.routingPreference;
  });
}

export function findModel(id: ProviderId, modelId: string): ProviderModel | undefined {
  return getProvider(id)?.models.find((m) => m.id === modelId);
}

/** Estimate USD cost for a call given token counts. Uses list-price estimates. */
export function estimateCost(
  id: ProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = findModel(id, modelId);
  if (!model) return 0;
  const inCost = (inputTokens / 1_000_000) * model.pricing.inputPerMTok;
  const outCost = (outputTokens / 1_000_000) * model.pricing.outputPerMTok;
  return +(inCost + outCost).toFixed(6);
}
