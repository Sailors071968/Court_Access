// ============================================================================
// Abstract base provider — supplies default "unsupported → UNKNOWN" results for
// every capability so concrete providers only override what they truly support.
// Nothing here fabricates data; unsupported capabilities return supported:false.
// ============================================================================

import type {
  LegalIntelligenceProvider, ProviderResult, SearchParams, CanonicalRecord,
  ProviderHealth, ProviderCapabilities, ProviderCoverage, ProviderAuthInfo, ProviderRateLimits,
} from './types.js';

export abstract class BaseProvider implements LegalIntelligenceProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly documentationUrl: string;

  protected unsupported<T>(capability: string): ProviderResult<T> {
    return {
      provider: this.id, capability, supported: false, ok: false, status: 'UNKNOWN',
      data: null, error: 'capability not supported by this provider', count: 0, tookMs: 0,
      retrievedAt: new Date().toISOString(),
    };
  }

  protected async timed<T>(capability: string, fn: () => Promise<{ data: T; count: number } | { error: string }>): Promise<ProviderResult<T>> {
    const started = Date.now();
    try {
      const r = await fn();
      if ('error' in r) {
        return { provider: this.id, capability, supported: true, ok: false, status: 'ERROR', data: null, error: r.error, count: 0, tookMs: Date.now() - started, retrievedAt: new Date().toISOString() };
      }
      return { provider: this.id, capability, supported: true, ok: true, status: 'PASS', data: r.data, error: null, count: r.count, tookMs: Date.now() - started, retrievedAt: new Date().toISOString() };
    } catch (e) {
      return { provider: this.id, capability, supported: true, ok: false, status: 'ERROR', data: null, error: e instanceof Error ? e.message : String(e), count: 0, tookMs: Date.now() - started, retrievedAt: new Date().toISOString() };
    }
  }

  // Default: unsupported. Concrete providers override the ones they implement.
  searchAuthorities(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchAuthorities')); }
  searchOpinions(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchOpinions')); }
  searchStatutes(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchStatutes')); }
  searchRegulations(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchRegulations')); }
  searchDockets(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchDockets')); }
  searchRules(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchRules')); }
  searchForms(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchForms')); }
  searchJuryInstructions(_p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return Promise.resolve(this.unsupported('searchJuryInstructions')); }
  retrieveDocument(_id: string): Promise<ProviderResult<CanonicalRecord>> { return Promise.resolve(this.unsupported('retrieveDocument')); }
  retrieveOpinion(_id: string): Promise<ProviderResult<CanonicalRecord>> { return Promise.resolve(this.unsupported('retrieveOpinion')); }
  retrieveStatute(_id: string): Promise<ProviderResult<CanonicalRecord>> { return Promise.resolve(this.unsupported('retrieveStatute')); }
  retrieveRegulation(_id: string): Promise<ProviderResult<CanonicalRecord>> { return Promise.resolve(this.unsupported('retrieveRegulation')); }
  retrieveMetadata(_id: string): Promise<ProviderResult<Record<string, unknown>>> { return Promise.resolve(this.unsupported('retrieveMetadata')); }

  abstract health(): Promise<ProviderHealth>;
  abstract capabilities(): ProviderCapabilities;
  abstract coverage(): ProviderCoverage;
  abstract authentication(): ProviderAuthInfo;
  abstract rateLimits(): ProviderRateLimits;
  abstract version(): string;
}

export function noCapabilities(): ProviderCapabilities {
  return {
    searchAuthorities: false, searchOpinions: false, searchStatutes: false, searchRegulations: false,
    searchDockets: false, searchRules: false, searchForms: false, searchJuryInstructions: false,
    retrieveDocument: false, retrieveOpinion: false, retrieveStatute: false, retrieveRegulation: false, retrieveMetadata: false,
  };
}
