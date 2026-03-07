// ============================================
// Court Access — Bug Tracking Page
// Phase 121: Internal Bug Tracking System
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  Bug,
  Plus,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BugReport {
  id: string;
  feedbackId: string | null;
  title: string;
  description: string;
  reproductionSteps: string;
  severity: string;
  status: string;
  assignedTo: string | null;
  component: string;
  environment: string;
  fixCommit: string | null;
  fixVersion: string | null;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface BugStats {
  total: number;
  open: number;
  inProgress: number;
  fixed: number;
  byComponent: { component: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  fixed: 'bg-emerald-100 text-emerald-700',
  verified: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  wont_fix: 'bg-slate-100 text-slate-500',
};

const COMPONENTS = ['frontend', 'backend', 'worker', 'database', 'auth', 'upload', 'ai'];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BugTrackingPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [stats, setStats] = useState<BugStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSteps, setFormSteps] = useState('');
  const [formSeverity, setFormSeverity] = useState('medium');
  const [formComponent, setFormComponent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterSeverity) params.set('severity', filterSeverity);

      const [bugsRes, statsRes] = await Promise.all([
        apiGet(`/api/admin/bugs?${params.toString()}`),
        apiGet('/api/admin/bugs/stats'),
      ]);

      if (bugsRes.ok) {
        const data = await bugsRes.json();
        setBugs(data.bugs);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch bugs:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createBug = async () => {
    if (!formTitle || !formDescription) return;
    setSubmitting(true);
    try {
      const res = await apiPost('/api/admin/bugs', {
        title: formTitle,
        description: formDescription,
        reproductionSteps: formSteps,
        severity: formSeverity,
        component: formComponent,
      });
      if (res.ok) {
        setShowCreateForm(false);
        setFormTitle('');
        setFormDescription('');
        setFormSteps('');
        setFormSeverity('medium');
        setFormComponent('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create bug:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateBugStatus = async (id: string, status: string) => {
    try {
      const res = await apiPatch(`/api/admin/bugs/${id}`, { status });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Failed to update bug:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bug Tracking</h1>
            <p className="text-sm text-slate-500 mt-1">Internal issue tracking for beta period</p>
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
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              <Plus size={14} />
              New Bug
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Total Bugs</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Open</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">In Progress</div>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Fixed</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.fixed}</div>
            </div>
          </div>
        )}

        {/* Create Bug Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">New Bug Report</h2>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="Brief description of the bug"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-24"
                    placeholder="What happened? What was expected?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reproduction Steps</label>
                  <textarea
                    value={formSteps}
                    onChange={(e) => setFormSteps(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-24"
                    placeholder="1. Go to...\n2. Click on...\n3. See error..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                    <select
                      value={formSeverity}
                      onChange={(e) => setFormSeverity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Component</label>
                    <select
                      value={formComponent}
                      onChange={(e) => setFormComponent(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">Unassigned</option>
                      {COMPONENTS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createBug}
                  disabled={submitting || !formTitle || !formDescription}
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Bug'}
                </button>
              </div>
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
              <option value="in_progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="verified">Verified</option>
              <option value="closed">Closed</option>
              <option value="wont_fix">Won't Fix</option>
            </select>
          </div>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Bug List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading bugs...</div>
        ) : bugs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Bug size={40} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600">No bugs tracked</h3>
            <p className="text-sm text-slate-400 mt-1">Create a bug report to start tracking issues</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {bugs.map((bug) => {
              const isExpanded = expandedId === bug.id;
              return (
                <div key={bug.id} className="px-6 py-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : bug.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Bug size={16} className="text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">{bug.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[bug.severity] || ''}`}>
                            {bug.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bug.status] || ''}`}>
                            {bug.status.replace('_', ' ')}
                          </span>
                          {bug.component && (
                            <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600">
                              {bug.component}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {bug.reportedBy} &middot; {new Date(bug.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  {isExpanded && (
                    <div className="mt-3 ml-7 space-y-3">
                      <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                        {bug.description}
                      </div>
                      {bug.reproductionSteps && (
                        <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                          <div className="font-medium mb-1">Reproduction Steps:</div>
                          <div className="whitespace-pre-wrap">{bug.reproductionSteps}</div>
                        </div>
                      )}
                      {bug.fixCommit && (
                        <div className="text-xs text-slate-500">Fix commit: <code className="bg-slate-100 px-1 rounded">{bug.fixCommit}</code></div>
                      )}
                      <div className="flex gap-2">
                        {bug.status === 'open' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'in_progress'); }}
                            className="px-3 py-1 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-blue-700"
                          >
                            Start Work
                          </button>
                        )}
                        {bug.status === 'in_progress' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'fixed'); }}
                            className="px-3 py-1 text-xs bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 text-emerald-700"
                          >
                            Mark Fixed
                          </button>
                        )}
                        {bug.status === 'fixed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'verified'); }}
                            className="px-3 py-1 text-xs bg-green-50 border border-green-200 rounded hover:bg-green-100 text-green-700"
                          >
                            Verify Fix
                          </button>
                        )}
                        {bug.status !== 'closed' && bug.status !== 'wont_fix' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateBugStatus(bug.id, 'closed'); }}
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
