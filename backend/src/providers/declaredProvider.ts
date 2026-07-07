// ============================================================================
// DeclaredProvider — a framework-registered provider whose adapter is designed
// but NOT yet implemented/activated (e.g. requires credentials, or the upstream
// API is unavailable). Honest by construction: 0 active capabilities, health
// reflects the real reason, and every capability returns UNKNOWN — never faked.
// ============================================================================

import { BaseProvider, noCapabilities } from './baseProvider.js';
import type { ProviderHealth, ProviderCapabilities, ProviderCoverage, ProviderAuthInfo, ProviderRateLimits } from './types.js';

export interface DeclaredSpec {
  id: string;
  name: string;
  description: string;
  documentationUrl: string;
  authMethod: ProviderAuthInfo['method'];
  authEnvVar: string | null;
  authConfigured: boolean;
  jurisdictions: string[];
  plannedRecordTypes: string[];
  healthStatus: 'offline' | 'degraded' | 'unknown';
  reason: string; // why not active (credentials / API sunset / planned)
}

export class DeclaredProvider extends BaseProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly documentationUrl: string;
  private spec: DeclaredSpec;

  constructor(spec: DeclaredSpec) {
    super();
    this.id = spec.id; this.name = spec.name; this.description = spec.description;
    this.documentationUrl = spec.documentationUrl; this.spec = spec;
  }

  async health(): Promise<ProviderHealth> {
    return { provider: this.id, status: this.spec.healthStatus, latencyMs: null, checkedAt: new Date().toISOString(), detail: this.spec.reason };
  }
  capabilities(): ProviderCapabilities { return noCapabilities(); } // none active until implemented
  coverage(): ProviderCoverage {
    return { jurisdictions: this.spec.jurisdictions, recordTypes: this.spec.plannedRecordTypes, temporal: null, approximateVolume: null, note: `DECLARED (not active): ${this.spec.reason}` };
  }
  authentication(): ProviderAuthInfo { return { method: this.spec.authMethod, configured: this.spec.authConfigured, envVar: this.spec.authEnvVar, note: this.spec.reason }; }
  rateLimits(): ProviderRateLimits { return { requestsPerMinute: null, minIntervalMs: null, note: 'n/a — adapter not active' }; }
  version(): string { return '0.0.0-declared'; }
}
