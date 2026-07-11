// ============================================================================
// CourtListener provider (Phase 3) — implements the canonical interface on top
// of the existing CourtListener service. Search + opinion retrieval are live;
// token-gated capabilities surface honestly. Every record carries provenance.
// ============================================================================

import { BaseProvider } from './baseProvider.js';
import type { ProviderResult, SearchParams, CanonicalRecord, ProviderHealth, ProviderCapabilities, ProviderCoverage, ProviderAuthInfo, ProviderRateLimits } from './types.js';
import { stampProvenance } from './provenance.js';
import { searchAuthorities as clSearch, opinionById, docketById, integrationStatus } from '../courtlistener/courtListenerService.js';
import { isTokenConfigured } from '../courtlistener/courtListenerClient.js';

export class CourtListenerProvider extends BaseProvider {
  readonly id = 'courtlistener';
  readonly name = 'CourtListener (Free Law Project)';
  readonly description = 'Federal & state case law opinions, dockets, and citation lookup via the Free Law Project REST v4 API.';
  readonly documentationUrl = 'https://www.courtlistener.com/help/api/rest/';

  private toRecords(rows: Awaited<ReturnType<typeof clSearch>>['results'], type: CanonicalRecord['recordType']): CanonicalRecord[] {
    return rows.map((r) => ({
      recordType: type,
      id: r.opinionId ?? r.clusterId ?? r.url ?? r.caseName,
      title: r.caseName,
      citations: r.citations,
      jurisdiction: 'US',
      court: r.court,
      date: r.dateFiled,
      url: r.url,
      snippet: r.snippet,
      provenance: stampProvenance({
        provider: this.id,
        originalId: r.opinionId ?? r.clusterId,
        originalUrl: r.url,
        jurisdiction: 'US',
        method: 'search',
        confidence: 'HIGH',
        content: `${r.caseName}|${r.citations.join(',')}|${r.court ?? ''}|${r.dateFiled ?? ''}`,
        providerMetadata: { docketId: r.docketId, court: r.court },
      }),
    }));
  }

  override async searchOpinions(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> {
    return this.timed('searchOpinions', async () => {
      const res = await clSearch({ q: p.q, type: 'o', court: p.court, pageSize: p.pageSize ?? 10 });
      if (!res.ok) return { error: res.error ?? 'search failed' };
      return { data: this.toRecords(res.results, 'opinion'), count: res.count };
    });
  }

  override searchAuthorities(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> {
    return this.searchOpinions(p);
  }

  override async searchDockets(p: SearchParams): Promise<ProviderResult<CanonicalRecord[]>> {
    return this.timed('searchDockets', async () => {
      const res = await clSearch({ q: p.q, type: 'r', court: p.court, pageSize: p.pageSize ?? 10 });
      if (!res.ok) return { error: res.error ?? 'docket search failed' };
      return { data: this.toRecords(res.results, 'docket'), count: res.count };
    });
  }

  override async retrieveOpinion(id: string): Promise<ProviderResult<CanonicalRecord>> {
    return this.timed('retrieveOpinion', async () => {
      const res = await opinionById(id);
      if (!res.ok || !res.data) return { error: res.error ?? `opinion ${id} not retrievable (may require COURTLISTENER_API_TOKEN)` };
      const d = res.data;
      const rec: CanonicalRecord = {
        recordType: 'opinion', id, title: String(d.case_name ?? d.caseName ?? `Opinion ${id}`),
        citations: [], jurisdiction: 'US', court: (d.court as string) ?? null, date: (d.date_created as string) ?? null,
        url: (d.absolute_url as string) ? `https://www.courtlistener.com${d.absolute_url}` : null,
        snippet: typeof d.plain_text === 'string' ? d.plain_text.slice(0, 400) : null,
        provenance: stampProvenance({ provider: this.id, originalId: id, originalUrl: (d.absolute_url as string) ?? null, jurisdiction: 'US', method: 'retrieveOpinion', confidence: 'HIGH', content: String(d.plain_text ?? d.case_name ?? id) }),
      };
      return { data: rec, count: 1 };
    });
  }

  override retrieveDocument(id: string): Promise<ProviderResult<CanonicalRecord>> { return this.retrieveOpinion(id); }

  override async retrieveMetadata(id: string): Promise<ProviderResult<Record<string, unknown>>> {
    return this.timed('retrieveMetadata', async () => {
      const res = await docketById(id);
      if (!res.ok || !res.data) return { error: res.error ?? 'docket metadata not retrievable (may require token)' };
      return { data: res.data, count: 1 };
    });
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    const res = await clSearch({ q: 'test', type: 'o', pageSize: 1 });
    return {
      provider: this.id,
      status: res.ok ? 'online' : (res.error?.includes('401') ? 'degraded' : 'offline'),
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      detail: res.ok ? 'search reachable' : (res.error ?? 'unreachable'),
    };
  }

  capabilities(): ProviderCapabilities {
    return {
      searchAuthorities: true, searchOpinions: true, searchStatutes: false, searchRegulations: false,
      searchDockets: true, searchRules: false, searchForms: false, searchJuryInstructions: false,
      retrieveDocument: true, retrieveOpinion: true, retrieveStatute: false, retrieveRegulation: false, retrieveMetadata: true,
    };
  }

  coverage(): ProviderCoverage {
    return { jurisdictions: ['US-federal', 'US-states'], recordTypes: ['opinion', 'docket', 'citation'], temporal: '1600s–present', approximateVolume: 'millions of opinions', note: integrationStatus().note };
  }

  authentication(): ProviderAuthInfo {
    return { method: 'api_token', configured: isTokenConfigured(), envVar: 'COURTLISTENER_API_TOKEN', note: 'Search works unauthenticated; opinion/docket/citation-lookup require a token.' };
  }

  rateLimits(): ProviderRateLimits {
    return { requestsPerMinute: isTokenConfigured() ? 60 : 5, minIntervalMs: 1100, note: 'Client enforces a ≥1.1s inter-request gate and TTL caching.' };
  }

  version(): string { return '1.0.0'; }
}
