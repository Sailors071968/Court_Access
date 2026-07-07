// ============================================================================
// Phase 72 — System Health Dashboard
// Route: /dashboard/system-health
// Metrics: crawler status, worker queue sizes, OCR backlog,
//          policy ingestion count, CPRA campaign status, S3 storage usage
// ============================================================================

import { useState, useEffect } from 'react';
import {
  Activity, Server, HardDrive, FileText, Mail, Database,
  RefreshCw, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff,
} from 'lucide-react';
import { Card } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricCard {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  detail?: string;
  lastUpdated: string;
}

interface QueueMetric {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  concurrency: number;
}

interface LatencyMetric {
  endpoint: string;
  p50: number;
  p95: number;
  p99: number;
  status: 'healthy' | 'degraded' | 'critical';
}

interface SystemHealthData {
  apiLatency: LatencyMetric[];
  dbLatency: { queryType: string; avgMs: number; maxMs: number; status: 'healthy' | 'degraded' | 'critical' }[];
  aiLatency: { model: string; avgMs: number; tokensPerSec: number; queueDepth: number; status: 'healthy' | 'degraded' | 'critical' }[];
  crawlerStatus: {
    activeSessions: number;
    domainsThrottled: number;
    pagesVisitedToday: number;
    robotsTxtCacheSize: number;
    status: 'idle' | 'active' | 'paused' | 'error';
  };
  workerQueues: QueueMetric[];
  ocrBacklog: {
    pending: number;
    active: number;
    completedToday: number;
    failedToday: number;
    textractBudgetUsed: number;
    textractBudgetLimit: number;
    primaryMethod: string;
  };
  policyIngestion: {
    totalPolicies: number;
    ingestedToday: number;
    pendingReview: number;
    avgConfidenceScore: number;
    belowThreshold: number;
  };
  cpraCampaign: {
    totalAgencies: number;
    requestsSent: number;
    responsesReceived: number;
    pendingFollowUp: number;
    campaignStatus: 'active' | 'paused' | 'completed' | 'not_started';
  };
  s3Storage: {
    totalObjects: number;
    totalSizeGb: number;
    bucketName: string;
    recentUploads: number;
    storageClass: string;
  };
  lastRefreshed: string;
}


// ---------------------------------------------------------------------------
// Status Helpers
// ---------------------------------------------------------------------------

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
    case 'active':
    case 'completed':
      return 'text-green-600 bg-emerald-500/10';
    case 'warning':
    case 'paused':
      return 'text-yellow-600 bg-amber-500/10';
    case 'critical':
    case 'error':
      return 'text-red-600 bg-red-500/10';
    default:
      return 'text-slate-300 bg-white/5';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
    case 'active':
    case 'completed':
      return <CheckCircle size={16} />;
    case 'warning':
    case 'paused':
      return <AlertTriangle size={16} />;
    case 'critical':
    case 'error':
      return <AlertTriangle size={16} />;
    default:
      return <Clock size={16} />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemHealthDashboard() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/system/health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLoadFailed(false);
      } else {
        if (!data) setLoadFailed(true);
      }
    } catch {
      if (!data) setLoadFailed(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30_000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          {loadFailed ? (
            <div className="text-center">
              <p className="text-slate-400">System health data is not available yet.</p>
              <button onClick={fetchData} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Retry</button>
            </div>
          ) : (
            <>
              <RefreshCw size={24} className="animate-spin text-slate-400" />
              <span className="ml-3 text-slate-400">Loading system health data...</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Derive top-level metrics
  const metrics: MetricCard[] = [
    {
      id: 'crawler',
      label: 'Crawler Status',
      value: data.crawlerStatus.status.toUpperCase(),
      status: data.crawlerStatus.status === 'active' ? 'healthy' : data.crawlerStatus.status === 'error' ? 'critical' : 'unknown',
      detail: `${data.crawlerStatus.activeSessions} active sessions, ${data.crawlerStatus.pagesVisitedToday} pages today`,
      lastUpdated: data.lastRefreshed,
    },
    {
      id: 'queues',
      label: 'Worker Queues',
      value: data.workerQueues.reduce((sum, q) => sum + q.active + q.waiting, 0),
      unit: 'jobs',
      status: data.workerQueues.some(q => q.failed > 10) ? 'warning' : 'healthy',
      detail: `${data.workerQueues.reduce((sum, q) => sum + q.active, 0)} active, ${data.workerQueues.reduce((sum, q) => sum + q.waiting, 0)} waiting`,
      lastUpdated: data.lastRefreshed,
    },
    {
      id: 'ocr',
      label: 'OCR Backlog',
      value: data.ocrBacklog.pending,
      unit: 'pending',
      status: data.ocrBacklog.pending > 100 ? 'warning' : data.ocrBacklog.pending > 500 ? 'critical' : 'healthy',
      detail: `${data.ocrBacklog.completedToday} completed today, budget ${data.ocrBacklog.textractBudgetUsed}/${data.ocrBacklog.textractBudgetLimit}`,
      lastUpdated: data.lastRefreshed,
    },
    {
      id: 'ingestion',
      label: 'Policy Ingestion',
      value: data.policyIngestion.totalPolicies,
      unit: 'total',
      status: data.policyIngestion.pendingReview > 50 ? 'warning' : 'healthy',
      detail: `${data.policyIngestion.ingestedToday} today, ${data.policyIngestion.pendingReview} pending review`,
      lastUpdated: data.lastRefreshed,
    },
    {
      id: 'cpra',
      label: 'CPRA Campaign',
      value: `${data.cpraCampaign.requestsSent}/${data.cpraCampaign.totalAgencies}`,
      status: data.cpraCampaign.campaignStatus === 'active' ? 'healthy' : 'unknown',
      detail: `${data.cpraCampaign.responsesReceived} responses, ${data.cpraCampaign.pendingFollowUp} follow-ups`,
      lastUpdated: data.lastRefreshed,
    },
    {
      id: 's3',
      label: 'S3 Storage',
      value: data.s3Storage.totalSizeGb.toFixed(2),
      unit: 'GB',
      status: data.s3Storage.totalSizeGb > 50 ? 'warning' : 'healthy',
      detail: `${data.s3Storage.totalObjects} objects, ${data.s3Storage.recentUploads} recent uploads`,
      lastUpdated: data.lastRefreshed,
    },
  ];

  const metricIcons: Record<string, React.ReactNode> = {
    crawler: <Wifi size={24} />,
    queues: <Server size={24} />,
    ocr: <FileText size={24} />,
    ingestion: <Database size={24} />,
    cpra: <Mail size={24} />,
    s3: <HardDrive size={24} />,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-gold-light" />
          <div>
            <h1 className="text-2xl font-bold text-white">System Health</h1>
            <p className="text-sm text-slate-400">
              Last refreshed: {new Date(data.lastRefreshed).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                : 'bg-white/10 text-slate-300 hover:bg-gray-200'
            }`}
          >
            {autoRefresh ? <Wifi size={14} /> : <WifiOff size={14} />}
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top-level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(metric.status)}`}>
                  {metricIcons[metric.id]}
                </div>
                <div>
                  <p className="text-sm text-slate-400">{metric.label}</p>
                  <p className="text-xl font-bold text-white">
                    {metric.value}
                    {metric.unit && <span className="text-sm font-normal text-slate-400 ml-1">{metric.unit}</span>}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metric.status)}`}>
                {getStatusIcon(metric.status)}
                {metric.status}
              </div>
            </div>
            {metric.detail && (
              <p className="mt-2 text-xs text-slate-400">{metric.detail}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Worker Queue Detail */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Worker Queue Status</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Queue</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Concurrency</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Active</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Waiting</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Completed</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Failed</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {data.workerQueues.map((queue) => {
                const health = queue.failed > 10 ? 'critical' : queue.waiting > 50 ? 'warning' : 'healthy';
                return (
                  <tr key={queue.name} className="border-b border-gray-50 hover:bg-white/5">
                    <td className="py-3 px-3 font-medium text-white">{queue.name}</td>
                    <td className="py-3 px-3 text-right text-slate-300">{queue.concurrency}</td>
                    <td className="py-3 px-3 text-right text-gold-light font-medium">{queue.active}</td>
                    <td className="py-3 px-3 text-right text-yellow-600">{queue.waiting}</td>
                    <td className="py-3 px-3 text-right text-green-600">{queue.completed}</td>
                    <td className="py-3 px-3 text-right text-red-600">{queue.failed}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health)}`}>
                        {getStatusIcon(health)}
                        {health}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom Row: OCR Details + CPRA Details */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* OCR Resource Details */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">OCR Resource Usage</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Textract Daily Budget</span>
                <span className="font-medium text-white">
                  {data.ocrBacklog.textractBudgetUsed} / {data.ocrBacklog.textractBudgetLimit}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    data.ocrBacklog.textractBudgetUsed / data.ocrBacklog.textractBudgetLimit > 0.8
                      ? 'bg-red-500'
                      : data.ocrBacklog.textractBudgetUsed / data.ocrBacklog.textractBudgetLimit > 0.5
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min((data.ocrBacklog.textractBudgetUsed / data.ocrBacklog.textractBudgetLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400">Active Jobs</p>
                <p className="text-lg font-bold text-white">{data.ocrBacklog.active}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400">Pending</p>
                <p className="text-lg font-bold text-white">{data.ocrBacklog.pending}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <p className="text-xs text-slate-400">Completed Today</p>
                <p className="text-lg font-bold text-emerald-300">{data.ocrBacklog.completedToday}</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <p className="text-xs text-slate-400">Failed Today</p>
                <p className="text-lg font-bold text-red-300">{data.ocrBacklog.failedToday}</p>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Primary method: <span className="font-medium">{data.ocrBacklog.primaryMethod}</span>
              {' '}| Priority: pdf-parse → AWS Textract → Tesseract
            </div>
          </div>
        </Card>

        {/* CPRA Campaign Status */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">CPRA Campaign Status</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(data.cpraCampaign.campaignStatus)}`}>
                {data.cpraCampaign.campaignStatus.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Requests Sent</span>
                <span className="font-medium text-white">
                  {data.cpraCampaign.requestsSent} / {data.cpraCampaign.totalAgencies}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{
                    width: `${data.cpraCampaign.totalAgencies > 0 ? (data.cpraCampaign.requestsSent / data.cpraCampaign.totalAgencies) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400">Total Agencies</p>
                <p className="text-lg font-bold text-white">{data.cpraCampaign.totalAgencies}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-xs text-slate-400">Requests Sent</p>
                <p className="text-lg font-bold text-blue-300">{data.cpraCampaign.requestsSent}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <p className="text-xs text-slate-400">Responses Received</p>
                <p className="text-lg font-bold text-emerald-300">{data.cpraCampaign.responsesReceived}</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <p className="text-xs text-slate-400">Pending Follow-Up</p>
                <p className="text-lg font-bold text-amber-300">{data.cpraCampaign.pendingFollowUp}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Phase 262: API / DB / AI Latency Metrics */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* API Latency */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">API Latency (ms)</h2>
          <div className="space-y-2">
            {data.apiLatency.map((ep) => (
              <div key={ep.endpoint} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-xs font-mono text-slate-200">{ep.endpoint}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">p50: <span className="font-medium text-white">{ep.p50}</span></span>
                  <span className="text-xs text-slate-400">p95: <span className="font-medium text-white">{ep.p95}</span></span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${ep.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300' : ep.status === 'degraded' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300'}`}>
                    {ep.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* DB Latency */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Database Latency (ms)</h2>
          <div className="space-y-2">
            {data.dbLatency.map((q) => (
              <div key={q.queryType} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-xs text-slate-200">{q.queryType}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">avg: <span className="font-medium text-white">{q.avgMs}</span></span>
                  <span className="text-xs text-slate-400">max: <span className="font-medium text-white">{q.maxMs}</span></span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${q.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300' : q.status === 'degraded' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300'}`}>
                    {q.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* AI Model Latency */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">AI Model Latency</h2>
          <div className="space-y-2">
            {data.aiLatency.map((m) => (
              <div key={m.model} className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{m.model}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${m.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300' : m.status === 'degraded' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300'}`}>
                    {m.status}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>Avg: <span className="font-medium text-white">{m.avgMs}ms</span></span>
                  {m.tokensPerSec > 0 && <span>Tokens/s: <span className="font-medium text-white">{m.tokensPerSec}</span></span>}
                  <span>Queue: <span className="font-medium text-white">{m.queueDepth}</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Policy Ingestion + S3 Storage */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Policy Ingestion */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Policy Ingestion</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-xl font-bold text-white">{data.policyIngestion.totalPolicies}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <p className="text-xs text-slate-400">Today</p>
                <p className="text-xl font-bold text-blue-300">{data.policyIngestion.ingestedToday}</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg text-center">
                <p className="text-xs text-slate-400">Review Queue</p>
                <p className="text-xl font-bold text-amber-300">{data.policyIngestion.pendingReview}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-sm text-slate-300">Avg Confidence Score</span>
              <span className={`text-sm font-bold ${
                data.policyIngestion.avgConfidenceScore >= 0.65 ? 'text-emerald-300' : 'text-red-300'
              }`}>
                {data.policyIngestion.avgConfidenceScore > 0
                  ? (data.policyIngestion.avgConfidenceScore * 100).toFixed(1) + '%'
                  : 'N/A'}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {data.policyIngestion.belowThreshold} documents below 0.65 confidence threshold
            </div>
          </div>
        </Card>

        {/* S3 Storage */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">S3 Storage Usage</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-xs text-slate-400">Total Size</p>
                <p className="text-xl font-bold text-white">{data.s3Storage.totalSizeGb.toFixed(2)} GB</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-xs text-slate-400">Objects</p>
                <p className="text-xl font-bold text-white">{data.s3Storage.totalObjects.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2">
                <span className="text-sm text-slate-300">Bucket</span>
                <span className="text-sm font-mono text-white">{data.s3Storage.bucketName}</span>
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-sm text-slate-300">Storage Class</span>
                <span className="text-sm font-medium text-white">{data.s3Storage.storageClass}</span>
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-sm text-slate-300">Recent Uploads</span>
                <span className="text-sm font-medium text-blue-300">{data.s3Storage.recentUploads}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
