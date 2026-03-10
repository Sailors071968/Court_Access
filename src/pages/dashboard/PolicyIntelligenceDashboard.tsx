/**
 * Phase 10: Policy Intelligence Coverage Dashboard
 *
 * Route: /dashboard/policy-intelligence/coverage
 *
 * Displays:
 * - Agencies indexed
 * - Policies discovered
 * - Topics covered
 * - Missing policies
 * - Coverage matrix (which agencies have which topics)
 * - Category breakdown
 * - Top/bottom agencies by coverage
 */

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoverageStats {
  totalAgencies: number;
  totalTopics: number;
  totalCoverageEntries: number;
  totalFound: number;
  totalMissing: number;
  overallCoveragePercent: number;
  agenciesWithFullCoverage: number;
  agenciesWithNoCoverage: number;
}

interface TaxonomySummary {
  totalCategories: number;
  totalTopics: number;
  seededInDatabase: number;
  topicsByCategory: Record<string, number>;
}

interface CategoryBreakdown {
  category: string;
  displayName: string;
  topicCount: number;
  avgCoveragePercent: number;
}

interface AgencyCoverage {
  agencyId: string;
  agencyName: string;
  coveragePercent: number;
  coveredTopics: number;
  totalTopics: number;
}

interface AgencyListItem {
  agencyId: string;
  agencyName: string;
  agencyType: string | null;
  city: string | null;
  county: string | null;
  populationEstimate: number | null;
  jurisdictionRank: number | null;
  website: string | null;
  crawlStatus: string;
  policiesDiscovered: boolean;
  documentsCount: number;
  coveredTopics: number;
  totalTopics: number;
  coveragePercent: number;
}

interface DashboardData {
  coverage: CoverageStats;
  taxonomy: TaxonomySummary;
  matrix: {
    totalAgencies: number;
    totalTopics: number;
    overallCoveragePercent: number;
    categoryBreakdown: CategoryBreakdown[];
    topAgencies: AgencyCoverage[];
    bottomAgencies: AgencyCoverage[];
  };
  recentActivity: {
    agencyId: string;
    agencyName: string;
    crawlStatus: string;
    policiesDiscovered: boolean;
    lastCrawledAt: string | null;
  }[];
}

interface AgencyListResponse {
  agencies: AgencyListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/policy-intelligence';

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  return res.json();
}

async function fetchAgencies(page: number, search: string): Promise<AgencyListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: '15' });
  if (search) params.set('search', search);
  const res = await fetch(`${API_BASE}/agencies?${params}`);
  if (!res.ok) throw new Error(`Agencies fetch failed: ${res.status}`);
  return res.json();
}

async function seedTaxonomy(): Promise<{ status: string; totalTopicsExtracted: number }> {
  const res = await fetch(`${API_BASE}/taxonomy/seed`, { method: 'POST' });
  if (!res.ok) throw new Error(`Seed failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PolicyIntelligenceDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [agencies, setAgencies] = useState<AgencyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'agencies' | 'categories'>('overview');
  const [seeding, setSeeding] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashData, agencyData] = await Promise.all([
        fetchDashboard(),
        fetchAgencies(page, search),
      ]);
      setDashboard(dashData);
      setAgencies(agencyData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSeedTaxonomy = async () => {
    try {
      setSeeding(true);
      const result = await seedTaxonomy();
      alert(`Taxonomy seeded: ${result.totalTopicsExtracted} topics extracted`);
      loadDashboard();
    } catch (err) {
      alert(`Seed failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSeeding(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Loading Policy Intelligence Dashboard...</div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#ef4444' }}>{error}</div>
        <button
          onClick={loadDashboard}
          style={{
            marginTop: 16,
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = dashboard?.coverage;
  const taxonomy = dashboard?.taxonomy;
  const matrix = dashboard?.matrix;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
          Policy Intelligence Coverage
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          CHP-canonical policy taxonomy — {taxonomy?.totalCategories || 18} categories, {taxonomy?.totalTopics || 0} topics
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Agencies Indexed" value={stats?.totalAgencies || 0} color="#3b82f6" />
        <StatCard label="Topics in Taxonomy" value={taxonomy?.totalTopics || 0} color="#8b5cf6" />
        <StatCard label="Policies Found" value={stats?.totalFound || 0} color="#10b981" />
        <StatCard label="Missing Policies" value={stats?.totalMissing || 0} color="#ef4444" />
        <StatCard label="Overall Coverage" value={`${stats?.overallCoveragePercent || 0}%`} color="#f59e0b" />
        <StatCard label="Full Coverage" value={stats?.agenciesWithFullCoverage || 0} subtitle="agencies" color="#059669" />
      </div>

      {/* Admin Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={handleSeedTaxonomy}
          disabled={seeding}
          style={{
            padding: '8px 16px',
            backgroundColor: seeding ? '#9ca3af' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: seeding ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {seeding ? 'Seeding...' : 'Seed CHP Taxonomy'}
        </button>
        <button
          onClick={loadDashboard}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        {(['overview', 'agencies', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: activeTab === tab ? '#3b82f6' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab matrix={matrix} recentActivity={dashboard?.recentActivity || []} />
      )}
      {activeTab === 'agencies' && (
        <AgenciesTab
          agencies={agencies}
          search={search}
          setSearch={setSearch}
          page={page}
          setPage={setPage}
        />
      )}
      {activeTab === 'categories' && <CategoriesTab matrix={matrix} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 4 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  matrix,
  recentActivity,
}: {
  matrix: DashboardData['matrix'] | undefined;
  recentActivity: DashboardData['recentActivity'];
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Top Agencies */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>
          Top Agencies by Coverage
        </h3>
        {matrix?.topAgencies.map((a) => (
          <div
            key={a.agencyId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <span style={{ fontSize: 13, color: '#374151' }}>{a.agencyName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 80,
                  height: 6,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${a.coveragePercent}%`,
                    height: '100%',
                    backgroundColor: a.coveragePercent > 75 ? '#10b981' : a.coveragePercent > 50 ? '#f59e0b' : '#ef4444',
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: '#6b7280', minWidth: 40, textAlign: 'right' }}>
                {a.coveragePercent}%
              </span>
            </div>
          </div>
        )) || <div style={{ color: '#9ca3af', fontSize: 13 }}>No data yet</div>}
      </div>

      {/* Bottom Agencies */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>
          Agencies Needing Attention
        </h3>
        {matrix?.bottomAgencies.map((a) => (
          <div
            key={a.agencyId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <span style={{ fontSize: 13, color: '#374151' }}>{a.agencyName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 80,
                  height: 6,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(a.coveragePercent, 2)}%`,
                    height: '100%',
                    backgroundColor: '#ef4444',
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: '#6b7280', minWidth: 40, textAlign: 'right' }}>
                {a.coveragePercent}%
              </span>
            </div>
          </div>
        )) || <div style={{ color: '#9ca3af', fontSize: 13 }}>No data yet</div>}
      </div>

      {/* Recent Activity */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          gridColumn: '1 / -1',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>
          Recent Activity
        </h3>
        {recentActivity.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {recentActivity.map((a) => (
              <div
                key={a.agencyId}
                style={{
                  padding: 12,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  backgroundColor: '#fafafa',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.agencyName}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Status: <StatusBadge status={a.crawlStatus} />
                </div>
                {a.lastCrawledAt && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    Last crawled: {new Date(a.lastCrawledAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 13 }}>No recent activity</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agencies Tab
// ---------------------------------------------------------------------------

function AgenciesTab({
  agencies,
  search,
  setSearch,
  page,
  setPage,
}: {
  agencies: AgencyListResponse | null;
  search: string;
  setSearch: (s: string) => void;
  page: number;
  setPage: (p: number) => void;
}) {
  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search agencies..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            width: 300,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
          }}
        />
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>Rank</th>
              <th style={thStyle}>Agency</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>County</th>
              <th style={thStyle}>Population</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Documents</th>
              <th style={thStyle}>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {agencies?.agencies.map((a) => (
              <tr key={a.agencyId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{a.jurisdictionRank || '—'}</td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{a.agencyName}</td>
                <td style={tdStyle}>{a.agencyType || '—'}</td>
                <td style={tdStyle}>{a.county || '—'}</td>
                <td style={tdStyle}>
                  {a.populationEstimate ? a.populationEstimate.toLocaleString() : '—'}
                </td>
                <td style={tdStyle}>
                  <StatusBadge status={a.crawlStatus} />
                </td>
                <td style={tdStyle}>{a.documentsCount}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 60,
                        height: 6,
                        backgroundColor: '#e5e7eb',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${a.coveragePercent}%`,
                          height: '100%',
                          backgroundColor:
                            a.coveragePercent > 75
                              ? '#10b981'
                              : a.coveragePercent > 50
                              ? '#f59e0b'
                              : '#ef4444',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {a.coveredTopics}/{a.totalTopics}
                    </span>
                  </div>
                </td>
              </tr>
            )) || (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>
                  No agencies found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {agencies && agencies.pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            style={paginationBtnStyle(page <= 1)}
          >
            Previous
          </button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: '#6b7280' }}>
            Page {agencies.pagination.page} of {agencies.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(agencies.pagination.totalPages, page + 1))}
            disabled={page >= agencies.pagination.totalPages}
            style={paginationBtnStyle(page >= agencies.pagination.totalPages)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories Tab
// ---------------------------------------------------------------------------

function CategoriesTab({ matrix }: { matrix: DashboardData['matrix'] | undefined }) {
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {matrix?.categoryBreakdown.map((cat) => (
          <div
            key={cat.category}
            style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                {cat.displayName}
              </h3>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 12,
                  backgroundColor:
                    cat.avgCoveragePercent > 75
                      ? '#dcfce7'
                      : cat.avgCoveragePercent > 50
                      ? '#fef3c7'
                      : '#fef2f2',
                  color:
                    cat.avgCoveragePercent > 75
                      ? '#166534'
                      : cat.avgCoveragePercent > 50
                      ? '#92400e'
                      : '#991b1b',
                }}
              >
                {cat.avgCoveragePercent}%
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {cat.topicCount} topics
            </div>
            <div
              style={{
                width: '100%',
                height: 8,
                backgroundColor: '#e5e7eb',
                borderRadius: 4,
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${cat.avgCoveragePercent}%`,
                  height: '100%',
                  backgroundColor:
                    cat.avgCoveragePercent > 75
                      ? '#10b981'
                      : cat.avgCoveragePercent > 50
                      ? '#f59e0b'
                      : '#ef4444',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )) || (
          <div style={{ color: '#9ca3af', fontSize: 13, gridColumn: '1 / -1' }}>
            No category data available. Seed the CHP taxonomy first.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#f3f4f6', text: '#6b7280' },
    in_progress: { bg: '#dbeafe', text: '#1d4ed8' },
    completed: { bg: '#dcfce7', text: '#166534' },
    failed: { bg: '#fef2f2', text: '#991b1b' },
    skipped: { bg: '#fef3c7', text: '#92400e' },
  };

  const color = colors[status] || colors.pending;

  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 12,
        backgroundColor: color.bg,
        color: color.text,
        fontWeight: 500,
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textAlign: 'left',
  textTransform: 'uppercase',
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#374151',
};

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    backgroundColor: disabled ? '#f3f4f6' : 'white',
    color: disabled ? '#9ca3af' : '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
