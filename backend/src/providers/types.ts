// ============================================================================
// Legal Intelligence Provider Framework — canonical interface (Phase 1)
// Every external legal knowledge source implements ONE interface. Capabilities
// a provider does not support return a standard "unsupported/UNKNOWN" result —
// never a fabricated value. Every retrieved record carries provenance (Phase 13).
// ============================================================================

export const PROVIDER_FRAMEWORK_VERSION = '1.0.0';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type ResultStatus = 'PASS' | 'UNKNOWN' | 'ERROR';

/** Phase 13 — Evidence Provenance. Stamped on every imported/retrieved record. */
export interface Provenance {
  provider: string;
  originalId: string | null;
  originalUrl: string | null;
  retrievedAt: string;
  version: string;
  sha256: string;
  syncedAt: string | null;
  confidence: Confidence;
  jurisdiction: string | null;
  providerMetadata: Record<string, unknown>;
  audit: { source: string; method: string };
}

export interface CanonicalRecord {
  recordType: 'authority' | 'opinion' | 'statute' | 'regulation' | 'docket' | 'rule' | 'form' | 'jury_instruction';
  id: string;
  title: string;
  citations: string[];
  jurisdiction: string | null;
  court: string | null;
  date: string | null;
  url: string | null;
  snippet: string | null;
  provenance: Provenance;
}

/** Standard result envelope for every provider capability. */
export interface ProviderResult<T> {
  provider: string;
  capability: string;
  supported: boolean;
  ok: boolean;
  status: ResultStatus;
  data: T | null;
  error: string | null;
  count: number;
  tookMs: number;
  retrievedAt: string;
}

export interface SearchParams {
  q: string;
  jurisdiction?: string;
  court?: string;
  pageSize?: number;
  cursor?: string;
}

export interface ProviderHealth {
  provider: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  latencyMs: number | null;
  checkedAt: string;
  detail: string;
}

export interface ProviderCapabilities {
  searchAuthorities: boolean;
  searchOpinions: boolean;
  searchStatutes: boolean;
  searchRegulations: boolean;
  searchDockets: boolean;
  searchRules: boolean;
  searchForms: boolean;
  searchJuryInstructions: boolean;
  retrieveDocument: boolean;
  retrieveOpinion: boolean;
  retrieveStatute: boolean;
  retrieveRegulation: boolean;
  retrieveMetadata: boolean;
}

export interface ProviderCoverage {
  jurisdictions: string[];
  recordTypes: string[];
  temporal: string | null;
  approximateVolume: string | null;
  note: string;
}

export interface ProviderAuthInfo {
  method: 'none' | 'api_token' | 'oauth' | 'basic' | 'credentials';
  configured: boolean;
  envVar: string | null;
  note: string;
}

export interface ProviderRateLimits {
  requestsPerMinute: number | null;
  minIntervalMs: number | null;
  note: string;
}

/** The canonical provider interface every adapter implements (Phase 1). */
export interface LegalIntelligenceProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly documentationUrl: string;

  searchAuthorities(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchOpinions(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchStatutes(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchRegulations(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchDockets(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchRules(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchForms(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;
  searchJuryInstructions(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>>;

  retrieveDocument(id: string): Promise<ProviderResult<CanonicalRecord>>;
  retrieveOpinion(id: string): Promise<ProviderResult<CanonicalRecord>>;
  retrieveStatute(id: string): Promise<ProviderResult<CanonicalRecord>>;
  retrieveRegulation(id: string): Promise<ProviderResult<CanonicalRecord>>;
  retrieveMetadata(id: string): Promise<ProviderResult<Record<string, unknown>>>;

  health(): Promise<ProviderHealth>;
  capabilities(): ProviderCapabilities;
  coverage(): ProviderCoverage;
  authentication(): ProviderAuthInfo;
  rateLimits(): ProviderRateLimits;
  version(): string;
}
