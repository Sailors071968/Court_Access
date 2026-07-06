// ============================================
// Phase 12 — Policy Acquisition Pipeline Dashboard
// Route: /dashboard/policy-acquisition/agencies
// ============================================

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface PipelineStats {
  totalAgencies: number;
  websitesFound: number;
  sitesCrawled: number;
  documentsFound: number;
  documentsDownloaded: number;
  documentsOcr: number;
  documentsClassified: number;
  crawlInProgress: number;
  crawlFailed: number;
}

interface AgencyRow {
  agencyId: string;
  agencyName: string;
  agencyType: string | null;
  city: string | null;
  county: string | null;
  populationEstimate: number | null;
  jurisdictionRank: number | null;
  website: string | null;
  crawlStatus: string;
  pagesFound: number;
  policyPagesFound: number;
  lastCrawledAt: string | null;
  _count: { PolicyDocuments: number };
}

interface AgenciesResponse {
  agencies: AgencyRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function PolicyPipelineDashboard() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [agencies, setAgencies] = useState<AgenciesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningPipeline, setRunningPipeline] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/policy-pipeline/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Stats endpoint not available yet
    }
  }, []);

  const fetchAgencies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
      });
      if (search) params.set('search', search);
      if (typeFilter) params.set('agencyType', typeFilter);
      if (statusFilter) params.set('crawlStatus', statusFilter);

      const res = await fetch(
        `${API_BASE}/api/policy-pipeline/agencies?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setAgencies(data);
      } else {
        setError('Failed to fetch agencies');
      }
    } catch {
      setError('API not available');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchStats();
    fetchAgencies();
  }, [fetchStats, fetchAgencies]);

  const runPipeline = async (endpoint: string) => {
    setRunningPipeline(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/policy-pipeline/run/${endpoint}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (res.ok) {
        // Refresh stats after pipeline run
        await fetchStats();
        await fetchAgencies();
      }
    } catch {
      setError(`Failed to run ${endpoint}`);
    } finally {
      setRunningPipeline(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      skipped: 'bg-yellow-100 text-yellow-700',
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}
      >
        {status}
      </span>
    );
  };

  const formatNumber = (n: number | null) =>
    n != null ? n.toLocaleString() : '--';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Policy Acquisition Pipeline
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            California Law Enforcement Agency Registry + Policy Collection
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runPipeline('post-crawl')}
            disabled={runningPipeline}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {runningPipeline ? 'Running...' : 'Run POST Crawl'}
          </button>
          <button
            onClick={() => runPipeline('rank')}
            disabled={runningPipeline}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Rank Agencies
          </button>
          <button
            onClick={() => runPipeline('enqueue-crawls')}
            disabled={runningPipeline}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Start Site Crawls
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Agencies"
            value={formatNumber(stats.totalAgencies)}
            color="indigo"
          />
          <StatCard
            label="Websites Found"
            value={formatNumber(stats.websitesFound)}
            color="blue"
          />
          <StatCard
            label="Sites Crawled"
            value={formatNumber(stats.sitesCrawled)}
            color="emerald"
          />
          <StatCard
            label="Documents Found"
            value={formatNumber(stats.documentsFound)}
            color="purple"
          />
          <StatCard
            label="Documents Classified"
            value={formatNumber(stats.documentsClassified)}
            color="amber"
          />
          <StatCard
            label="Downloaded"
            value={formatNumber(stats.documentsDownloaded)}
            color="teal"
          />
          <StatCard
            label="OCR Complete"
            value={formatNumber(stats.documentsOcr)}
            color="cyan"
          />
          <StatCard
            label="Crawl In Progress"
            value={formatNumber(stats.crawlInProgress)}
            color="blue"
          />
          <StatCard
            label="Crawl Failed"
            value={formatNumber(stats.crawlFailed)}
            color="red"
          />
        </div>
      )}

      {/* Pipeline Progress Bar */}
      {stats && stats.totalAgencies > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Pipeline Progress
          </h3>
          <div className="space-y-2">
            <ProgressRow
              label="Agency Discovery"
              current={stats.totalAgencies}
              total={714}
            />
            <ProgressRow
              label="Website Discovery"
              current={stats.websitesFound}
              total={stats.totalAgencies}
            />
            <ProgressRow
              label="Site Crawling"
              current={stats.sitesCrawled}
              total={stats.websitesFound}
            />
            <ProgressRow
              label="Document Download"
              current={stats.documentsDownloaded}
              total={stats.documentsFound}
            />
            <ProgressRow
              label="OCR Processing"
              current={stats.documentsOcr}
              total={stats.documentsDownloaded}
            />
            <ProgressRow
              label="Classification"
              current={stats.documentsClassified}
              total={stats.documentsOcr}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search agencies..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="Police">Police</option>
          <option value="Sheriff">Sheriff</option>
          <option value="State">State</option>
          <option value="District_Attorney">District Attorney</option>
          <option value="University">University</option>
          <option value="Transit">Transit</option>
          <option value="Community_College">Community College</option>
          <option value="Other">Other</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Agency Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Agency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  City / County
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Population
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Crawl Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pages
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Policies
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Website
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Loading agencies...
                  </td>
                </tr>
              )}
              {!loading && agencies?.agencies.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No agencies found. Run the POST directory crawler to populate.
                  </td>
                </tr>
              )}
              {!loading &&
                agencies?.agencies.map((agency) => (
                  <tr key={agency.agencyId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {agency.jurisdictionRank ?? '--'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {agency.agencyName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {agency.agencyType ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {[agency.city, agency.county]
                        .filter(Boolean)
                        .join(', ') || '--'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatNumber(agency.populationEstimate)}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(agency.crawlStatus)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {agency.pagesFound} / {agency.policyPagesFound}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-indigo-600">
                      {agency._count.PolicyDocuments}
                    </td>
                    <td className="px-4 py-3">
                      {agency.website ? (
                        <a
                          href={agency.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate block max-w-xs"
                        >
                          {new URL(agency.website).hostname}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {agencies && agencies.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              Page {agencies.page} of {agencies.totalPages} ({agencies.total}{' '}
              agencies)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(agencies.totalPages, p + 1))
                }
                disabled={page >= agencies.totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const bgColors: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-200',
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    purple: 'bg-purple-50 border-purple-200',
    amber: 'bg-amber-50 border-amber-200',
    teal: 'bg-teal-50 border-teal-200',
    cyan: 'bg-cyan-50 border-cyan-200',
    red: 'bg-red-50 border-red-200',
  };
  const textColors: Record<string, string> = {
    indigo: 'text-indigo-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    purple: 'text-purple-700',
    amber: 'text-amber-700',
    teal: 'text-teal-700',
    cyan: 'text-cyan-700',
    red: 'text-red-700',
  };

  return (
    <div
      className={`rounded-xl border p-4 ${bgColors[color] ?? 'bg-gray-50 border-gray-200'}`}
    >
      <div className="text-xs font-medium text-gray-500 uppercase">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${textColors[color] ?? 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-20 text-right">
        {current.toLocaleString()} / {total.toLocaleString()} ({pct}%)
      </span>
    </div>
  );
}
