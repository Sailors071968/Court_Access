// ============================================
// Court Access — Evidence Intelligence Dashboard (Phase 150)
// Master dashboard showing all evidence intelligence
// and fact-graph reasoning metrics
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Brain, Shield, AlertTriangle, CheckCircle, Target,
  Users, GitBranch, Layers, BarChart3, Loader2, RefreshCw,
  Scale, FileText, Zap, Activity, Search, Database,
} from 'lucide-react';
import { Card } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  registry: { total: number };
  impacts: { total: number; byLevel: Record<string, number> };
  conflicts: { total: number };
  witnesses: { total: number };
  admissibility: { total: number };
  tasks: { total: number; byStatus: Record<string, number> };
  motions: { total: number };
  legalIssues: { total: number };
  vfr: { totalFacts: number; byType: Record<string, number>; byStatus: Record<string, number>; avgConfidence: number };
  performance: { overallHealth: string; totalMetrics: number };
}

interface DualAnalysisResult {
  id: string;
  layer1Summary: Record<string, unknown>;
  layer2Summary: Record<string, unknown>;
  mergedInsights: { type: string; description: string; severity: string }[];
  totalDurationMs: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/intelligence';

async function fetchJSON(url: string) {
  const token = localStorage.getItem('court_access_token') || '';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJSON(url: string, body: Record<string, unknown> = {}) {
  const token = localStorage.getItem('court_access_token') || '';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, value, color = 'blue', sub }: {
  icon: typeof Brain; label: string; value: string | number; color?: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

function HealthBadge({ health }: { health: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle }> = {
    healthy: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    warning: { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
    degraded: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  };
  const { color, icon: Icon } = config[health] || config.healthy;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon size={12} />
      {health.charAt(0).toUpperCase() + health.slice(1)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity] || colors.medium}`}>
      {severity}
    </span>
  );
}

function FactTypeBar({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-xs text-gray-400">No facts extracted</p>;
  const colors: Record<string, string> = {
    PERSON: 'bg-blue-500', LOCATION: 'bg-green-500', DATE: 'bg-purple-500',
    TIME: 'bg-amber-500', EVENT: 'bg-red-500', OBJECT: 'bg-cyan-500', ACTION: 'bg-pink-500',
  };
  return (
    <div className="space-y-1.5">
      {Object.entries(data).sort(([, a], [, b]) => b - a).map(([type, count]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 truncate">{type}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${colors[type] || 'bg-gray-400'} rounded-full`} style={{ width: `${(count / total) * 100}%` }} />
          </div>
          <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'facts', label: 'Fact Graph', icon: Database },
  { id: 'analysis', label: 'Dual Analysis', icon: Layers },
  { id: 'performance', label: 'Performance', icon: Activity },
] as const;

type TabId = typeof DASHBOARD_TABS[number]['id'];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EvidenceIntelligenceDashboard() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dualResults, setDualResults] = useState<DualAnalysisResult[]>([]);
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [dashData, dualData] = await Promise.allSettled([
        fetchJSON(`${API_BASE}/${caseId}/dashboard`),
        fetchJSON(`${API_BASE}/${caseId}/dual-analysis`),
      ]);
      if (dashData.status === 'fulfilled') setDashboard(dashData.value);
      if (dualData.status === 'fulfilled') setDualResults(Array.isArray(dualData.value) ? dualData.value : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRunDualAnalysis = async () => {
    if (!caseId) return;
    setRunningAnalysis(true);
    try {
      await postJSON(`${API_BASE}/${caseId}/dual-analysis/run`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dual analysis failed');
    } finally {
      setRunningAnalysis(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain size={24} className="text-blue-600" />
            Evidence Intelligence Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Dual-layer evidence analysis — document intelligence + fact-graph reasoning</p>
        </div>
        <div className="flex items-center gap-3">
          {dashboard?.performance && <HealthBadge health={dashboard.performance.overallHealth} />}
          <button onClick={loadData} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {DASHBOARD_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Overview Tab */}
      {!loading && activeTab === 'overview' && dashboard && (
        <>
          <div className="grid grid-cols-5 gap-4">
            <StatCard icon={FileText} label="Evidence Items" value={dashboard.registry.total} color="blue" />
            <StatCard icon={AlertTriangle} label="Conflicts" value={dashboard.conflicts.total} color="red" />
            <StatCard icon={Users} label="Witnesses" value={dashboard.witnesses.total} color="green" />
            <StatCard icon={Shield} label="Admissibility Issues" value={dashboard.admissibility.total} color="amber" />
            <StatCard icon={Scale} label="Motion Opportunities" value={dashboard.motions.total} color="purple" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Target size={14} className="text-blue-600" /> Impact Distribution
              </h3>
              {dashboard.impacts.total > 0 ? (
                <div className="space-y-2">
                  {Object.entries(dashboard.impacts.byLevel).sort().map(([level, count]) => (
                    <div key={level} className="flex items-center gap-2">
                      <SeverityBadge severity={level} />
                      <div className="flex-1 h-2 bg-gray-100 rounded-full">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / dashboard.impacts.total) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No impacts scored yet</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Target size={14} className="text-amber-600" /> Task Status
              </h3>
              {dashboard.tasks.total > 0 ? (
                <div className="space-y-2">
                  {Object.entries(dashboard.tasks.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 capitalize">{status.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No investigative tasks yet</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <GitBranch size={14} className="text-red-600" /> Legal Issues
              </h3>
              <p className="text-3xl font-bold text-gray-900">{dashboard.legalIssues.total}</p>
              <p className="text-xs text-gray-400 mt-1">Constitutional / evidentiary issues detected</p>
            </Card>
          </div>
        </>
      )}

      {!loading && activeTab === 'overview' && !dashboard && (
        <div className="text-center py-12">
          <Brain size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No intelligence data available for this case.</p>
          <p className="text-xs text-gray-400 mt-1">Upload evidence and run the analysis pipeline to populate this dashboard.</p>
        </div>
      )}

      {/* Facts Tab */}
      {!loading && activeTab === 'facts' && dashboard && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Database size={14} className="text-blue-600" /> Verified Fact Registry
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-3xl font-bold text-gray-900">{dashboard.vfr.totalFacts || 0}</p>
                <p className="text-xs text-gray-400">Total Facts</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600">{Math.round((dashboard.vfr.avgConfidence || 0) * 100)}%</p>
                <p className="text-xs text-gray-400">Avg Confidence</p>
              </div>
            </div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">By Type</h4>
            <FactTypeBar data={dashboard.vfr.byType || {}} />
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <CheckCircle size={14} className="text-green-600" /> Verification Status
            </h3>
            {dashboard.vfr.byStatus && Object.keys(dashboard.vfr.byStatus).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(dashboard.vfr.byStatus).map(([status, count]) => {
                  const colors: Record<string, string> = {
                    verified: 'bg-green-500', corroborated: 'bg-blue-500', unverified: 'bg-gray-400',
                    disputed: 'bg-red-500', retracted: 'bg-gray-300', merged: 'bg-purple-400',
                  };
                  const total = dashboard.vfr.totalFacts || 1;
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-24 capitalize">{status}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${colors[status] || 'bg-gray-400'} rounded-full`} style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No verified facts yet</p>
            )}
          </Card>
        </div>
      )}

      {/* Dual Analysis Tab */}
      {!loading && activeTab === 'analysis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Dual-Layer Analysis Results</h3>
            <button
              onClick={handleRunDualAnalysis}
              disabled={runningAnalysis}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {runningAnalysis ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {runningAnalysis ? 'Running...' : 'Run Dual Analysis'}
            </button>
          </div>

          {dualResults.length === 0 ? (
            <div className="text-center py-12">
              <Layers size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No dual analysis results yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click Run Dual Analysis to execute both evidence intelligence and fact-graph reasoning layers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dualResults.map((result) => (
                <Card key={result.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">{new Date(result.createdAt).toLocaleString()}</span>
                    <span className="text-xs text-gray-400">{result.totalDurationMs}ms</span>
                  </div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Merged Insights</h4>
                  {result.mergedInsights.length > 0 ? (
                    <div className="space-y-2">
                      {result.mergedInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                          <SeverityBadge severity={insight.severity} />
                          <div>
                            <p className="text-xs font-medium text-gray-700 capitalize">{insight.type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{insight.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No critical insights from this analysis run.</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Performance Tab */}
      {!loading && activeTab === 'performance' && dashboard && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Activity size={14} className="text-blue-600" /> Pipeline Health
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <HealthBadge health={dashboard.performance.overallHealth} />
              <span className="text-xs text-gray-500">{dashboard.performance.totalMetrics} metrics recorded</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Pipeline health is calculated from operation durations against configured thresholds.
              Warning: operation exceeds warn threshold. Degraded: operation exceeds critical threshold.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Search size={14} className="text-green-600" /> Quick Actions
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Run Fact Extraction', endpoint: 'facts/extract', icon: FileText },
                { label: 'Detect Conflicts', endpoint: 'conflicts/detect', icon: AlertTriangle },
                { label: 'Spot Legal Issues', endpoint: 'legal-issues/spot', icon: Shield },
                { label: 'Generate Motions', endpoint: 'motions/generate', icon: Scale },
                { label: 'Audit Neutrality', endpoint: 'neutrality/audit', icon: CheckCircle },
              ].map((action) => (
                <button
                  key={action.endpoint}
                  onClick={() => caseId && postJSON(`${API_BASE}/${caseId}/${action.endpoint}`).then(loadData).catch(console.error)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 border border-gray-200"
                >
                  <action.icon size={12} className="text-gray-400" />
                  {action.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
