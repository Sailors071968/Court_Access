// ============================================================================
// Phase 138 — Policy Compliance Dashboard
// Displays: cases analyzed, potential inconsistencies, policy rules referenced,
// review status, agency heatmap, confidence distribution.
// Phase 139 — Policy Inconsistency Heatmap (integrated)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  totalCasesAnalyzed: number;
  totalFindings: number;
  findingsByType: Record<string, number>;
  findingsByAgency: Array<{ agencyId: string; agencyName: string; count: number }>;
  reviewStats: {
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
  recentFindings: Array<{
    findingId: string;
    caseId: string;
    agencyId: string;
    findingType: string;
    confidence: number;
    detectedAction: string;
    policyReference: string;
    createdAt: string;
  }>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  topPolicyCategories: Array<{ category: string; count: number }>;
}

interface HeatmapEntry {
  agencyId: string;
  agencyName: string;
  county: string;
  potentialInconsistencies: number;
  casesAnalyzed: number;
  topCategory: string;
  averageConfidence: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PolicyComplianceDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap' | 'reviews' | 'recent'>('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, heatRes] = await Promise.all([
        fetch(`${API_BASE}/api/compliance/dashboard`),
        fetch(`${API_BASE}/api/compliance/heatmap`),
      ]);

      if (dashRes.ok) {
        const dashJson = await dashRes.json();
        if (dashJson.success) setDashboard(dashJson.data);
      }
      if (heatRes.ok) {
        const heatJson = await heatRes.json();
        if (heatJson.success) setHeatmap(heatJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const StatCard = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
    <div style={{
      background: '#1a1a2e',
      border: `1px solid ${color}33`,
      borderRadius: 8,
      padding: '16px 20px',
      minWidth: 160,
    }}>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );

  const ConfidenceBar = ({ value }: { value: number }) => {
    const pct = Math.round(value * 100);
    const color = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 6, background: '#333', borderRadius: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
        </div>
        <span style={{ color, fontSize: 12, fontWeight: 600 }}>{pct}%</span>
      </div>
    );
  };

  const FindingTypeBadge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
      potential_inconsistency: '#f87171',
      consistent: '#4ade80',
      insufficient_evidence: '#facc15',
      requires_review: '#60a5fa',
    };
    return (
      <span style={{
        background: `${colors[type] || '#888'}22`,
        color: colors[type] || '#888',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
      }}>
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', color: '#e0e0e0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#fff' }}>
          Policy Compliance Analysis Dashboard
        </h1>
        <p style={{ color: '#888', margin: '4px 0 0', fontSize: 14 }}>
          Phases 129-150 — Evidence-backed policy compliance analysis engine
        </p>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 8, padding: 12, marginBottom: 16, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {loading && !dashboard && (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
          Loading compliance dashboard...
        </div>
      )}

      {/* Stats Row */}
      {dashboard && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard label="Cases Analyzed" value={dashboard.totalCasesAnalyzed} color="#60a5fa" />
            <StatCard label="Total Findings" value={dashboard.totalFindings} color="#c084fc" />
            <StatCard
              label="Potential Inconsistencies"
              value={dashboard.findingsByType['potential_inconsistency'] || 0}
              color="#f87171"
            />
            <StatCard label="Pending Reviews" value={dashboard.reviewStats.pending} color="#facc15" />
            <StatCard label="Approved" value={dashboard.reviewStats.approved} color="#4ade80" />
            <StatCard label="Agencies Flagged" value={dashboard.findingsByAgency.length} color="#fb923c" />
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #333' }}>
            {(['overview', 'heatmap', 'reviews', 'recent'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                  color: activeTab === tab ? '#60a5fa' : '#888',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'heatmap' ? 'Agency Heatmap' : tab === 'reviews' ? 'Review Queue' : tab}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Confidence Distribution */}
              <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>Confidence Distribution</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#4ade80' }}>High (&ge;80%)</span>
                    <span style={{ fontWeight: 700, color: '#4ade80' }}>{dashboard.confidenceDistribution.high}</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4 }}>
                    <div style={{
                      width: `${dashboard.totalFindings > 0 ? (dashboard.confidenceDistribution.high / dashboard.totalFindings) * 100 : 0}%`,
                      height: '100%', background: '#4ade80', borderRadius: 4,
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#facc15' }}>Medium (60-79%)</span>
                    <span style={{ fontWeight: 700, color: '#facc15' }}>{dashboard.confidenceDistribution.medium}</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4 }}>
                    <div style={{
                      width: `${dashboard.totalFindings > 0 ? (dashboard.confidenceDistribution.medium / dashboard.totalFindings) * 100 : 0}%`,
                      height: '100%', background: '#facc15', borderRadius: 4,
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#f87171' }}>Low (&lt;60%)</span>
                    <span style={{ fontWeight: 700, color: '#f87171' }}>{dashboard.confidenceDistribution.low}</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4 }}>
                    <div style={{
                      width: `${dashboard.totalFindings > 0 ? (dashboard.confidenceDistribution.low / dashboard.totalFindings) * 100 : 0}%`,
                      height: '100%', background: '#f87171', borderRadius: 4,
                    }} />
                  </div>
                </div>
              </div>

              {/* Top Policy Categories */}
              <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>Top Policy Categories</h3>
                {dashboard.topPolicyCategories.length === 0 ? (
                  <p style={{ color: '#666', fontSize: 13 }}>No findings yet. Run compliance analysis to populate.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dashboard.topPolicyCategories.map((cat, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #222' }}>
                        <span style={{ color: '#ccc' }}>{cat.category}</span>
                        <span style={{ color: '#c084fc', fontWeight: 700 }}>{cat.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Review Status */}
              <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>Review Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: 12, background: '#facc1511', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#facc15' }}>{dashboard.reviewStats.pending}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Pending</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: '#60a5fa11', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa' }}>{dashboard.reviewStats.inReview}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>In Review</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: '#4ade8011', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80' }}>{dashboard.reviewStats.approved}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Approved</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: '#f8717111', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#f87171' }}>{dashboard.reviewStats.rejected}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Rejected</div>
                  </div>
                </div>
              </div>

              {/* Finding Types */}
              <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>Finding Types</h3>
                {Object.keys(dashboard.findingsByType).length === 0 ? (
                  <p style={{ color: '#666', fontSize: 13 }}>No findings yet. Run compliance analysis to populate.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(dashboard.findingsByType).map(([type, count]) => (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #222' }}>
                        <FindingTypeBadge type={type} />
                        <span style={{ fontWeight: 700, color: '#ccc' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Heatmap Tab (Phase 139) */}
          {activeTab === 'heatmap' && (
            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>
                Agency Potential Inconsistency Heatmap
              </h3>
              {heatmap.length === 0 ? (
                <p style={{ color: '#666', fontSize: 13 }}>No agency data available. Run compliance analysis to generate heatmap data.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #444' }}>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Agency</th>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>County</th>
                        <th style={{ textAlign: 'center', padding: 10, color: '#888' }}>Inconsistencies</th>
                        <th style={{ textAlign: 'center', padding: 10, color: '#888' }}>Cases</th>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Top Category</th>
                        <th style={{ textAlign: 'center', padding: 10, color: '#888' }}>Avg Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.map((entry, i) => {
                        const intensity = Math.min(255, Math.floor(entry.potentialInconsistencies * 25));
                        const bgColor = `rgba(248, 113, 113, ${intensity / 255 * 0.2})`;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #222', background: bgColor }}>
                            <td style={{ padding: 10, fontWeight: 600, color: '#fff' }}>{entry.agencyName}</td>
                            <td style={{ padding: 10, color: '#aaa' }}>{entry.county}</td>
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              <span style={{
                                background: '#f8717133',
                                color: '#f87171',
                                padding: '2px 10px',
                                borderRadius: 12,
                                fontWeight: 700,
                              }}>
                                {entry.potentialInconsistencies}
                              </span>
                            </td>
                            <td style={{ padding: 10, textAlign: 'center', color: '#aaa' }}>{entry.casesAnalyzed}</td>
                            <td style={{ padding: 10, color: '#c084fc' }}>{entry.topCategory}</td>
                            <td style={{ padding: 10 }}>
                              <ConfidenceBar value={entry.averageConfidence} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>
                Investigator Review Queue
              </h3>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                All findings must be reviewed by a human investigator before inclusion in any report.
                Findings are ordered by priority (urgent first).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ textAlign: 'center', padding: 16, background: '#facc1511', borderRadius: 8, border: '1px solid #facc1533' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#facc15' }}>{dashboard.reviewStats.pending}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>Pending Review</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: '#60a5fa11', borderRadius: 8, border: '1px solid #60a5fa33' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>{dashboard.reviewStats.inReview}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>In Review</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: '#4ade8011', borderRadius: 8, border: '1px solid #4ade8033' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{dashboard.reviewStats.approved}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>Approved for Report</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: '#f8717111', borderRadius: 8, border: '1px solid #f8717133' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#f87171' }}>{dashboard.reviewStats.rejected}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>Rejected</div>
                </div>
              </div>
              <p style={{ color: '#555', fontSize: 12, fontStyle: 'italic' }}>
                Note: This system identifies potential policy inconsistencies only. It does not determine
                whether any policy was actually not followed. All findings require expert human review.
              </p>
            </div>
          )}

          {/* Recent Findings Tab */}
          {activeTab === 'recent' && (
            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #333' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff' }}>
                Recent Findings
              </h3>
              {dashboard.recentFindings.length === 0 ? (
                <p style={{ color: '#666', fontSize: 13 }}>No findings yet. Run compliance analysis on a case to see results here.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #444' }}>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Case</th>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Type</th>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Action Detected</th>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Policy Reference</th>
                        <th style={{ textAlign: 'center', padding: 10, color: '#888' }}>Confidence</th>
                        <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentFindings.map((finding, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: 10, color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>
                            {finding.caseId.substring(0, 8)}...
                          </td>
                          <td style={{ padding: 10 }}>
                            <FindingTypeBadge type={finding.findingType} />
                          </td>
                          <td style={{ padding: 10, color: '#ccc' }}>{finding.detectedAction.replace(/_/g, ' ')}</td>
                          <td style={{ padding: 10, color: '#aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {finding.policyReference}
                          </td>
                          <td style={{ padding: 10 }}>
                            <ConfidenceBar value={finding.confidence} />
                          </td>
                          <td style={{ padding: 10, color: '#666', fontSize: 12 }}>
                            {new Date(finding.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Safety Guardrail Notice (Phase 150) */}
          <div style={{
            marginTop: 24,
            padding: 16,
            background: '#1e3a5f22',
            border: '1px solid #1e3a5f',
            borderRadius: 8,
            fontSize: 12,
            color: '#93c5fd',
          }}>
            <strong>Safety Notice (Phase 150):</strong> This system uses &quot;potential policy inconsistency&quot;
            language only. It never states that a policy was violated. All findings are preliminary
            and require human expert review. Confidence scores represent statistical likelihood, not certainty.
          </div>
        </>
      )}
    </div>
  );
}
