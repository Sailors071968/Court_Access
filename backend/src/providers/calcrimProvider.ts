// ============================================================================
// CALCRIM provider — California Criminal Jury Instructions, implemented on the
// canonical interface over the locally-derived CALCRIM instruction links
// (offense → instruction mappings extracted during statute processing).
// Honest scope: these are derived instruction LINKS with provenance, not the
// full Judicial Council CALCRIM text corpus (which requires acquisition).
// ============================================================================

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BaseProvider } from './baseProvider.js';
import type { ProviderResult, SearchParams, CanonicalRecord, ProviderHealth, ProviderCapabilities, ProviderCoverage, ProviderAuthInfo, ProviderRateLimits, Provenance } from './types.js';

const REPO = resolve(process.env.LEGISLATIVE_REPO_DIR || 'data/legislative/repositories');

interface CalcrimRow {
  id: string;
  offenseId?: string;
  instructionNumber?: { value: string; confidence: string };
  instructionTitle?: { value: string; confidence: string };
  confidence?: string;
  audit?: { sourceUrl?: string; contentHash?: string; extractedAt?: string };
}

function loadCalcrim(): CalcrimRow[] {
  try {
    const raw = readFileSync(join(REPO, 'calcrim_links', 'records.jsonl'), 'utf-8');
    const byId = new Map<string, CalcrimRow>();
    for (const line of raw.split('\n')) { const t = line.trim(); if (!t) continue; const r = JSON.parse(t) as CalcrimRow; byId.set(r.id, r); }
    return [...byId.values()];
  } catch { return []; }
}

export class CalcrimProvider extends BaseProvider {
  readonly id = 'calcrim';
  readonly name = 'CALCRIM (California Criminal Jury Instructions)';
  readonly description = 'California criminal jury instructions mapped to offenses (Judicial Council of California).';
  readonly documentationUrl = 'https://www.courts.ca.gov/partners/312.htm';

  private toRecord(r: CalcrimRow): CanonicalRecord {
    const num = r.instructionNumber?.value && r.instructionNumber.value !== 'UNKNOWN' ? r.instructionNumber.value : null;
    const title = r.instructionTitle?.value ?? 'CALCRIM instruction';
    const prov: Provenance = {
      provider: this.id,
      originalId: r.id,
      originalUrl: r.audit?.sourceUrl ?? null,
      retrievedAt: r.audit?.extractedAt ?? new Date().toISOString(),
      version: '1.0.0',
      sha256: r.audit?.contentHash ?? '',
      syncedAt: r.audit?.extractedAt ?? null,
      confidence: (r.confidence as Provenance['confidence']) ?? 'UNKNOWN',
      jurisdiction: 'US-CA',
      providerMetadata: { offenseId: r.offenseId ?? null, instructionNumberConfidence: r.instructionNumber?.confidence ?? 'UNKNOWN' },
      audit: { source: this.id, method: 'repository' },
    };
    return {
      recordType: 'jury_instruction',
      id: r.id,
      title: num ? `CALCRIM ${num} — ${title}` : `CALCRIM — ${title}`,
      citations: num ? [`CALCRIM ${num}`] : [],
      jurisdiction: 'US-CA', court: null, date: null,
      url: r.audit?.sourceUrl ?? null, snippet: `Jury instruction linked to offense (${title}).`,
      provenance: prov,
    };
  }

  override async searchJuryInstructions(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> {
    return this.timed('searchJuryInstructions', async () => {
      const terms = p.q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      const rows = loadCalcrim().filter((r) => {
        const hay = `${r.instructionNumber?.value ?? ''} ${r.instructionTitle?.value ?? ''}`.toLowerCase();
        return terms.length === 0 || terms.some((t) => hay.includes(t));
      }).slice(0, p.pageSize ?? 20);
      return { data: rows.map((r) => this.toRecord(r)), count: rows.length };
    });
  }

  override searchAuthorities(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> { return this.searchJuryInstructions(p); }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    const count = loadCalcrim().length;
    return { provider: this.id, status: count > 0 ? 'online' : 'offline', latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), detail: `${count} CALCRIM instruction links in repository` };
  }

  capabilities(): ProviderCapabilities {
    return { searchAuthorities: true, searchOpinions: false, searchStatutes: false, searchRegulations: false, searchDockets: false, searchRules: false, searchForms: false, searchJuryInstructions: true, retrieveDocument: false, retrieveOpinion: false, retrieveStatute: false, retrieveRegulation: false, retrieveMetadata: false };
  }
  coverage(): ProviderCoverage {
    return { jurisdictions: ['US-CA'], recordTypes: ['jury_instruction'], temporal: 'current', approximateVolume: `${loadCalcrim().length} derived instruction links`, note: 'Derived offense→instruction links with provenance; full CALCRIM text corpus acquisition (Judicial Council) pending.' };
  }
  authentication(): ProviderAuthInfo { return { method: 'none', configured: true, envVar: null, note: 'Local repository — no external auth.' }; }
  rateLimits(): ProviderRateLimits { return { requestsPerMinute: null, minIntervalMs: null, note: 'Local repository read.' }; }
  version(): string { return '1.0.0'; }
}
