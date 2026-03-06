// ============================================
// Court Access — Beta Feedback Management Page
// Phase 120: Admin view of all beta feedback
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Filter,
  AlertTriangle,
  Bug,
  Eye,
  Gauge,
  Lightbulb,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { apiGet, apiPatch } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Feedback {
  id: string;
  userId: string;
  feedbackType: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  pageUrl: string;
  userAgent: string;
  screenshotUrl: string | null;
  adminNotes: string;
  resolvedAt: string | null;
  createdAt: string;
  user?: { id: string; email: string; name: string };
}

interface FeedbackStats {
  total: number;
  open: number;
  inReview: number;
  resolved: number;
  byType: { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  bug: Bug,
  analysis_error: AlertTriangle,
  ui_issue: Eye,
  performance: Gauge,
  feature_request: Lightbulb,
  other: HelpCircle,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-indigo-100 text-indigo-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('feedbackType', filterType);

      const [fbRes, statsRes] = await Promise.all([
        apiGet(`/api/feedback/admin/all?${params.toString()}`),
        apiGet('/api/feedback/admin/stats'),
      ]);

      if (fbRes.ok) {
        const data = await fbRes.json();
        setFeedbacks(data.feedbacks);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await apiPatch(`/api/feedback/admin/${id}`, { status });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update feedback:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Beta Feedback</h1>
            <p className="text-sm text-slate-500 mt-1">User-reported issues, suggestions, and bug reports</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Total</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Open</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">In Review</div>
              <div className="text-2xl font-bold text-blue-600">{stats.inReview}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Resolved</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.resolved}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Types</option>
            <option value="bug">Bug</option>
            <option value="analysis_error">Analysis Error</option>
            <option value="ui_issue">UI Issue</option>
            <option value="performance">Performance</option>
            <option value="feature_request">Feature Request</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Feedback List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading feedback...</div>
        ) : feedbacks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <MessageSquare size={40} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600">No feedback yet</h3>
            <p className="text-sm text-slate-400 mt-1">Beta users haven't submitted any feedback</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {feedbacks.map((fb) => {
              const TypeIcon = TYPE_ICONS[fb.feedbackType] || HelpCircle;
              const isExpanded = expandedId === fb.id;
              return (
                <div key={fb.id} className="px-6 py-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TypeIcon size={16} className="text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">{fb.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[fb.severity] || ''}`}>
                            {fb.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[fb.status] || ''}`}>
                            {fb.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {fb.user?.email || 'Unknown'} &middot; {new Date(fb.createdAt).toLocaleDateString()} &middot; {fb.feedbackType.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  {isExpanded && (
                    <div className="mt-3 ml-7 space-y-3">
                      <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                        {fb.description}
                      </div>
                      {fb.pageUrl && (
                        <div className="text-xs text-slate-500">Page: {fb.pageUrl}</div>
                      )}
                      <div className="flex gap-2">
                        {fb.status === 'open' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(fb.id, 'in_review'); }}
                            className="px-3 py-1 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-blue-700"
                          >
                            Mark In Review
                          </button>
                        )}
                        {(fb.status === 'open' || fb.status === 'in_review') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(fb.id, 'resolved'); }}
                            className="px-3 py-1 text-xs bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 text-emerald-700"
                          >
                            Resolve
                          </button>
                        )}
                        {fb.status !== 'closed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(fb.id, 'closed'); }}
                            className="px-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
