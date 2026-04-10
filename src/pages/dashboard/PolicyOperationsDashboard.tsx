// ============================================================================
// Phase 126 — Staff Operations Dashboard
// Route: /dashboard/policy-operations
// Displays live agency policy status table with filters for county,
// agency size, coverage score, and CPRA status.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Building2, FileSearch, Shield, Mail, Clock,
  RefreshCw, ChevronLeft, ChevronRight, Search,
  AlertTriangle, CheckCircle, XCircle, Filter,
} from 'lucide-react';
import { Card } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgencyRow {
  agencyId: string;
  agencyName: string;
  city: string | null;
  county: string | null;
  website: string | null;
  population: number | null;
  agencyType: string | null;
  policiesFound: number;
  policiesMissing: number;
  coverageScore: number;
  lastCrawl: string | null;
  cpraStatus: string;
  cpraDeadline: string | null;
  annualUpdateCountdown: number | null;
}

interface DashboardData {
  agencies: AgencyRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: {
    totalAgencies: number;
    totalPoliciesDiscovered: number;
    totalPoliciesIngested: number;
    averageCoverage: number;
    cpraBreakdown: Record<string, number>;
  };
  filters: { counties: string[] };
}


// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getCpraStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    none: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'None' },
    draft: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Draft' },
    sent: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Sent' },
    awaiting_response: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Awaiting' },
    follow_up: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Follow-up' },
    received: { bg: 'bg-green-50', text: 'text-green-700', label: 'Received' },
    closed: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Closed' },
  };
  const s = map[status] ?? map.none;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function getCoverageColor(score: number): string {
  if (score >= 70) return 'text-green-700 bg-green-50';
  if (score >= 40) return 'text-yellow-700 bg-yellow-50';
  return 'text-red-700 bg-red-50';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PolicyOperationsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [cpraFilter, setCpraFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (countyFilter) params.set('county', countyFilter);
      if (cpraFilter !== 'all') params.set('cpraStatus', cpraFilter);
      if (sizeFilter !== 'all') params.set('agencySize', sizeFilter);
      if (searchTerm) params.set('search', searchTerm);

      try {
        const res = await fetch(`/api/operations/dashboard?${params}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) { setData(json.data); return; }
        }
      } catch {
        // API not available yet
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, countyFilter, cpraFilter, sizeFilter, searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Loading operations dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Policy Operations Console</h1>
            <p className="text-sm text-gray-500">
              Real-time acquisition status for {data.summary.totalAgencies} California law enforcement agencies
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter size={14} />
            Filters
          </button>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Agencies</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalAgencies}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FileSearch size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Policies Discovered</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalPoliciesDiscovered.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Shield size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Policies Ingested</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalPoliciesIngested.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Mail size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Coverage</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.averageCoverage}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* CPRA Status Summary */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">CPRA Campaign Overview</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.summary.cpraBreakdown).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              {getCpraStatusBadge(status)}
              <span className="text-sm font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                  placeholder="Agency name..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">County</label>
              <select
                value={countyFilter}
                onChange={e => { setCountyFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Counties</option>
                {data.filters.counties.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Agency Size</label>
              <select
                value={sizeFilter}
                onChange={e => { setSizeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sizes</option>
                <option value="large">Large (100k+)</option>
                <option value="medium">Medium (25k-100k)</option>
                <option value="small">Small (&lt;25k)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CPRA Status</label>
              <select
                value={cpraFilter}
                onChange={e => { setCpraFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="none">None</option>
                <option value="sent">Sent</option>
                <option value="awaiting_response">Awaiting Response</option>
                <option value="follow_up">Follow-up</option>
                <option value="received">Received</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Main Agency Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-500 font-medium">Agency</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium">Policies Found</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium">Missing</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium">Coverage</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium">Last Crawl</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium">CPRA Status</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium">CPRA Deadline</th>
                <th className="text-center py-3 px-3 text-gray-500 font-medium">Annual Update</th>
              </tr>
            </thead>
            <tbody>
              {data.agencies.map((agency) => (
                <tr key={agency.agencyId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-medium text-gray-900">{agency.agencyName}</p>
                      <p className="text-xs text-gray-500">
                        {[agency.city, agency.county].filter(Boolean).join(', ')}
                        {agency.agencyType && <span className="ml-1 text-gray-400">({agency.agencyType})</span>}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="font-medium text-green-700">{agency.policiesFound}</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={agency.policiesMissing > 200 ? 'font-medium text-red-600' : 'text-gray-600'}>
                      {agency.policiesMissing}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCoverageColor(agency.coverageScore)}`}>
                      {agency.coverageScore}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-xs text-gray-500">
                    {agency.lastCrawl
                      ? new Date(agency.lastCrawl).toLocaleDateString()
                      : <span className="text-gray-400">Never</span>}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {getCpraStatusBadge(agency.cpraStatus)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {agency.cpraDeadline ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Clock size={12} className="text-yellow-500" />
                        {new Date(agency.cpraDeadline).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {agency.annualUpdateCountdown !== null ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        agency.annualUpdateCountdown <= 30 ? 'text-red-600' : agency.annualUpdateCountdown <= 90 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {agency.annualUpdateCountdown <= 0 ? (
                          <><AlertTriangle size={12} /> Overdue</>
                        ) : (
                          <><CheckCircle size={12} /> {agency.annualUpdateCountdown}d</>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.agencies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <XCircle size={24} className="mx-auto mb-2 text-gray-300" />
                    No agencies match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1}–
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total} agencies
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Page {data.pagination.page} of {data.pagination.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
              disabled={page >= data.pagination.pages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
