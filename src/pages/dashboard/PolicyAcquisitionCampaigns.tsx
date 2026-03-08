// ============================================
// Court Access — Policy Acquisition: Campaign Dashboard
// Staff dashboard for managing CPRA policy request campaigns.
// ============================================

import { useState, useMemo, useCallback } from 'react';
import {
  Send, Mail, CheckCircle, XCircle, Clock, AlertTriangle, Filter,
  ChevronLeft, ChevronRight, Search, Play, Square, BarChart3,
  Building2, MapPin, FileText, RefreshCw, X, Zap
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { DemoModeBadge } from '../../components/common/DemoModeBadge';
import { TEXT_COLORS } from '../../constants/designTokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PolicyRequestStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'responded'
  | 'documents_received'
  | 'denied'
  | 'no_response';

interface PolicyRequest {
  id: string;
  agencyName: string;
  agencyType: string;
  county: string;
  trackingId: string;
  status: PolicyRequestStatus;
  requestSentAt: string;
  responseAt: string | null;
  recordsEmail: string;
}

// ---------------------------------------------------------------------------
// Status Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PolicyRequestStatus, { label: string; bg: string; text: string; icon: typeof Send }> = {
  pending: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
  sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700', icon: Send },
  delivered: { label: 'Delivered', bg: 'bg-cyan-100', text: 'text-cyan-700', icon: Mail },
  responded: { label: 'Responded', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  documents_received: { label: 'Docs Received', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: FileText },
  denied: { label: 'Denied', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  no_response: { label: 'No Response', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
};

const ALL_STATUSES: PolicyRequestStatus[] = [
  'pending', 'sent', 'delivered', 'responded', 'documents_received', 'denied', 'no_response',
];

// ---------------------------------------------------------------------------
// Mock Campaign Data
// ---------------------------------------------------------------------------

function generateMockRequests(): PolicyRequest[] {
  const agencies: { name: string; type: string; county: string; email: string }[] = [
    { name: 'Los Angeles Police Department', type: 'Police', county: 'Los Angeles', email: 'records@lapd.online.org' },
    { name: 'San Francisco Police Department', type: 'Police', county: 'San Francisco', email: 'sfpd.records@sfgov.org' },
    { name: 'San Diego Police Department', type: 'Police', county: 'San Diego', email: 'records@pd.sandiego.gov' },
    { name: 'Los Angeles County Sheriff\'s Department', type: 'Sheriff', county: 'Los Angeles', email: 'lasd.records@lasd.org' },
    { name: 'Orange County Sheriff\'s Department', type: 'Sheriff', county: 'Orange', email: 'records@ocsd.org' },
    { name: 'Sacramento Police Department', type: 'Police', county: 'Sacramento', email: 'records@pd.cityofsacramento.org' },
    { name: 'Oakland Police Department', type: 'Police', county: 'Alameda', email: 'records@oaklandca.gov' },
    { name: 'San Jose Police Department', type: 'Police', county: 'Santa Clara', email: 'records@sanjoseca.gov' },
    { name: 'California Highway Patrol', type: 'State', county: 'Sacramento', email: 'records@chp.ca.gov' },
    { name: 'Fresno Police Department', type: 'Police', county: 'Fresno', email: 'records@fresno.gov' },
    { name: 'Long Beach Police Department', type: 'Police', county: 'Los Angeles', email: 'records@longbeach.gov' },
    { name: 'Riverside Police Department', type: 'Police', county: 'Riverside', email: 'records@riversideca.gov' },
  ];

  const statuses: PolicyRequestStatus[] = ['sent', 'delivered', 'responded', 'documents_received', 'denied', 'no_response', 'sent', 'sent', 'delivered', 'sent', 'pending', 'sent'];

  return agencies.map((a, i) => ({
    id: `req-${String(i + 1).padStart(4, '0')}`,
    agencyName: a.name,
    agencyType: a.type,
    county: a.county,
    trackingId: `CPRA-${Date.now().toString(36).toUpperCase()}-${String(i).padStart(3, '0')}`,
    status: statuses[i],
    requestSentAt: new Date(Date.now() - (i * 2 + 1) * 24 * 60 * 60 * 1000).toISOString(),
    responseAt: ['responded', 'documents_received', 'denied'].includes(statuses[i])
      ? new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
      : null,
    recordsEmail: a.email,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

export function PolicyAcquisitionCampaigns() {
  const [requests] = useState<PolicyRequest[]>(() => generateMockRequests());
  const [search, setSearch] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyRequestStatus | ''>('');
  const [page, setPage] = useState(1);
  const [showSendModal, setShowSendModal] = useState(false);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  // Derived: distinct counties
  const counties = useMemo(() => {
    const set = new Set(requests.map((r) => r.county));
    return Array.from(set).sort();
  }, [requests]);

  // Derived: filtered
  const filtered = useMemo(() => {
    let result = requests;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.agencyName.toLowerCase().includes(q) ||
          r.county.toLowerCase().includes(q) ||
          r.trackingId.toLowerCase().includes(q)
      );
    }
    if (countyFilter) {
      result = result.filter((r) => r.county === countyFilter);
    }
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }

    return result;
  }, [requests, search, countyFilter, statusFilter]);

  // Derived: stats
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const r of requests) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    const responded = (byStatus['responded'] || 0) + (byStatus['documents_received'] || 0);
    const responseRate = requests.length > 0 ? Math.round((responded / requests.length) * 100) : 0;

    return {
      total: requests.length,
      byStatus,
      responseRate,
      sentToday: requests.filter((r) => {
        const sent = new Date(r.requestSentAt);
        const today = new Date();
        return sent.toDateString() === today.toDateString();
      }).length,
    };
  }, [requests]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleCountyFilter = useCallback((val: string) => {
    setCountyFilter(val);
    setPage(1);
  }, []);

  const handleStatusFilter = useCallback((val: PolicyRequestStatus | '') => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setCountyFilter('');
    setStatusFilter('');
    setPage(1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Engine</h1>
          <p className="text-sm text-gray-500 mt-1">
            CPRA policy request campaign management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DemoModeBadge />
          {/* Scheduler Toggle */}
          <button
            onClick={() => setSchedulerRunning(!schedulerRunning)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              schedulerRunning
                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            {schedulerRunning ? <Square size={16} /> : <Play size={16} />}
            {schedulerRunning ? 'Stop Scheduler' : 'Start Scheduler'}
          </button>
          {/* Send Campaign Button */}
          <button
            onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium hover:bg-[#172E4A] transition-colors"
          >
            <Send size={16} />
            Send Campaign
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Send size={28} className={TEXT_COLORS.info} />}
          value={stats.total}
          label="Total Requests"
        />
        <StatCard
          icon={<Mail size={28} className={TEXT_COLORS.success} />}
          value={stats.byStatus['sent'] || 0}
          label="Sent"
        />
        <StatCard
          icon={<CheckCircle size={28} className={TEXT_COLORS.success} />}
          value={stats.byStatus['delivered'] || 0}
          label="Delivered"
        />
        <StatCard
          icon={<FileText size={28} className={TEXT_COLORS.accent} />}
          value={(stats.byStatus['responded'] || 0) + (stats.byStatus['documents_received'] || 0)}
          label="Responded"
        />
        <StatCard
          icon={<BarChart3 size={28} className={TEXT_COLORS.warning} />}
          value={`${stats.responseRate}%`}
          label="Response Rate"
        />
        <StatCard
          icon={<Zap size={28} className={TEXT_COLORS.orange} />}
          value={stats.sentToday}
          label="Sent Today"
        />
      </div>

      {/* Campaign Progress Bar */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Campaign Progress</h3>
          <span className="text-xs text-gray-500">
            {schedulerRunning ? (
              <span className="inline-flex items-center gap-1 text-green-600">
                <RefreshCw size={12} className="animate-spin" />
                Scheduler Active — 50/hr limit
              </span>
            ) : (
              <span className="text-gray-400">Scheduler Stopped</span>
            )}
          </span>
        </div>
        <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
          {ALL_STATUSES.map((s) => {
            const count = stats.byStatus[s] || 0;
            if (count === 0) return null;
            const pct = (count / stats.total) * 100;
            const config = STATUS_CONFIG[s];
            return (
              <div
                key={s}
                className={`${config.bg} flex items-center justify-center transition-all`}
                style={{ width: `${pct}%`, minWidth: count > 0 ? '24px' : '0' }}
                title={`${config.label}: ${count}`}
              >
                <span className={`text-[10px] font-medium ${config.text} truncate px-1`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {ALL_STATUSES.map((s) => {
            const count = stats.byStatus[s] || 0;
            if (count === 0) return null;
            const config = STATUS_CONFIG[s];
            return (
              <span key={s} className="inline-flex items-center gap-1 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${config.bg} border ${config.text}`} />
                {config.label}: {count}
              </span>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by agency, county, or tracking ID..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
            />
          </div>

          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={countyFilter}
              onChange={(e) => handleCountyFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] appearance-none"
            >
              <option value="">All Counties</option>
              {counties.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value as PolicyRequestStatus | '')}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] appearance-none"
            >
              <option value="">All Statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>

          {(search || countyFilter || statusFilter) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Showing {paginated.length} of {filtered.length} requests
          {(search || countyFilter || statusFilter) && ` (filtered from ${stats.total} total)`}
        </div>
      </Card>

      {/* Requests Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Tracking ID</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Agency</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">County</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Status</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden md:table-cell">Sent</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden lg:table-cell">Response</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold hidden lg:table-cell">Email</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Send size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No requests match your filters</p>
                  </td>
                </tr>
              ) : (
                paginated.map((req) => {
                  const statusConfig = STATUS_CONFIG[req.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <tr
                      key={req.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {req.trackingId}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{req.agencyName}</div>
                        <div className="text-xs text-gray-500">{req.agencyType}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-gray-700">
                          <MapPin size={12} className="text-gray-400" />
                          {req.county}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          <StatusIcon size={12} />
                          {statusConfig.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 hidden md:table-cell text-gray-500 text-xs">
                        {new Date(req.requestSentAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 hidden lg:table-cell text-gray-500 text-xs">
                        {req.responseAt ? new Date(req.responseAt).toLocaleDateString() : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-xs text-gray-500 truncate max-w-[180px] block">
                          {req.recordsEmail}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Send Campaign Modal */}
      {showSendModal && (
        <SendCampaignModal
          onClose={() => setShowSendModal(false)}
          onSend={() => {
            // In real implementation, calls POST /api/policy/campaigns/send
            setShowSendModal(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send Campaign Modal
// ---------------------------------------------------------------------------

interface SendCampaignModalProps {
  onClose: () => void;
  onSend: (input: { county?: string; agencyType?: string; onlyNew?: boolean }) => void;
}

function SendCampaignModal({ onClose, onSend }: SendCampaignModalProps) {
  const [county, setCounty] = useState('');
  const [agencyType, setAgencyType] = useState('');
  const [onlyNew, setOnlyNew] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend({
      county: county || undefined,
      agencyType: agencyType || undefined,
      onlyNew,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Send CPRA Campaign</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Send California Public Records Act requests to agencies with known records email addresses.
          Rate limit: max 50 emails per hour.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">County Filter (optional)</label>
            <input
              type="text"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
              placeholder="e.g., Los Angeles (leave blank for all)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agency Type Filter (optional)</label>
            <select
              value={agencyType}
              onChange={(e) => setAgencyType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
            >
              <option value="">All Types</option>
              <option value="Police">Police</option>
              <option value="Sheriff">Sheriff</option>
              <option value="State">State</option>
              <option value="District_Attorney">DA Bureau</option>
              <option value="University">University</option>
              <option value="Transit">Transit</option>
              <option value="Probation">Probation</option>
              <option value="TaskForce">Task Force</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="onlyNew"
              checked={onlyNew}
              onChange={(e) => setOnlyNew(e.target.checked)}
              className="w-4 h-4 text-[#1E3A5F] border-gray-300 rounded focus:ring-[#1E3A5F]"
            />
            <label htmlFor="onlyNew" className="text-sm text-gray-700">
              Only send to agencies not yet contacted
            </label>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700">
                <p className="font-medium">Rate Limit: 50 emails/hour</p>
                <p className="mt-1">Emails will be sent in batches with 2-second delays between sends. Excess agencies will be queued for the next batch.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1E3A5F] rounded-lg hover:bg-[#172E4A] transition-colors font-medium"
            >
              <Send size={14} />
              Send Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
