// ============================================
// Court Access — Admin Monitoring Page (Phase 17: Observability)
// System health, failed jobs, processing backlog, error tracking.
// ============================================

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthStatus = 'healthy' | 'degraded' | 'down';
type TabId = 'overview' | 'jobs' | 'errors' | 'logs';

interface ServiceStatus {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  errorRate: number;
  uptime: string;
}

interface FailedJob {
  id: string;
  type: string;
  error: string;
  timestamp: string;
  attempts: number;
  caseId: string;
}

interface ErrorEntry {
  id: string;
  message: string;
  service: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const SERVICES: ServiceStatus[] = [
  { name: 'API Server', status: 'healthy', latencyMs: 45, errorRate: 0.001, uptime: '99.98%' },
  { name: 'Evidence Storage (R2)', status: 'healthy', latencyMs: 120, errorRate: 0, uptime: '100%' },
  { name: 'Document Processor', status: 'healthy', latencyMs: 2100, errorRate: 0.005, uptime: '99.9%' },
  { name: 'Audio Transcription', status: 'degraded', latencyMs: 8500, errorRate: 0.02, uptime: '99.5%' },
  { name: 'Video Analysis', status: 'healthy', latencyMs: 15000, errorRate: 0.01, uptime: '99.7%' },
  { name: 'Search Index', status: 'healthy', latencyMs: 30, errorRate: 0, uptime: '100%' },
  { name: 'PostgreSQL', status: 'healthy', latencyMs: 5, errorRate: 0, uptime: '100%' },
  { name: 'Redis Queue', status: 'healthy', latencyMs: 2, errorRate: 0, uptime: '100%' },
];

const FAILED_JOBS: FailedJob[] = [
  { id: 'job-001', type: 'Audio Transcription', error: 'Timeout: processing exceeded 600s limit', timestamp: '2026-03-05T18:30:00Z', attempts: 3, caseId: 'CA-2024-001' },
  { id: 'job-002', type: 'Video Analysis', error: 'Unsupported codec: HEVC not available', timestamp: '2026-03-05T17:45:00Z', attempts: 2, caseId: 'CA-2024-003' },
  { id: 'job-003', type: 'Document Analysis', error: 'Password-protected PDF', timestamp: '2026-03-05T16:20:00Z', attempts: 1, caseId: 'CA-2024-002' },
];

const ERRORS: ErrorEntry[] = [
  { id: 'err-001', message: 'Audio transcription timeout', service: 'audio-processor', count: 12, firstSeen: '2026-03-04T10:00:00Z', lastSeen: '2026-03-05T18:30:00Z', resolved: false },
  { id: 'err-002', message: 'R2 upload rate limit exceeded', service: 'evidence-storage', count: 3, firstSeen: '2026-03-05T14:00:00Z', lastSeen: '2026-03-05T14:15:00Z', resolved: true },
  { id: 'err-003', message: 'Search index rebuild failed', service: 'search-engine', count: 1, firstSeen: '2026-03-05T12:00:00Z', lastSeen: '2026-03-05T12:00:00Z', resolved: true },
];

const LOGS: LogEntry[] = [
  { timestamp: '2026-03-05T18:55:00Z', level: 'info', service: 'api', message: 'Evidence uploaded: doc-2024-0145.pdf (2.3 MB)' },
  { timestamp: '2026-03-05T18:52:00Z', level: 'warn', service: 'audio-processor', message: 'Transcription queue depth: 15 jobs pending' },
  { timestamp: '2026-03-05T18:50:00Z', level: 'error', service: 'audio-processor', message: 'Job job-001 failed after 3 attempts: timeout' },
  { timestamp: '2026-03-05T18:48:00Z', level: 'info', service: 'search', message: 'Index updated: 342 documents, 1.2M tokens' },
  { timestamp: '2026-03-05T18:45:00Z', level: 'info', service: 'integrity', message: 'Daily anchor chain verified: 28 evidence items' },
  { timestamp: '2026-03-05T18:40:00Z', level: 'info', service: 'api', message: 'New user registered: attorney@lawfirm.com' },
  { timestamp: '2026-03-05T18:35:00Z', level: 'warn', service: 'video-processor', message: 'HEVC codec not supported, falling back to software decode' },
  { timestamp: '2026-03-05T18:30:00Z', level: 'info', service: 'export', message: 'Court packet generated: CA-2024-001 (45 pages)' },
];

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: HealthStatus }) {
  const config = {
    healthy: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Healthy' },
    degraded: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Degraded' },
    down: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Down' },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}

function LogLevelBadge({ level }: { level: 'info' | 'warn' | 'error' }) {
  const config = {
    info: 'bg-blue-100 text-blue-700',
    warn: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${config[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: LucideIcon }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon size={18} className="text-slate-400" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [logFilter, setLogFilter] = useState<'all' | 'warn' | 'error'>('all');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const filteredLogs = logFilter === 'all'
    ? LOGS
    : LOGS.filter((l) => l.level === logFilter || (logFilter === 'warn' && l.level === 'error'));

  const overallHealth: HealthStatus = SERVICES.some((s) => s.status === 'down')
    ? 'down'
    : SERVICES.some((s) => s.status === 'degraded')
    ? 'degraded'
    : 'healthy';

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'jobs', label: 'Failed Jobs', count: FAILED_JOBS.length },
    { id: 'errors', label: 'Errors', count: ERRORS.filter((e) => !e.resolved).length },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Monitoring</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time platform health and processing status</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={overallHealth} />
            <button className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard icon={Activity} label="Total Jobs (24h)" value="1,247" sub="98.2% success rate" />
              <MetricCard icon={Clock} label="Avg Processing Time" value="4.2s" sub="Documents: 1.8s | Audio: 12s" />
              <MetricCard icon={HardDrive} label="Storage Used" value="2.4 GB" sub="of 10 GB beta limit" />
              <MetricCard icon={Cpu} label="Queue Depth" value="15" sub="3 active, 12 waiting" />
            </div>

            {/* Services Table */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Service Health</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Service</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Latency</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Error Rate</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Uptime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SERVICES.map((svc) => (
                      <tr key={svc.name} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Server size={14} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">{svc.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3"><StatusBadge status={svc.status} /></td>
                        <td className="px-6 py-3 text-sm text-slate-600">{svc.latencyMs}ms</td>
                        <td className="px-6 py-3 text-sm text-slate-600">{(svc.errorRate * 100).toFixed(2)}%</td>
                        <td className="px-6 py-3 text-sm text-slate-600">{svc.uptime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Processing Backlog */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Processing Backlog</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Evidence Ingestion', pending: 3, active: 2 },
                  { label: 'Document Analysis', pending: 5, active: 1 },
                  { label: 'Audio Transcription', pending: 8, active: 2 },
                  { label: 'Video Analysis', pending: 2, active: 1 },
                  { label: 'Image Analysis', pending: 0, active: 0 },
                ].map((q) => (
                  <div key={q.label} className="text-center p-3 rounded-lg bg-slate-50">
                    <div className="text-xs text-slate-500 mb-2">{q.label}</div>
                    <div className="text-xl font-bold text-slate-900">{q.pending + q.active}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {q.active} active / {q.pending} queued
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Failed Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Failed Jobs</h2>
              <span className="text-sm text-slate-500">{FAILED_JOBS.length} failed jobs</span>
            </div>
            <div className="divide-y divide-slate-100">
              {FAILED_JOBS.map((job) => (
                <div key={job.id} className="px-6 py-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  >
                    <div className="flex items-center gap-3">
                      <XCircle size={16} className="text-red-500" />
                      <div>
                        <span className="text-sm font-medium text-slate-900">{job.type}</span>
                        <span className="text-xs text-slate-400 ml-2">({job.id})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">
                        {new Date(job.timestamp).toLocaleString()}
                      </span>
                      {expandedJob === job.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                  {expandedJob === job.id && (
                    <div className="mt-3 ml-7 p-3 bg-red-50 rounded-lg text-sm">
                      <div className="text-red-800 font-mono mb-2">{job.error}</div>
                      <div className="flex gap-4 text-xs text-red-600">
                        <span>Attempts: {job.attempts}</span>
                        <span>Case: {job.caseId}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="px-3 py-1 text-xs bg-white border border-red-200 rounded hover:bg-red-50 text-red-700">
                          Retry Job
                        </button>
                        <button className="px-3 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">
                          View Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Error Tracking</h2>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <select className="text-sm border border-slate-200 rounded-lg px-2 py-1">
                  <option>All Errors</option>
                  <option>Unresolved Only</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Error</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Service</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Count</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Last Seen</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map((err) => (
                    <tr key={err.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm text-slate-900 max-w-xs truncate">{err.message}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 font-mono">{err.service}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{err.count}</td>
                      <td className="px-6 py-3 text-sm text-slate-500">{new Date(err.lastSeen).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        {err.resolved ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Resolved</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Application Logs</h2>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['all', 'warn', 'error'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      logFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-50 font-mono text-xs">
              {filteredLogs.map((entry, i) => (
                <div key={i} className="px-6 py-2 flex items-start gap-3 hover:bg-slate-50">
                  <span className="text-slate-400 shrink-0 w-36">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <LogLevelBadge level={entry.level} />
                  <span className="text-slate-500 shrink-0 w-24">[{entry.service}]</span>
                  <span className="text-slate-700">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Database size={12} />
            <span>Last data sync: {new Date().toLocaleString()}</span>
          </div>
          <span>CourtAccess Monitoring v1.0</span>
        </div>
      </div>
    </div>
  );
}
