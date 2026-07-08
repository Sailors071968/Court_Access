// ============================================================================
// Administration → Provider Integrations (Master Final Integration Program)
// One in-app place to see the status, health, capabilities, and rate limits of
// every external provider. Status is real: legal providers report live registry
// health; infrastructure/service providers report environment configuration.
// Secrets are never displayed — only a masked hint and a "configured" flag.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Plug, RefreshCw, CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  ExternalLink, KeyRound, Loader2, Search,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { listIntegrations, testIntegration, type Integration, type TestResult } from '../../services/integrationsApi';

const STATUS: Record<string, { label: string; variant: 'emerald' | 'amber' | 'danger' | 'slate' | 'gold'; icon: React.ReactNode }> = {
  online: { label: 'Online', variant: 'emerald', icon: <CheckCircle2 size={13} /> },
  configured: { label: 'Configured', variant: 'gold', icon: <CheckCircle2 size={13} /> },
  degraded: { label: 'Degraded', variant: 'amber', icon: <AlertTriangle size={13} /> },
  not_configured: { label: 'Not configured', variant: 'slate', icon: <XCircle size={13} /> },
  unknown: { label: 'Unknown', variant: 'slate', icon: <HelpCircle size={13} /> },
};

export function ProviderIntegrationsPage() {
  const [data, setData] = useState<Integration[]>([]);
  const [meta, setMeta] = useState<{ configured: number; online: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const load = async () => {
    setLoading(true);
    try {
      const snap = await listIntegrations();
      setData(snap.integrations);
      setMeta({ configured: snap.configured, online: snap.online, total: snap.total });
      setError('');
    } catch {
      setError('Unable to load provider integrations. Administrator access is required.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const runTest = async (id: string) => {
    setTesting((t) => ({ ...t, [id]: true }));
    try {
      const r = await testIntegration(id);
      setResults((s) => ({ ...s, [id]: r }));
    } catch {
      setResults((s) => ({ ...s, [id]: { id, ok: false, status: 'error', detail: 'Test request failed', latencyMs: 0 } }));
    } finally {
      setTesting((t) => ({ ...t, [id]: false }));
    }
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? data.filter((d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)) : data;
    const map = new Map<string, Integration[]>();
    for (const it of list) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    return Array.from(map.entries());
  }, [data, query]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        overline="Administration"
        title="Provider Integrations"
        subtitle="Connection status, health, capabilities, and rate limits for every external provider — managed in one place."
        action={
          <button onClick={load} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-white/10 text-slate-200 hover:bg-white/5">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {meta && (
        <div className="grid grid-cols-3 gap-4">
          {[['Providers', meta.total], ['Configured', meta.configured], ['Online (live)', meta.online]].map(([l, v]) => (
            <Card key={String(l)} className="py-4">
              <div className="text-3xl font-bold text-white tracking-tight">{String(v)}</div>
              <div className="text-sm font-medium text-slate-300 mt-1">{String(l)}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search providers…"
          className="w-full bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:border-gold-light focus:outline-none"
        />
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading integrations…</div>
      ) : (
        grouped.map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gold-light">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((it) => {
                const s = STATUS[it.status] ?? STATUS.unknown;
                const r = results[it.id];
                return (
                  <Card key={it.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl ca-icon-gold text-gold-light flex items-center justify-center flex-shrink-0">
                          <Plug size={18} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-white truncate">{it.name}</h3>
                          <p className="text-xs text-slate-400 truncate">{it.description}</p>
                        </div>
                      </div>
                      <Badge variant={s.variant} className="flex items-center gap-1 flex-shrink-0">{s.icon}{s.label}</Badge>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {it.baseUrl && (
                        <div className="col-span-2">
                          <dt className="text-slate-400">Base URL</dt>
                          <dd className="text-slate-200 font-mono truncate">{it.baseUrl}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-slate-400">API key / secret</dt>
                        <dd className="text-slate-200 flex items-center gap-1.5">
                          <KeyRound size={12} className={it.hasCredential ? 'text-emerald-400' : 'text-slate-500'} />
                          {it.hasCredential ? (it.credentialHint ?? 'Configured') : 'Not set'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Rate limits</dt>
                        <dd className="text-slate-200">{formatRate(it.rateLimits)}</dd>
                      </div>
                      {it.capabilities.length > 0 && (
                        <div className="col-span-2">
                          <dt className="text-slate-400 mb-1">Capabilities</dt>
                          <dd className="flex flex-wrap gap-1">
                            {it.capabilities.map((c) => <Badge key={c} variant="default">{c}</Badge>)}
                          </dd>
                        </div>
                      )}
                      {it.health && (
                        <div className="col-span-2">
                          <dt className="text-slate-400">Last health check</dt>
                          <dd className="text-slate-300">{it.health.detail} {it.health.latencyMs != null && <span className="text-slate-500">· {it.health.latencyMs}ms</span>}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-white/10">
                      <div className="text-xs">
                        {r ? (
                          <span className={`flex items-center gap-1.5 ${r.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                            {r.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {r.detail ?? r.status} <span className="text-slate-500">· {r.latencyMs}ms</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Not tested this session</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {it.docsUrl && (
                          <a href={it.docsUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-gold-light hover:bg-white/5" title="Documentation">
                            <ExternalLink size={15} />
                          </a>
                        )}
                        <button
                          onClick={() => runTest(it.id)}
                          disabled={testing[it.id]}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-60"
                        >
                          {testing[it.id] ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Test Connection
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      <p className="text-xs text-slate-500 leading-relaxed">
        Secret values are never displayed. Credentials are read from the secured server environment; a masked hint confirms configuration without exposing the value.
      </p>
    </div>
  );
}

function formatRate(rl: unknown): string {
  if (!rl || typeof rl !== 'object') return '—';
  const r = rl as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.requestsPerMinute === 'number') parts.push(`${r.requestsPerMinute}/min`);
  if (typeof r.requestsPerDay === 'number') parts.push(`${r.requestsPerDay}/day`);
  if (typeof r.note === 'string' && parts.length === 0) return r.note;
  return parts.length ? parts.join(' · ') : '—';
}
