// ============================================
// Court Access — Weekly Beta Health Report Page
// Phase 122: Health reporting dashboard
// ============================================

import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Users,
  Briefcase,
  FileText,
  Activity,
  AlertTriangle,
  MessageSquare,
  Bug,
  RefreshCw,
  Download,
  Clock,
} from 'lucide-react';
import { apiGet, apiPost } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthReport {
  id: string;
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  activeUsers: number;
  totalCases: number;
  evidenceProcessed: number;
  workerUptime: number;
  systemErrors: number;
  feedbackCount: number;
  bugCount: number;
  avgResponseTimeMs: number;
  storageUsedBytes: string;
  reportData: {
    users?: { total: number; activeThisWeek: number };
    cases?: { total: number; createdThisWeek: number };
    evidence?: { total: number; uploadedThisWeek: number; processedThisWeek: number; errorsThisWeek: number; successRate: string };
    workers?: { running: number; total: number; uptimePercent: string };
    errors?: { newThisWeek: number; unresolved: number };
    feedback?: { newThisWeek: number; open: number };
    bugs?: { newThisWeek: number; open: number };
    email?: { sentThisWeek: number; failedThisWeek: number };
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number | string): string {
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (b === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-slate-900',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon size={18} className="text-slate-400" />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HealthReportPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [latestRes, listRes] = await Promise.all([
        apiGet('/api/admin/health-report/latest'),
        apiGet('/api/admin/health-report'),
      ]);

      if (latestRes.ok) {
        const data = await latestRes.json();
        setReport(data.report);
      }
      if (listRes.ok) {
        const data = await listRes.json();
        setReports(data.reports);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await apiPost('/api/admin/health-report/generate');
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setGenerating(false);
    }
  };

  const rd = report?.reportData;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Beta Health Reports</h1>
            <p className="text-sm text-slate-500 mt-1">Weekly platform health and usage metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <BarChart3 size={14} />
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading reports...</div>
        ) : !report ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <BarChart3 size={40} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600">No reports yet</h3>
            <p className="text-sm text-slate-400 mt-1">Click "Generate Report" to create the first weekly health report</p>
          </div>
        ) : (
          <>
            {/* Report Period */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-3">
              <Clock size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">
                Report Period: <strong>{formatDate(report.periodStart)}</strong> — <strong>{formatDate(report.periodEnd)}</strong>
              </span>
              <span className="text-xs text-slate-400 ml-auto">Generated {formatDate(report.createdAt)}</span>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={Users}
                label="Active Users"
                value={report.activeUsers}
                sub={rd?.users ? `${rd.users.total} total registered` : undefined}
              />
              <MetricCard
                icon={Briefcase}
                label="Total Cases"
                value={report.totalCases}
                sub={rd?.cases ? `${rd.cases.createdThisWeek} new this week` : undefined}
              />
              <MetricCard
                icon={FileText}
                label="Evidence Processed"
                value={report.evidenceProcessed}
                sub={rd?.evidence ? `${rd.evidence.successRate}% success rate` : undefined}
              />
              <MetricCard
                icon={Activity}
                label="Worker Uptime"
                value={`${report.workerUptime.toFixed(1)}%`}
                sub={rd?.workers ? `${rd.workers.running}/${rd.workers.total} running` : undefined}
                color={report.workerUptime >= 99 ? 'text-emerald-600' : report.workerUptime >= 95 ? 'text-amber-600' : 'text-red-600'}
              />
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Errors & Issues */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  Errors & Issues
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">System Errors (this week)</span>
                    <span className="text-sm font-semibold text-slate-900">{report.systemErrors}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Unresolved Errors</span>
                    <span className="text-sm font-semibold text-red-600">{rd?.errors?.unresolved || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Evidence Errors</span>
                    <span className="text-sm font-semibold text-slate-900">{rd?.evidence?.errorsThisWeek || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600">Email Failures</span>
                    <span className="text-sm font-semibold text-slate-900">{rd?.email?.failedThisWeek || 0}</span>
                  </div>
                </div>
              </div>

              {/* Feedback & Bugs */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-500" />
                  Feedback & Bugs
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">New Feedback (this week)</span>
                    <span className="text-sm font-semibold text-slate-900">{report.feedbackCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Open Feedback</span>
                    <span className="text-sm font-semibold text-amber-600">{rd?.feedback?.open || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">New Bugs (this week)</span>
                    <span className="text-sm font-semibold text-slate-900">{report.bugCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600">Open Bugs</span>
                    <span className="text-sm font-semibold text-red-600">{rd?.bugs?.open || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Download size={18} className="text-slate-400" />
                Storage Usage
              </h2>
              <div className="text-3xl font-bold text-slate-900">
                {formatBytes(report.storageUsedBytes)}
              </div>
              <div className="text-sm text-slate-500 mt-1">Total platform storage used</div>
            </div>

            {/* Report History */}
            {reports.length > 1 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Report History</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Users</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Cases</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Evidence</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Uptime</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-6 py-3 text-sm text-slate-600">{formatDate(r.reportDate)}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{r.activeUsers}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{r.totalCases}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{r.evidenceProcessed}</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{r.workerUptime.toFixed(1)}%</td>
                          <td className="px-6 py-3 text-sm text-slate-600">{r.systemErrors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
