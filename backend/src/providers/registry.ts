// ============================================================================
// Phase 2/14 — Legal Intelligence Provider Registry (single source of truth).
// Registers provider instances and exposes registry metadata, health, and
// federated capability search across all providers that support a capability.
// ============================================================================

import type { LegalIntelligenceProvider, ProviderResult, SearchParams, CanonicalRecord, ProviderHealth } from './types.js';
import { PROVIDER_FRAMEWORK_VERSION } from './types.js';

type SearchCapability = 'searchAuthorities' | 'searchOpinions' | 'searchStatutes' | 'searchRegulations' | 'searchDockets' | 'searchRules' | 'searchForms' | 'searchJuryInstructions';

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  documentationUrl: string;
  version: string;
  capabilities: ReturnType<LegalIntelligenceProvider['capabilities']>;
  coverage: ReturnType<LegalIntelligenceProvider['coverage']>;
  authentication: ReturnType<LegalIntelligenceProvider['authentication']>;
  rateLimits: ReturnType<LegalIntelligenceProvider['rateLimits']>;
}

class ProviderRegistry {
  private providers = new Map<string, LegalIntelligenceProvider>();

  register(p: LegalIntelligenceProvider): void {
    if (this.providers.has(p.id)) throw new Error(`Duplicate provider id: ${p.id}`);
    this.providers.set(p.id, p);
  }

  get(id: string): LegalIntelligenceProvider | undefined { return this.providers.get(id); }
  list(): LegalIntelligenceProvider[] { return [...this.providers.values()]; }

  snapshot(): { frameworkVersion: string; count: number; providers: RegistryEntry[] } {
    return {
      frameworkVersion: PROVIDER_FRAMEWORK_VERSION,
      count: this.providers.size,
      providers: this.list().map((p) => ({
        id: p.id, name: p.name, description: p.description, documentationUrl: p.documentationUrl,
        version: p.version(), capabilities: p.capabilities(), coverage: p.coverage(),
        authentication: p.authentication(), rateLimits: p.rateLimits(),
      })),
    };
  }

  async healthAll(): Promise<ProviderHealth[]> {
    return Promise.all(this.list().map((p) => p.health()));
  }

  /** Run a search capability across every provider that supports it. */
  async federatedSearch(capability: SearchCapability, params: SearchParams): Promise<{
    capability: string; query: string; providers: number; results: CanonicalRecord[]; perProvider: ProviderResult<CanonicalRecord[]>[];
  }> {
    const supporting = this.list().filter((p) => p.capabilities()[capability]);
    const perProvider = await Promise.all(supporting.map((p) => (p[capability] as (x: SearchParams) => Promise<ProviderResult<CanonicalRecord[]>>)(params)));
    const results = perProvider.flatMap((r) => r.data ?? []);
    return { capability, query: params.q, providers: supporting.length, results, perProvider };
  }
}

export const providerRegistry = new ProviderRegistry();
