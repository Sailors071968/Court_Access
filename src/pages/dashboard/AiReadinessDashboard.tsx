// ============================================================================
// Program 135 — AI Readiness Dashboard (frontend)
// Surfaces the backend AI orchestration status: provider configuration (never
// fabricated), infrastructure readiness, projected cost, and live usage/cache
// telemetry. Read-only; reflects /api/ai/* endpoints exactly.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Cpu, ShieldCheck, Gauge, DollarSign, Database, CheckCircle2, XCircle,
  Loader2, Info, Server,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';

const API = '/api';
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ProviderStatus {
  providers: Array<{ id: string; label: string; status: string; capabilities: string[]; chatModel: string | null; embeddingModel: string | null; envVar: string; models: Array<{ id: string; capability: string; pricing: { inputPerMTok: number; outputPerMTok: number } }> }>;
  configuredCount: number;
  chatRoutingOrder: string[];
  embeddingRoutingOrder: string[];
}
interface Readiness {
  infrastructureReadinessPercent: number;
  checks: Array<{ id: string; label: string; ready: boolean }>;
  configuredProviders: number;
  readyToActivate: boolean;
  canServeAiRequestsNow: boolean;
  recommendedActivationSequence: Array<{ provider: string; envVar: string; chatModel: string | null; reason: string }>;
  note: string;
}
interface CostEstimate {
  basis: { provider: string; model: string; priceType: string; assumptions: Record<string, number> };
  estimatedCostPerCaseUsd: number;
  estimatedCostPerReportUsd: number;
  estimatedMonthlyCostUsd: number;
  volume: { cases: number; reports: number };
  note: string;
}
interface Usage {
  totals: { calls: number; totalTokens: number; costUsd: number };
  cacheHitRate: number;
  routingEfficiency: number;
  caches: Record<string, { hits: number; misses: number; size: number; hitRate: number }>;
}

export function AiReadinessDashboard() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, r, c, u] = await Promise.all([
          fetch(`${API}/ai/providers/status`, { headers: authHeaders() }).then((x) => x.json()),
          fetch(`${API}/ai/readiness`, { headers: authHeaders() }).then((x) => x.json()),
          fetch(`${API}/ai/cost-estimate?cases=100&reports=300`, { headers: authHeaders() }).then((x) => x.json()),
          fetch(`${API}/ai/usage`, { headers: authHeaders() }).then((x) => x.json()),
        ]);
        if (!cancelled) { setStatus(s); setReadiness(r); setCost(c); setUsage(u); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load AI readiness');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Loading AI readiness…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Cpu size={24} className="text-indigo-600" /> AI Readiness</h1>
        <p className="text-sm text-gray-500 mt-1">Provider orchestration, cost projection, and live telemetry for production AI activation.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Provider status reflects credential presence only and is never fabricated. Cost figures are published list-price <strong>estimates</strong>. Live AI requests return <strong>not_configured</strong> until a real key is added.</span>
      </div>

      {readiness && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<ShieldCheck size={20} />} value={`${readiness.infrastructureReadinessPercent}%`} label="Infrastructure readiness" />
          <StatCard icon={<Server size={20} />} value={readiness.configuredProviders} label="Configured providers" highlight={readiness.configuredProviders === 0} />
          <StatCard icon={<Gauge size={20} />} value={readiness.readyToActivate ? 'Yes' : 'No'} label="Infra ready to activate" />
          <StatCard icon={<Cpu size={20} />} value={readiness.canServeAiRequestsNow ? 'Yes' : 'No'} label="Can serve AI now" highlight={!readiness.canServeAiRequestsNow} />
        </div>
      )}

      {readiness && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Infrastructure Checklist</h3>
          <ul className="space-y-2">
            {readiness.checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                {c.ready ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />}
                {c.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">{readiness.note}</p>
        </Card>
      )}

      {status && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Providers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Capabilities</th>
                  <th className="py-2 px-2">Chat model</th>
                  <th className="py-2 px-2">Credential</th>
                </tr>
              </thead>
              <tbody>
                {status.providers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{p.label}</td>
                    <td className="py-2 px-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${p.status === 'configured' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {p.status === 'configured' ? 'Configured' : 'Not Configured'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-600">{p.capabilities.join(', ')}</td>
                    <td className="py-2 px-2 text-gray-600">{p.chatModel ?? '—'}</td>
                    <td className="py-2 px-2 text-gray-400 font-mono text-xs">{p.envVar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">Chat routing order: {status.chatRoutingOrder.join(' → ')} · Embedding routing order: {status.embeddingRoutingOrder.join(' → ')}</p>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {cost && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign size={18} className="text-emerald-600" /> Cost Projection</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-xl font-bold text-gray-900">${cost.estimatedCostPerCaseUsd}</div><div className="text-xs text-gray-500">per case</div></div>
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-xl font-bold text-gray-900">${cost.estimatedCostPerReportUsd}</div><div className="text-xs text-gray-500">per report</div></div>
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-xl font-bold text-gray-900">${cost.estimatedMonthlyCostUsd}</div><div className="text-xs text-gray-500">/mo ({cost.volume.cases} cases, {cost.volume.reports} reports)</div></div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Basis: {cost.basis.provider} / {cost.basis.model} · {cost.basis.priceType}. {cost.note}</p>
          </Card>
        )}
        {usage && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Database size={18} className="text-indigo-600" /> Live Telemetry</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">{usage.totals.calls}</div><div className="text-xs text-gray-500">AI calls</div></div>
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">{usage.totals.totalTokens}</div><div className="text-xs text-gray-500">tokens</div></div>
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">{Math.round(usage.cacheHitRate * 100)}%</div><div className="text-xs text-gray-500">cache hit rate</div></div>
              <div className="rounded-lg border border-gray-100 p-3"><div className="text-lg font-bold text-gray-900">${usage.totals.costUsd}</div><div className="text-xs text-gray-500">measured cost</div></div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Zero activity is reported honestly until providers are configured and AI requests are made.</p>
          </Card>
        )}
      </div>

      {readiness && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recommended Activation Sequence</h3>
          <ol className="space-y-2">
            {readiness.recommendedActivationSequence.map((a, i) => (
              <li key={a.provider} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{i + 1}</span>
                <span><span className="font-medium text-gray-800">{a.provider}</span> <span className="font-mono text-xs text-gray-400">({a.envVar})</span> — {a.reason}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
