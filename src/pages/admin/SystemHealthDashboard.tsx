// ============================================
// Court Access — System Health Dashboard
// Phase 119: Production Hardening
//
// Unified dashboard for:
// - Worker queue status (BullMQ)
// - AI usage metrics
// - Graph database health
// - API latency tracking
// - Performance profiling summary
// ============================================

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Brain,
  Database,
  Gauge,
  GitBranch,
  Layers,
  RefreshCw,
  Server,
  Shield,
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthStatus = 'healthy' | 'degraded' | 'critical';
type TabId = 'overview' | 'queues' | 'ai' | 'graph' | 'performance' | 'security';

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface AIUsageMetrics {
  requestsToday: number;
  tokensUsed: number;
  tokenLimit: number;
  avgResponseTime: number;
  errorRate: number;
  rateLimitHits: number;
}

interface GraphHealth {
  nodeCount: number;
  edgeCount: number;
  avgQueryTime: number;
  cacheHitRate: number;
  lastIntegrityCheck: string;
  integrityStatus: HealthStatus;
  duplicateNodes: number;
  orphanNodes: number;
  crossCaseIssues: number;
}

interface PerformanceMetrics {
  category: string;
  count: number;
  avgMs: number;
  maxMs: number;
  slowCount: number;
  threshold: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const QUEUE_DATA: QueueStatus[] = [
  { name: 'document-processing', waiting: 3, active: 2, completed: 1247, failed: 5, delayed: 0 },
  { name: 'entity-indexing', waiting: 8, active: 1, completed: 890, failed: 2, delayed: 1 },
  { name: 'timeline-generation', waiting: 2, active: 1, completed: 456, failed: 0, delayed: 0 },
  { name: 'conflict-detection', waiting: 0, active: 0, completed: 234, failed: 1, delayed: 0 },
  { name: 'graph-builder', waiting: 5, active: 2, completed: 678, failed: 3, delayed: 2 },
];

const AI_USAGE: AIUsageMetrics = {
  requestsToday: 342,
  tokensUsed: 145000,
  tokenLimit: 500000,
  avgResponseTime: 2400,
  errorRate: 0.008,
  rateLimitHits: 3,
};

const GRAPH_HEALTH: GraphHealth = {
  nodeCount: 15420,
  edgeCount: 42680,
  avgQueryTime: 45,
  cacheHitRate: 0.82,
  lastIntegrityCheck: '2026-03-06T15:00:00Z',
  integrityStatus: 'healthy',
  duplicateNodes: 0,
  orphanNodes: 12,
  crossCaseIssues: 0,
};

const PERF_METRICS: PerformanceMetrics[] = [
  { category: 'Graph Queries', count: 1580, avgMs: 42, maxMs: 185, slowCount: 0, threshold: 200 },
  { category: 'Timeline Queries', count: 890, avgMs: 67, maxMs: 195, slowCount: 2, threshold: 200 },
  { category: 'Entity Extraction', count: 234, avgMs: 3200, maxMs: 4800, slowCount: 0, threshold: 5000 },
  { category: 'AI Analysis', count: 342, avgMs: 2400, maxMs: 8500, slowCount: 5, threshold: 10000 },
  { category: 'API Endpoints', count: 12450, avgMs: 85, maxMs: 450, slowCount: 8, threshold: 500 },
];

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function HealthBadge({ status }: { status: HealthStatus }) {
  const cfg = {
    healthy: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Healthy' },
    degraded: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Degraded' },
    critical: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Critical' },
  };
  const c = cfg[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon size={16} className="text-slate-400" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <span className="text-emerald-500 text-xs">+</span>}
          {trend === 'down' && <span className="text-red-500 text-xs">-</span>}
          <span className="text-xs text-slate-500">{sub}</span>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color = 'blue' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${colorMap[color] || colorMap.blue}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SystemHealthDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const overallHealth: HealthStatus =
    GRAPH_HEALTH.crossCaseIssues > 0 ? 'critical' :
    QUEUE_DATA.some(q => q.failed > 3) || AI_USAGE.errorRate > 0.05 ? 'degraded' :
    'healthy';

  const totalQueueJobs = QUEUE_DATA.reduce((sum, q) => sum + q.waiting + q.active, 0);
  const totalQueueFailed = QUEUE_DATA.reduce((sum, q) => sum + q.failed, 0);

  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'queues', label: 'Queue Monitor', icon: Layers },
    { id: 'ai', label: 'AI Usage', icon: Brain },
    { id: 'graph', label: 'Graph Health', icon: GitBranch },
    { id: 'performance', label: 'Performance', icon: Gauge },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Health Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Phase 119 — Production Hardening Monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <HealthBadge status={overallHealth} />
            <button className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1 w-fit overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Layers} label="Queue Backlog" value={String(totalQueueJobs)} sub={`${totalQueueFailed} failed`} trend="flat" />
              <StatCard icon={Brain} label="AI Requests (24h)" value={AI_USAGE.requestsToday.toLocaleString()} sub={`${(AI_USAGE.tokensUsed / 1000).toFixed(0)}K tokens`} trend="up" />
              <StatCard icon={GitBranch} label="Graph Nodes" value={GRAPH_HEALTH.nodeCount.toLocaleString()} sub={`${GRAPH_HEALTH.edgeCount.toLocaleString()} edges`} />
              <StatCard icon={Zap} label="Avg API Latency" value={`${PERF_METRICS.find(p => p.category === 'API Endpoints')?.avgMs || 0}ms`} sub="Target: <500ms" trend="down" />
            </div>

            {/* Quick Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Queue Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Layers size={16} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Queue Status</h3>
                </div>
                {QUEUE_DATA.map(q => (
                  <div key={q.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-600 truncate">{q.name}</span>
                    <div className="flex items-center gap-2">
                      {q.waiting + q.active > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{q.waiting + q.active}</span>
                      )}
                      {q.failed > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{q.failed}</span>
                      )}
                      {q.waiting + q.active === 0 && q.failed === 0 && (
                        <CheckCircle size={14} className="text-emerald-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Usage Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={16} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-900">AI Usage</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500">Token Usage</span>
                      <span className="text-slate-700 font-medium">{((AI_USAGE.tokensUsed / AI_USAGE.tokenLimit) * 100).toFixed(1)}%</span>
                    </div>
                    <ProgressBar value={AI_USAGE.tokensUsed} max={AI_USAGE.tokenLimit} color="blue" />
                    <div className="text-xs text-slate-400 mt-1">{(AI_USAGE.tokensUsed / 1000).toFixed(0)}K / {(AI_USAGE.tokenLimit / 1000).toFixed(0)}K tokens</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg text-center">
                      <div className="text-lg font-bold text-slate-900">{AI_USAGE.avgResponseTime}ms</div>
                      <div className="text-xs text-slate-500">Avg Response</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-center">
                      <div className="text-lg font-bold text-slate-900">{(AI_USAGE.errorRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">Error Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Graph Health Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch size={16} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Graph Database</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Integrity</span>
                    <HealthBadge status={GRAPH_HEALTH.integrityStatus} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Cache Hit Rate</span>
                    <span className="text-sm font-medium text-slate-700">{(GRAPH_HEALTH.cacheHitRate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Avg Query Time</span>
                    <span className="text-sm font-medium text-slate-700">{GRAPH_HEALTH.avgQueryTime}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Orphan Nodes</span>
                    <span className={`text-sm font-medium ${GRAPH_HEALTH.orphanNodes > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{GRAPH_HEALTH.orphanNodes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Last Check</span>
                    <span className="text-xs text-slate-500">{new Date(GRAPH_HEALTH.lastIntegrityCheck).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue Monitor Tab */}
        {activeTab === 'queues' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Worker Queue Monitor</h2>
              <p className="text-sm text-slate-500 mt-1">BullMQ queue status for all background workers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Queue</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Waiting</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Active</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Completed</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Failed</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Delayed</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {QUEUE_DATA.map(q => {
                    const health: HealthStatus = q.failed > 5 ? 'critical' : q.failed > 0 ? 'degraded' : 'healthy';
                    return (
                      <tr key={q.name} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Server size={14} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">{q.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-4 py-3 text-sm text-slate-600">{q.waiting}</td>
                        <td className="text-center px-4 py-3">
                          <span className={`text-sm ${q.active > 0 ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>{q.active}</span>
                        </td>
                        <td className="text-center px-4 py-3 text-sm text-emerald-600">{q.completed.toLocaleString()}</td>
                        <td className="text-center px-4 py-3">
                          <span className={`text-sm ${q.failed > 0 ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{q.failed}</span>
                        </td>
                        <td className="text-center px-4 py-3 text-sm text-slate-600">{q.delayed}</td>
                        <td className="text-center px-4 py-3"><HealthBadge status={health} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Usage Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Brain} label="Requests Today" value={AI_USAGE.requestsToday.toLocaleString()} />
              <StatCard icon={Zap} label="Tokens Used" value={`${(AI_USAGE.tokensUsed / 1000).toFixed(0)}K`} sub={`of ${(AI_USAGE.tokenLimit / 1000).toFixed(0)}K limit`} />
              <StatCard icon={Clock} label="Avg Response" value={`${(AI_USAGE.avgResponseTime / 1000).toFixed(1)}s`} />
              <StatCard icon={AlertTriangle} label="Rate Limit Hits" value={String(AI_USAGE.rateLimitHits)} sub="Last 24 hours" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">AI Safety Guardrails</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Max Tokens per Request', value: '4,000', status: 'active' },
                  { label: 'Max Tokens per Minute', value: '20,000', status: 'active' },
                  { label: 'Request Timeout', value: '30s', status: 'active' },
                  { label: 'Rate Limit (per user)', value: '10 req/min', status: 'active' },
                  { label: 'Prompt Injection Defense', value: 'Enabled', status: 'active' },
                  { label: 'Response Validation', value: 'Enabled', status: 'active' },
                  { label: 'Content Sanitization', value: 'Enabled', status: 'active' },
                  { label: 'Raw Document Access', value: 'Blocked', status: 'active' },
                ].map(guard => (
                  <div key={guard.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">{guard.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{guard.value}</span>
                      <CheckCircle size={14} className="text-emerald-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Graph Health Tab */}
        {activeTab === 'graph' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={GitBranch} label="Total Nodes" value={GRAPH_HEALTH.nodeCount.toLocaleString()} />
              <StatCard icon={Database} label="Total Edges" value={GRAPH_HEALTH.edgeCount.toLocaleString()} />
              <StatCard icon={Zap} label="Avg Query Time" value={`${GRAPH_HEALTH.avgQueryTime}ms`} sub="Target: <200ms" />
              <StatCard icon={Activity} label="Cache Hit Rate" value={`${(GRAPH_HEALTH.cacheHitRate * 100).toFixed(0)}%`} />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Integrity Check Results</h3>
              <div className="space-y-3">
                {[
                  { label: 'Duplicate Nodes', value: GRAPH_HEALTH.duplicateNodes, ok: GRAPH_HEALTH.duplicateNodes === 0 },
                  { label: 'Orphan Nodes', value: GRAPH_HEALTH.orphanNodes, ok: GRAPH_HEALTH.orphanNodes < 20 },
                  { label: 'Cross-Case Contamination', value: GRAPH_HEALTH.crossCaseIssues, ok: GRAPH_HEALTH.crossCaseIssues === 0 },
                ].map(check => (
                  <div key={check.label} className="flex items-center justify-between p-4 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      {check.ok ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                      <span className="text-sm font-medium text-slate-700">{check.label}</span>
                    </div>
                    <span className={`text-lg font-bold ${check.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{check.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-slate-400">
                Last check: {new Date(GRAPH_HEALTH.lastIntegrityCheck).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Performance Profiling</h2>
              <p className="text-sm text-slate-500 mt-1">Operation timing metrics (last 24 hours)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Requests</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Avg (ms)</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Max (ms)</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Slow</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Threshold</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {PERF_METRICS.map(m => {
                    const ok = m.maxMs < m.threshold;
                    return (
                      <tr key={m.category} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm font-medium text-slate-900">{m.category}</td>
                        <td className="text-center px-4 py-3 text-sm text-slate-600">{m.count.toLocaleString()}</td>
                        <td className="text-center px-4 py-3 text-sm text-slate-600">{m.avgMs}</td>
                        <td className="text-center px-4 py-3">
                          <span className={`text-sm font-medium ${ok ? 'text-slate-600' : 'text-amber-600'}`}>{m.maxMs}</span>
                        </td>
                        <td className="text-center px-4 py-3">
                          <span className={`text-sm ${m.slowCount > 0 ? 'text-amber-600 font-medium' : 'text-slate-600'}`}>{m.slowCount}</span>
                        </td>
                        <td className="text-center px-4 py-3 text-sm text-slate-400">{m.threshold}ms</td>
                        <td className="text-center px-4 py-3">
                          {ok ? <CheckCircle size={16} className="text-emerald-500 mx-auto" /> : <AlertTriangle size={16} className="text-amber-500 mx-auto" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Security Audit Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'JWT Validation', desc: 'All protected routes use authenticate middleware', ok: true },
                  { label: 'Tenant Isolation', desc: 'All queries scoped by caseId + user ownership', ok: true },
                  { label: 'Cypher Injection', desc: 'Relationship types validated against enum', ok: true },
                  { label: 'SQL Injection', desc: 'Prisma ORM with parameterized queries', ok: true },
                  { label: 'Rate Limiting', desc: 'API: 100/min, Auth: 10/15min, Upload: 20/min', ok: true },
                  { label: 'CORS', desc: 'Explicit origin allowlist configured', ok: true },
                  { label: 'Helmet Headers', desc: 'CSP, HSTS, X-Frame-Options active', ok: true },
                  { label: 'Upload Limits', desc: 'Fail-closed enforcement with virus scanning', ok: true },
                  { label: 'Neo4j Credentials', desc: 'Read from environment only (no defaults)', ok: true },
                  { label: 'Redis SCAN', desc: 'Cache invalidation uses SCAN (not KEYS)', ok: true },
                ].map(check => (
                  <div key={check.label} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{check.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{check.desc}</div>
                    </div>
                    {check.ok ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={18} className="text-red-500 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemHealthDashboard;
