// ============================================================================
// California Legislative (leginfo) provider — implements the canonical interface
// over the locally-acquired, hash-verified statute repository (Phase 8 data).
// Fully offline and runtime-verifiable; every record preserves the original
// leginfo URL + the repository's SHA-256 content hash as provenance.
// ============================================================================

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BaseProvider } from './baseProvider.js';
import type { ProviderResult, SearchParams, CanonicalRecord, ProviderHealth, ProviderCapabilities, ProviderCoverage, ProviderAuthInfo, ProviderRateLimits } from './types.js';
import type { Provenance } from './types.js';

const REPO = resolve(process.env.LEGISLATIVE_REPO_DIR || 'data/legislative/repositories');

interface StatuteRow {
  id: string; code: string; section: string; title: string; fullText: string;
  sourceUrl?: string; retrievedAt?: string; contentHash?: string; effectiveDate?: string;
}

function loadStatutes(): StatuteRow[] {
  try {
    const raw = readFileSync(join(REPO, 'statutes', 'records.jsonl'), 'utf-8');
    const byId = new Map<string, StatuteRow>();
    for (const line of raw.split('\n')) {
      const t = line.trim(); if (!t) continue;
      const r = JSON.parse(t) as StatuteRow; byId.set(r.id, r);
    }
    return [...byId.values()];
  } catch { return []; }
}

export class CaliforniaLegislativeProvider extends BaseProvider {
  readonly id = 'ca-leginfo';
  readonly name = 'California Legislative Information (leginfo)';
  readonly description = 'California codes (Penal, Vehicle, Health & Safety, Business & Professions, …) acquired + hash-verified into the local repository.';
  readonly documentationUrl = 'https://leginfo.legislature.ca.gov/';

  private toRecord(r: StatuteRow, snippetTerms: string[]): CanonicalRecord {
    const prov: Provenance = {
      provider: this.id,
      originalId: `${r.code} ${r.section}`,
      originalUrl: r.sourceUrl ?? null,
      retrievedAt: r.retrievedAt ?? new Date().toISOString(),
      version: '1.0.0',
      // Preserve the repository's authoritative content hash as provenance.
      sha256: r.contentHash ?? '',
      syncedAt: r.retrievedAt ?? null,
      confidence: r.contentHash ? 'HIGH' : 'MEDIUM',
      jurisdiction: 'US-CA',
      providerMetadata: { code: r.code, effectiveDate: r.effectiveDate ?? null },
      audit: { source: this.id, method: 'repository' },
    };
    return {
      recordType: 'statute', id: `${r.code}-${r.section}`, title: `${r.code} § ${r.section}`,
      citations: [`${r.code} ${r.section}`], jurisdiction: 'US-CA', court: null,
      date: r.effectiveDate ?? null, url: r.sourceUrl ?? null,
      snippet: snippet(r.fullText, snippetTerms), provenance: prov,
    };
  }

  override async searchStatutes(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> {
    return this.timed('searchStatutes', async () => {
      const terms = p.q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      const rows = loadStatutes();
      const scored = rows
        .map((r) => ({ r, score: score(r, terms, p.q) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, p.pageSize ?? 15);
      return { data: scored.map((x) => this.toRecord(x.r, terms)), count: scored.length };
    });
  }

  override searchAuthorities(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return this.searchStatutes(p); }

  override async retrieveStatute(id: string): Promise<ProviderResult<CanonicalRecord>> {
    return this.timed('retrieveStatute', async () => {
      const [code, ...rest] = id.split('-');
      const section = rest.join('-');
      const row = loadStatutes().find((r) => r.code === code && r.section === section);
      if (!row) return { error: `statute ${id} not in repository` };
      return { data: this.toRecord(row, []), count: 1 };
    });
  }

  override retrieveDocument(id: string): Promise<ProviderResult<CanonicalRecord>> { return this.retrieveStatute(id); }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    const count = loadStatutes().length;
    return {
      provider: this.id,
      status: count > 0 ? 'online' : 'offline',
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      detail: count > 0 ? `${count} statute records in repository` : 'repository empty — run leginfo acquisition',
    };
  }

  capabilities(): ProviderCapabilities {
    return {
      searchAuthorities: true, searchOpinions: false, searchStatutes: true, searchRegulations: false,
      searchDockets: false, searchRules: false, searchForms: false, searchJuryInstructions: false,
      retrieveDocument: true, retrieveOpinion: false, retrieveStatute: true, retrieveRegulation: false, retrieveMetadata: false,
    };
  }

  coverage(): ProviderCoverage {
    const codes = [...new Set(loadStatutes().map((r) => r.code))];
    return { jurisdictions: ['US-CA'], recordTypes: ['statute'], temporal: 'current', approximateVolume: `${loadStatutes().length} sections across ${codes.join(', ') || 'no'} codes`, note: 'Locally acquired + hash-verified; expand via leginfo:discover-criminal.' };
  }

  authentication(): ProviderAuthInfo { return { method: 'none', configured: true, envVar: null, note: 'Local repository — no external auth.' }; }
  rateLimits(): ProviderRateLimits { return { requestsPerMinute: null, minIntervalMs: null, note: 'Local repository read; no rate limit.' }; }
  version(): string { return '1.0.0'; }
}

function score(r: StatuteRow, terms: string[], phrase: string): number {
  const hay = `${r.code} ${r.section} ${r.title} ${r.fullText}`.toLowerCase();
  let s = 0;
  if (phrase.length >= 2 && hay.includes(phrase.toLowerCase())) s += 10;
  for (const t of terms) if (hay.includes(t)) s += 2;
  // Exact section-number match is a strong signal.
  if (terms.some((t) => r.section.toLowerCase().startsWith(t))) s += 8;
  return s;
}

function snippet(text: string, terms: string[], max = 300): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  let idx = -1;
  for (const t of terms) { const at = lower.indexOf(t); if (at >= 0 && (idx === -1 || at < idx)) idx = at; }
  const start = idx === -1 ? 0 : Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + clean.slice(start, start + max) + (clean.length > start + max ? '…' : '');
}
