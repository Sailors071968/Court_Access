// ============================================================================
// Epic H — Repository Integrity Dashboard
// Route: /dashboard/repository-integrity
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, AlertTriangle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, StatCard } from '../../components/common/Card';

interface RepositoryStatus {
  name: string;
  displayName: string;
  recordCount: number;
  integrity: 'PASS' | 'FAIL' | 'UNKNOWN';
  integrityDetail: string;
  coverage: {
    statutesCovered: number;
    unknownFieldCount: number;
    unknownFieldRate: number;
    totalRecords: number;
  } | null;
  unknowns: string[];
  manualReviewCount: number;
  auditStatus: string;
  lastSynchronization: string | null;
  completionPercent: number;
}

interface IntegrityDashboard {
  generatedAt: string;
  overallIntegrity: 'PASS' | 'FAIL' | 'PARTIAL';
  overallCompletionPercent: number;
  repositoryIntegrity: string;
  parsingFailures: number;
  manualReviewQueue: number;
  coverageAnalytics: {
    codesDiscovered: number;
    codesTotal: number;
    sectionsDiscovered: number;
    sectionsParsed: number;
    criminalOffenses: number;
    offenseElements: number;
    calcrimMappings: number;
    authorityCoveragePercent: number;
  };
  knowledgeGraph: {
    totalRecords: number;
    repositoriesHealthy: number;
    repositoriesTotal: number;
    integrity: string;
  };
  repositories: RepositoryStatus[];
  globalUnknowns: string[];
  auditSummary: { total: number; success: number; rejected: number; partial: number };
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function IntegrityBadge({ status }: { status: string }) {
  const styles: Record<string, { icon: React.ReactNode; className: string }> = {
    PASS: { icon: <CheckCircle size={14} />, className: 'bg-emerald-500/15 text-emerald-300' },
    FAIL: { icon: <AlertTriangle size={14} />, className: 'bg-red-500/15 text-red-300' },
    PARTIAL: { icon: <AlertTriangle size={14} />, className: 'bg-amber-500/15 text-amber-300' },
    UNKNOWN: { icon: <HelpCircle size={14} />, className: 'bg-white/10 text-slate-200' },
  };
  const s = styles[status] ?? styles.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>
      {s.icon}
      {status}
    </span>
  );
}

export function RepositoryIntegrityDashboard() {
  const [data, setData] = useState<IntegrityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/repository-integrity', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-3" size={32} />
        <p className="text-red-300">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database size={24} />
            Repository Integrity Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            California legislative repositories — integrity, coverage, unknowns
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={<Database size={20} />} value={data.overallCompletionPercent} label="Completion %" />
        <StatCard icon={<CheckCircle size={20} />} value={`${data.knowledgeGraph.repositoriesHealthy}/${data.knowledgeGraph.repositoriesTotal}`} label="Healthy Repos" />
        <StatCard icon={<Database size={20} />} value={data.coverageAnalytics.sectionsParsed} label="Sections Parsed" />
        <StatCard icon={<Database size={20} />} value={data.coverageAnalytics.criminalOffenses} label="Offenses" />
        <StatCard icon={<AlertTriangle size={20} />} value={data.manualReviewQueue} label="Manual Review" highlight={data.manualReviewQueue > 0} />
        <StatCard icon={<CheckCircle size={20} />} value={data.overallIntegrity} label="Overall Integrity" />
      </div>

      {data.globalUnknowns.length > 0 && (
        <Card>
          <CardHeader title="Global Unknowns" subtitle="Explicitly reported — never fabricated" />
          <ul className="list-disc list-inside text-sm text-amber-300 space-y-1">
            {data.globalUnknowns.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </Card>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Repository Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b bg-white/5">
                <th className="px-4 py-3">Repository</th>
                <th className="px-4 py-3">Records</th>
                <th className="px-4 py-3">Integrity</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Unknowns</th>
                <th className="px-4 py-3">Audit</th>
                <th className="px-4 py-3">Last Sync</th>
                <th className="px-4 py-3">Completion</th>
              </tr>
            </thead>
            <tbody>
              {data.repositories.map((repo) => (
                <tr key={repo.name} className="border-b border-gray-50 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium">{repo.displayName}</td>
                  <td className="px-4 py-3">{repo.recordCount}</td>
                  <td className="px-4 py-3">
                    <IntegrityBadge status={repo.integrity} />
                    <p className="text-xs text-slate-400 mt-0.5">{repo.integrityDetail}</p>
                  </td>
                  <td className="px-4 py-3">
                    {repo.coverage ? (
                      <span>{repo.coverage.statutesCovered} statutes</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {repo.unknowns.length > 0 ? (
                      <span className="text-amber-300">{repo.unknowns.length}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><IntegrityBadge status={repo.auditStatus} /></td>
                  <td className="px-4 py-3 text-slate-400">
                    {repo.lastSynchronization ? new Date(repo.lastSynchronization).toLocaleString() : 'UNKNOWN'}
                  </td>
                  <td className="px-4 py-3">{repo.completionPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Coverage Analytics" />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-slate-400">Codes Discovered</dt><dd>{data.coverageAnalytics.codesDiscovered}/{data.coverageAnalytics.codesTotal}</dd></div>
            <div><dt className="text-slate-400">Sections Discovered</dt><dd>{data.coverageAnalytics.sectionsDiscovered}</dd></div>
            <div><dt className="text-slate-400">Elements</dt><dd>{data.coverageAnalytics.offenseElements}</dd></div>
            <div><dt className="text-slate-400">CALCRIM</dt><dd>{data.coverageAnalytics.calcrimMappings}</dd></div>
            <div><dt className="text-slate-400">Authority Coverage</dt><dd>{data.coverageAnalytics.authorityCoveragePercent}%</dd></div>
            <div><dt className="text-slate-400">Parsing Failures</dt><dd>{data.parsingFailures}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Extraction Audit" />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-slate-400">Total</dt><dd>{data.auditSummary.total}</dd></div>
            <div><dt className="text-slate-400">Success</dt><dd className="text-emerald-300">{data.auditSummary.success}</dd></div>
            <div><dt className="text-slate-400">Rejected</dt><dd className="text-red-300">{data.auditSummary.rejected}</dd></div>
            <div><dt className="text-slate-400">Partial</dt><dd className="text-amber-300">{data.auditSummary.partial}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
