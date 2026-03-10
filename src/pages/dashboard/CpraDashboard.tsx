/**
 * Phase 42-43: CPRA Request Dashboard
 *
 * Route: /dashboard/cpra
 *
 * Displays:
 * - Campaign overview (total agencies, requests sent, responses received)
 * - Follow-ups pending
 * - Status breakdown (Sent, Awaiting, Follow-Up, Received, Closed)
 * - Campaign list
 * - Agency response tracking table
 */

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CpraDashboardData {
  totalAgencies: number;
  totalRequestsSent: number;
  totalResponsesReceived: number;
  totalFollowUpsPending: number;
  totalClosed: number;
  activeCampaigns: number;
  statusBreakdown: Record<string, number>;
  safetyStatus: {
    dailyLimit: { sentToday: number; remaining: number; allowed: boolean };
    minuteLimit: { sentLastMinute: number; allowed: boolean };
    activeCampaigns: number;
    openRequests: number;
    safeguards: {
      maxEmailsPerDay: number;
      maxEmailsPerMinute: number;
      maxFollowUps: number;
      businessDaysBeforeFollowUp: number;
    };
  };
}

interface AnnualUpdateSummary {
  totalScheduled: number;
  totalSent: number;
  totalAwaitingResponse: number;
  totalReceived: number;
  totalClosed: number;
  upcomingUpdates: Array<{
    updateId: string;
    agencyId: string;
    annualUpdateDue: string | null;
    status: string;
  }>;
}

interface AnnualUpdateItem {
  updateId: string;
  agencyId: string;
  agencyName: string;
  status: string;
  requestedAt: string;
  annualUpdateDue: string | null;
  policyReceivedAt: string | null;
  followUpCount: number;
  responseReceived: boolean;
  closed: boolean;
}

interface CampaignItem {
  campaignId: string;
  campaignName: string;
  createdAt: string;
  active: boolean;
  requestCount: number;
}

interface CampaignDetail {
  campaign: {
    campaignId: string;
    campaignName: string;
    active: boolean;
    createdAt: string;
  };
  requests: Array<{
    requestId: string;
    agencyId: string;
    agencyName: string;
    status: string;
    sentAt: string | null;
    followUpCount: number;
    responseReceived: boolean;
    closed: boolean;
  }>;
  deadlineSummary: {
    totalRequests: number;
    sentRequests: number;
    overdueRequests: number;
    needsFollowUp: number;
    responded: number;
    closed: number;
  };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/cpra';

async function fetchCpraDashboard(): Promise<CpraDashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchCampaigns(): Promise<CampaignItem[]> {
  const res = await fetch(`${API_BASE}/campaigns`);
  if (!res.ok) throw new Error(`Campaigns fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchCampaignDetail(campaignId: string): Promise<CampaignDetail> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}`);
  if (!res.ok) throw new Error(`Campaign detail fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function createCampaign(name: string): Promise<{ campaignId: string }> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignName: name }),
  });
  if (!res.ok) throw new Error(`Create campaign failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function launchCampaign(campaignId: string): Promise<{ enqueued: number; skipped: number }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/launch`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Launch campaign failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function markResponseReceived(requestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/response`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Mark response failed: ${res.status}`);
}

async function triggerOverdueCheck(): Promise<void> {
  const res = await fetch(`${API_BASE}/overdue`, { method: 'POST' });
  if (!res.ok) throw new Error(`Overdue check failed: ${res.status}`);
}

async function fetchAnnualUpdateSummary(): Promise<AnnualUpdateSummary> {
  const res = await fetch(`${API_BASE}/annual/dashboard`);
  if (!res.ok) throw new Error(`Annual summary fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchAnnualUpdates(): Promise<AnnualUpdateItem[]> {
  const res = await fetch(`${API_BASE}/annual/updates`);
  if (!res.ok) throw new Error(`Annual updates fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function markAnnualUpdateReceived(updateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/annual/updates/${updateId}/received`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Mark annual received failed: ${res.status}`);
}

async function triggerAnnualCheck(): Promise<void> {
  const res = await fetch(`${API_BASE}/annual/check`, { method: 'POST' });
  if (!res.ok) throw new Error(`Annual check failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CpraDashboard() {
  const [dashboard, setDashboard] = useState<CpraDashboardData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annualSummary, setAnnualSummary] = useState<AnnualUpdateSummary | null>(null);
  const [annualUpdates, setAnnualUpdates] = useState<AnnualUpdateItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'tracking' | 'annual'>('overview');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashData, campaignData, annualData, annualList] = await Promise.all([
        fetchCpraDashboard(),
        fetchCampaigns(),
        fetchAnnualUpdateSummary().catch(() => null),
        fetchAnnualUpdates().catch(() => []),
      ]);
      setDashboard(dashData);
      setCampaigns(campaignData);
      setAnnualSummary(annualData);
      setAnnualUpdates(annualList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      setCreating(true);
      await createCampaign(newCampaignName.trim());
      setNewCampaignName('');
      loadData();
    } catch (err) {
      alert(`Failed to create campaign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleLaunchCampaign = async (campaignId: string) => {
    try {
      const result = await launchCampaign(campaignId);
      alert(`Campaign launched: ${result.enqueued} requests enqueued, ${result.skipped} skipped`);
      loadData();
    } catch (err) {
      alert(`Launch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleViewCampaign = async (campaignId: string) => {
    try {
      const detail = await fetchCampaignDetail(campaignId);
      setSelectedCampaign(detail);
      setActiveTab('tracking');
    } catch (err) {
      alert(`Failed to load campaign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleMarkResponse = async (requestId: string) => {
    try {
      await markResponseReceived(requestId);
      if (selectedCampaign) {
        const detail = await fetchCampaignDetail(selectedCampaign.campaign.campaignId);
        setSelectedCampaign(detail);
      }
      loadData();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleOverdueCheck = async () => {
    try {
      await triggerOverdueCheck();
      alert('Overdue check scheduled');
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAnnualCheck = async () => {
    try {
      await triggerAnnualCheck();
      alert('Annual update check scheduled');
      loadData();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleMarkAnnualReceived = async (updateId: string) => {
    try {
      await markAnnualUpdateReceived(updateId);
      alert('Annual update marked received — next cycle scheduled');
      loadData();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading && !dashboard) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Loading CPRA Dashboard...</div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#ef4444' }}>{error}</div>
        <button
          onClick={loadData}
          style={{ marginTop: 16, padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
          CPRA Request System
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          Autonomous California Public Records Act request tracking
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Agencies" value={dashboard?.totalAgencies ?? 0} color="#3b82f6" />
        <StatCard label="Requests Sent" value={dashboard?.totalRequestsSent ?? 0} color="#8b5cf6" />
        <StatCard label="Responses Received" value={dashboard?.totalResponsesReceived ?? 0} color="#10b981" />
        <StatCard label="Follow-Ups Pending" value={dashboard?.totalFollowUpsPending ?? 0} color="#f59e0b" />
        <StatCard label="Closed" value={dashboard?.totalClosed ?? 0} color="#6b7280" />
        <StatCard label="Active Campaigns" value={dashboard?.activeCampaigns ?? 0} color="#059669" />
      </div>

      {/* Safety Status */}
      {dashboard?.safetyStatus && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 13 }}>
          <strong>Safeguards:</strong>{' '}
          {dashboard.safetyStatus.dailyLimit.sentToday}/{dashboard.safetyStatus.safeguards.maxEmailsPerDay} daily limit |{' '}
          {dashboard.safetyStatus.minuteLimit.sentLastMinute}/{dashboard.safetyStatus.safeguards.maxEmailsPerMinute} per minute |{' '}
          Max {dashboard.safetyStatus.safeguards.maxFollowUps} follow-ups |{' '}
          {dashboard.safetyStatus.openRequests} open requests
        </div>
      )}

      {/* Admin Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={handleOverdueCheck}
          style={{ padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Process Overdue
        </button>
        <button
          onClick={loadData}
          style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Refresh
        </button>
      </div>

      {/* Status Breakdown */}
      {dashboard?.statusBreakdown && Object.keys(dashboard.statusBreakdown).length > 0 && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>
            Status Breakdown
          </h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(dashboard.statusBreakdown).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={status} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Annual Update Summary */}
      {annualSummary && (
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 13 }}>
          <strong>Annual Updates:</strong>{' '}
          {annualSummary.totalScheduled} scheduled |{' '}
          {annualSummary.totalSent} sent |{' '}
          {annualSummary.totalAwaitingResponse} awaiting |{' '}
          {annualSummary.totalReceived} received |{' '}
          {annualSummary.upcomingUpdates.length} due in 30 days
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        {(['overview', 'campaigns', 'tracking', 'annual'] as const).map((tab) => (
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
      {activeTab === 'overview' && <OverviewTab dashboard={dashboard} />}
      {activeTab === 'campaigns' && (
        <CampaignsTab
          campaigns={campaigns}
          newCampaignName={newCampaignName}
          setNewCampaignName={setNewCampaignName}
          creating={creating}
          onCreateCampaign={handleCreateCampaign}
          onLaunchCampaign={handleLaunchCampaign}
          onViewCampaign={handleViewCampaign}
        />
      )}
      {activeTab === 'tracking' && (
        <TrackingTab
          campaignDetail={selectedCampaign}
          onMarkResponse={handleMarkResponse}
        />
      )}
      {activeTab === 'annual' && (
        <AnnualUpdateTab
          summary={annualSummary}
          updates={annualUpdates}
          onTriggerCheck={handleAnnualCheck}
          onMarkReceived={handleMarkAnnualReceived}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ dashboard }: { dashboard: CpraDashboardData | null }) {
  if (!dashboard) return null;

  const responseRate = dashboard.totalRequestsSent > 0
    ? Math.round((dashboard.totalResponsesReceived / dashboard.totalRequestsSent) * 100)
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Response Rate</h3>
        <div style={{ fontSize: 48, fontWeight: 700, color: responseRate > 50 ? '#10b981' : '#f59e0b' }}>
          {responseRate}%
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          {dashboard.totalResponsesReceived} of {dashboard.totalRequestsSent} agencies responded
        </div>
      </div>

      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Pipeline Progress</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ProgressBar label="Sent" value={dashboard.totalRequestsSent} max={dashboard.totalAgencies} color="#8b5cf6" />
          <ProgressBar label="Responded" value={dashboard.totalResponsesReceived} max={dashboard.totalRequestsSent || 1} color="#10b981" />
          <ProgressBar label="Closed" value={dashboard.totalClosed} max={dashboard.totalRequestsSent || 1} color="#6b7280" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Tab
// ---------------------------------------------------------------------------

function CampaignsTab({
  campaigns,
  newCampaignName,
  setNewCampaignName,
  creating,
  onCreateCampaign,
  onLaunchCampaign,
  onViewCampaign,
}: {
  campaigns: CampaignItem[];
  newCampaignName: string;
  setNewCampaignName: (s: string) => void;
  creating: boolean;
  onCreateCampaign: () => void;
  onLaunchCampaign: (id: string) => void;
  onViewCampaign: (id: string) => void;
}) {
  return (
    <div>
      {/* Create Campaign */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="New campaign name..."
          value={newCampaignName}
          onChange={(e) => setNewCampaignName(e.target.value)}
          style={{ width: 300, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
        />
        <button
          onClick={onCreateCampaign}
          disabled={creating || !newCampaignName.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: creating ? '#9ca3af' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: creating ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {creating ? 'Creating...' : 'Create Campaign'}
        </button>
      </div>

      {/* Campaign List */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>Campaign</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Requests</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.campaignId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{c.campaignName}</div>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: c.active ? '#dcfce7' : '#f3f4f6',
                    color: c.active ? '#166534' : '#6b7280',
                  }}>
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={tdStyle}>{c.requestCount}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => onViewCampaign(c.campaignId)}
                      style={{ padding: '4px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      View
                    </button>
                    {c.active && (
                      <button
                        onClick={() => onLaunchCampaign(c.campaignId)}
                        style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Launch
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>
                  No campaigns yet. Create one to start sending CPRA requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tracking Tab (Phase 43 — Agency Response Tracking)
// ---------------------------------------------------------------------------

function TrackingTab({
  campaignDetail,
  onMarkResponse,
}: {
  campaignDetail: CampaignDetail | null;
  onMarkResponse: (requestId: string) => void;
}) {
  if (!campaignDetail) {
    return (
      <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
        Select a campaign from the Campaigns tab to view tracking details.
      </div>
    );
  }

  const { campaign, requests, deadlineSummary } = campaignDetail;

  return (
    <div>
      {/* Campaign Header */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>
          {campaign.campaignName}
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Created {new Date(campaign.createdAt).toLocaleDateString()} | {requests.length} requests
        </p>
      </div>

      {/* Deadline Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MiniStat label="Total" value={deadlineSummary.totalRequests} />
        <MiniStat label="Sent" value={deadlineSummary.sentRequests} />
        <MiniStat label="Overdue" value={deadlineSummary.overdueRequests} color="#ef4444" />
        <MiniStat label="Needs Follow-Up" value={deadlineSummary.needsFollowUp} color="#f59e0b" />
        <MiniStat label="Responded" value={deadlineSummary.responded} color="#10b981" />
        <MiniStat label="Closed" value={deadlineSummary.closed} />
      </div>

      {/* Request Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>Agency</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Sent</th>
              <th style={thStyle}>Follow-Ups</th>
              <th style={thStyle}>Response</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.requestId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{r.agencyName}</div>
                </td>
                <td style={tdStyle}><StatusBadge status={r.status} /></td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td style={tdStyle}>{r.followUpCount}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: r.responseReceived ? '#dcfce7' : '#fef3c7',
                    color: r.responseReceived ? '#166534' : '#92400e',
                  }}>
                    {r.responseReceived ? 'Received' : 'Awaiting'}
                  </span>
                </td>
                <td style={tdStyle}>
                  {!r.responseReceived && !r.closed && (
                    <button
                      onClick={() => onMarkResponse(r.requestId)}
                      style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Mark Received
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>
                  No requests in this campaign yet. Launch the campaign to start sending.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Annual Update Tab (Phase 46-52 — Annual Policy Update Tracking)
// ---------------------------------------------------------------------------

function AnnualUpdateTab({
  summary,
  updates,
  onTriggerCheck,
  onMarkReceived,
}: {
  summary: AnnualUpdateSummary | null;
  updates: AnnualUpdateItem[];
  onTriggerCheck: () => void;
  onMarkReceived: (updateId: string) => void;
}) {
  return (
    <div>
      {/* Summary Stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          <MiniStat label="Scheduled" value={summary.totalScheduled} color="#3b82f6" />
          <MiniStat label="Sent" value={summary.totalSent} color="#8b5cf6" />
          <MiniStat label="Awaiting" value={summary.totalAwaitingResponse} color="#f59e0b" />
          <MiniStat label="Received" value={summary.totalReceived} color="#10b981" />
          <MiniStat label="Closed" value={summary.totalClosed} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={onTriggerCheck}
          style={{ padding: '8px 16px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Run Annual Check
        </button>
      </div>

      {/* Annual Updates Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={thStyle}>Agency</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last Received</th>
              <th style={thStyle}>Next Update</th>
              <th style={thStyle}>Follow-Ups</th>
              <th style={thStyle}>Response</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {updates.map((u) => (
              <tr key={u.updateId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{u.agencyName}</div>
                </td>
                <td style={tdStyle}><StatusBadge status={u.status} /></td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {u.policyReceivedAt ? new Date(u.policyReceivedAt).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {u.annualUpdateDue ? new Date(u.annualUpdateDue).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td style={tdStyle}>{u.followUpCount}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: u.responseReceived ? '#dcfce7' : '#fef3c7',
                    color: u.responseReceived ? '#166534' : '#92400e',
                  }}>
                    {u.responseReceived ? 'Received' : 'Awaiting'}
                  </span>
                </td>
                <td style={tdStyle}>
                  {!u.responseReceived && !u.closed && (
                    <button
                      onClick={() => onMarkReceived(u.updateId)}
                      style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Mark Received
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {updates.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>
                  No annual updates scheduled yet. Updates are created automatically when agencies provide policy documents.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: '#f3f4f6', text: '#6b7280' },
    scheduled: { bg: '#dbeafe', text: '#1e40af' },
    sent: { bg: '#dbeafe', text: '#1e40af' },
    awaiting_response: { bg: '#fef3c7', text: '#92400e' },
    follow_up_1: { bg: '#fed7aa', text: '#9a3412' },
    follow_up_2: { bg: '#fecaca', text: '#991b1b' },
    follow_up_final: { bg: '#fecaca', text: '#7f1d1d' },
    documents_received: { bg: '#dcfce7', text: '#166534' },
    received: { bg: '#dcfce7', text: '#166534' },
    closed: { bg: '#f3f4f6', text: '#374151' },
  };

  const c = colors[status] ?? { bg: '#f3f4f6', text: '#6b7280' };

  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: c.bg,
      color: c.text,
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, color: '#374151', minWidth: 40, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? '#111827', marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#374151',
};
