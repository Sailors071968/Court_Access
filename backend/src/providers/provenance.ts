// ============================================================================
// Phase 13 — Evidence Provenance Engine
// Deterministic SHA-256 stamping so no imported record can lose provenance.
// ============================================================================

import { createHash } from 'node:crypto';
import { PROVIDER_FRAMEWORK_VERSION, type Provenance, type Confidence } from './types.js';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface StampInput {
  provider: string;
  originalId: string | null;
  originalUrl: string | null;
  jurisdiction: string | null;
  method: string;
  confidence?: Confidence;
  content: string; // the canonical content the hash certifies
  providerMetadata?: Record<string, unknown>;
  version?: string;
  syncedAt?: string | null;
}

export function stampProvenance(input: StampInput): Provenance {
  const retrievedAt = new Date().toISOString();
  return {
    provider: input.provider,
    originalId: input.originalId,
    originalUrl: input.originalUrl,
    retrievedAt,
    version: input.version ?? PROVIDER_FRAMEWORK_VERSION,
    sha256: sha256(`${input.provider}|${input.originalId ?? ''}|${input.content}`),
    syncedAt: input.syncedAt ?? null,
    confidence: input.confidence ?? 'MEDIUM',
    jurisdiction: input.jurisdiction,
    providerMetadata: input.providerMetadata ?? {},
    audit: { source: input.provider, method: input.method },
  };
}

/** Verify a record's hash matches its content (continuous validation). */
export function verifyProvenance(prov: Provenance, content: string): boolean {
  return prov.sha256 === sha256(`${prov.provider}|${prov.originalId ?? ''}|${content}`);
}
