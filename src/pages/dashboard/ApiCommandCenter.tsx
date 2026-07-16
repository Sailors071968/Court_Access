// ============================================================================
// Program 140 — API Command Center (SUPER-ADMIN ONLY)
// Executive operations center for every external provider, AI model, datastore,
// and system integration powering CourtAccess. Backed by the admin-only
// /api/command-center endpoints. Provider connectivity is Verified / Unavailable
// / Not Configured / UNKNOWN — never fabricated. Route is gated to admins via
// ProtectedRoute(requiredPermission="canViewAdmin"); the backend independently
// enforces admin authorization and audit-logs every access.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  ServerCog, Cpu, Database, Activity, ShieldCheck, DollarSign, Loader2, Info,
  CheckCircle2, XCircle, HelpCircle, CircleSlash, PlayCircle, Boxes, Users, FlaskConical,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';

const API = '/api';
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type Connectivity = 'verified' | 'unavailable' | 'not_configured' | 'unknown';
interface Provider {
  id: string; label: string; category: string; envVars: string[]; configured: boolean;
  connectivity: Connectivity; latencyMs: number | null; lastVerified: string | null; message: string; runtimeCheckable: boolean;
}
interface AiModel {
  provider: string; providerLabel: string; model: string; status: string;
  estimatedCostPer1kTokens: number; contextWindow: number | null; capabilities: string[]; preferredWorkloads: string[];
}
interface Overview {
  providers: Provider[];
  providerSummary: { total: number; verified: number; configured: number; notConfigured: number; unknown: number; unavailable: number };
  aiModels: AiModel[];
  subscription: { planId: string; status: string; tier: string; billingPeriodEnd: string; trialEndsAt: string | null } | null;
  usage: { totals: { calls: number; totalTokens: number; costUsd: number }; cacheHitRate: number };
  costProjection: { estimatedMonthlyUsd: number; basis: string; note: string };
  systemHealth: {
    overall: string; uptimeSeconds: number | null;
    components: Record<string, { status: string; latencyMs: number; message?: string }>;
    workers: Record<string, { waiting: number; active: number; completed: number; failed: number }>;
    repository: { cases: number; evidence: number; charges: number };
  };
}

const CONN_META: Record<Connectivity, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  unavailable: { label: 'Unavailable', cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  not_configured: { label: 'Not Configured', cls: 'bg-gray-100 text-gray-500 border-gray-300', icon: CircleSlash },
  unknown: { label: 'UNKNOWN', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: HelpCircle },
};
const CATEGORY_LABEL: Record<string, string> = {
  ai: 'AI Providers', 'litigation-data': 'Litigation Data', geo: 'Geospatial', communications: 'Communications',
  payments: 'Payments', cloud: 'Cloud', datastore: 'Datastores', devops: 'DevOps',
};
function healthCls(status: string) {
  return status === 'healthy' ? 'text-emerald-600' : status === 'degraded' ? 'text-amber-600' : status === 'unhealthy' ? 'text-red-600' : 'text-gray-500';
}

export function ApiCommandCenter() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { result: string; message: string; latencyMs: number | null }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/command-center/overview`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 403 ? ' — administrator access required' : ''}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const testProvider = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch(`${API}/command-center/test/${id}`, { method: 'POST', headers: authHeaders() });
      const body = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: { result: body.result, message: body.message, latencyMs: body.latencyMs ?? null } }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { result: 'error', message: 'Request failed', latencyMs: null } }));
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Loading API Command Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const cats = [...new Set(data.providers.map((p) => p.category))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ServerCog size={24} className="text-indigo-600" /> API Command Center</h1>
        <p className="text-sm text-gray-500 mt-1">Executive operations center for every provider, AI model, datastore, and integration. Super-administrator access only.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Provider connectivity is verified in-process for datastores and derived from credential presence for external providers. Connectivity is never fabricated — <strong>UNKNOWN</strong> is shown wherever a live check cannot be performed. Every access is authorization-checked and audit-logged.</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<ServerCog size={20} />} value={data.providerSummary.total} label="Integrations" />
        <StatCard icon={<CheckCircle2 size={20} />} value={data.providerSummary.verified} label="Verified" />
        <StatCard icon={<ShieldCheck size={20} />} value={data.providerSummary.configured} label="Configured" />
        <StatCard icon={<HelpCircle size={20} />} value={data.providerSummary.unknown} label="UNKNOWN" highlight={data.providerSummary.unknown > 0} />
        <StatCard icon={<Activity size={20} />} value={data.systemHealth.overall} label="System health" />
        <StatCard icon={<Cpu size={20} />} value={data.aiModels.length} label="AI models" />
      </div>

      {/* System Health */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Activity size={18} className="text-indigo-600" /> System Health</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(data.systemHealth.components).map(([name, c]) => (
            <div key={name} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize text-gray-800 flex items-center gap-1.5"><Database size={13} className="text-gray-400" />{name}</span>
                <span className={`text-xs font-semibold ${healthCls(c.status)}`}>{c.status}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">{c.latencyMs}ms{c.message ? ` · ${c.message}` : ''}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-gray-100 p-3 text-center"><div className="text-xl font-bold text-gray-900">{data.systemHealth.repository.cases}</div><div className="text-xs text-gray-500">cases</div></div>
          <div className="rounded-lg border border-gray-100 p-3 text-center"><div className="text-xl font-bold text-gray-900">{data.systemHealth.repository.evidence}</div><div className="text-xs text-gray-500">evidence</div></div>
          <div className="rounded-lg border border-gray-100 p-3 text-center"><div className="text-xl font-bold text-gray-900">{data.systemHealth.repository.charges}</div><div className="text-xs text-gray-500">charges</div></div>
        </div>
        {Object.keys(data.systemHealth.workers).length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Workers / Queues</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(data.systemHealth.workers).map(([q, s]) => (
                <span key={q} className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600">{q}: {s.active}a/{s.waiting}w/{s.failed}f</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Provider Dashboard */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><ServerCog size={18} className="text-indigo-600" /> Provider Dashboard</h3>
        <div className="space-y-4">
          {cats.map((cat) => (
            <div key={cat}>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{CATEGORY_LABEL[cat] ?? cat}</div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.providers.filter((p) => p.category === cat).map((p) => {
                  const m = CONN_META[p.connectivity];
                  const MIcon = m.icon;
                  const tr = testResults[p.id];
                  return (
                    <div key={p.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{p.label}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}><MIcon size={11} />{m.label}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">{p.latencyMs != null ? `${p.latencyMs}ms · ` : ''}{p.message}</div>
                      <div className="mt-1 text-[10px] font-mono text-gray-400">{p.envVars.join(', ')}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <button onClick={() => testProvider(p.id)} disabled={testing === p.id} className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                          {testing === p.id ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={11} />} Test
                        </button>
                        {tr && <span className={`text-[11px] font-medium ${tr.result === 'verified' ? 'text-emerald-600' : tr.result === 'unavailable' || tr.result === 'error' ? 'text-red-600' : tr.result === 'not_configured' ? 'text-gray-500' : 'text-amber-600'}`}>{tr.result}{tr.latencyMs != null ? ` (${tr.latencyMs}ms)` : ''}</span>}
                      </div>
                      {tr && <div className="mt-1 text-[10px] text-gray-400">{tr.message}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Command Center */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Cpu size={18} className="text-indigo-600" /> AI Command Center</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Model</th><th className="py-2 px-2">Status</th><th className="py-2 px-2 text-right">$/1k tok</th>
                <th className="py-2 px-2 text-right">Context</th><th className="py-2 px-2">Capabilities</th><th className="py-2 px-2">Preferred workloads</th>
              </tr>
            </thead>
            <tbody>
              {data.aiModels.map((m) => (
                <tr key={`${m.provider}-${m.model}`} className="border-b border-gray-100">
                  <td className="py-2 pr-3"><span className="font-medium text-gray-800">{m.model}</span><span className="block text-xs text-gray-400">{m.providerLabel}</span></td>
                  <td className="py-2 px-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${m.status === 'configured' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>{m.status === 'configured' ? 'Configured' : 'Not Configured'}</span></td>
                  <td className="py-2 px-2 text-right text-gray-700">${m.estimatedCostPer1kTokens}</td>
                  <td className="py-2 px-2 text-right text-gray-700">{m.contextWindow ? `${(m.contextWindow / 1000).toLocaleString()}k` : 'UNKNOWN'}</td>
                  <td className="py-2 px-2 text-gray-600">{m.capabilities.join(', ') || 'UNKNOWN'}</td>
                  <td className="py-2 px-2 text-gray-600">{m.preferredWorkloads.join(', ') || 'UNKNOWN'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">Costs and context windows are published list-price / spec estimates for display; live availability requires a configured credential.</p>
      </Card>

      {/* Subscription + Cost */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign size={18} className="text-emerald-600" /> Subscription</h3>
          {data.subscription ? (
            <div className="space-y-1 text-sm text-gray-700">
              <div><span className="text-gray-500">Plan:</span> {data.subscription.planId} ({data.subscription.tier})</div>
              <div><span className="text-gray-500">Status:</span> {data.subscription.status}</div>
              <div><span className="text-gray-500">Billing period end:</span> {new Date(data.subscription.billingPeriodEnd).toLocaleDateString()}</div>
              {data.subscription.trialEndsAt && <div><span className="text-gray-500">Trial ends:</span> {new Date(data.subscription.trialEndsAt).toLocaleDateString()}</div>}
            </div>
          ) : <p className="text-sm text-gray-500">No subscription record for this account (UNKNOWN).</p>}
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Boxes size={18} className="text-indigo-600" /> Usage &amp; Cost Projection</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">{data.usage.totals.calls}</div><div className="text-xs text-gray-500">AI calls</div></div>
            <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">{data.usage.totals.totalTokens}</div><div className="text-xs text-gray-500">tokens</div></div>
            <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">{Math.round(data.usage.cacheHitRate * 100)}%</div><div className="text-xs text-gray-500">cache hit rate</div></div>
            <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">${data.costProjection.estimatedMonthlyUsd}</div><div className="text-xs text-gray-500">est. monthly</div></div>
          </div>
          <p className="mt-2 text-xs text-gray-400">{data.costProjection.note} Basis: {data.costProjection.basis}.</p>
        </Card>
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1"><Users size={11} /> Super-admin only</span>
        <span className="inline-flex items-center gap-1"><FlaskConical size={11} /> Live runtime verification (datastores)</span>
        <span className="inline-flex items-center gap-1"><HelpCircle size={11} /> UNKNOWN where unverifiable</span>
      </div>
    </div>
  );
}
