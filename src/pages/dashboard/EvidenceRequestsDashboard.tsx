// ============================================================================
// Phase 3 — AI Evidence Requests Dashboard
// Shows AI-detected evidence gaps for a selected case.
// Allows client to respond: "Already requested", "Not relevant", "Remind me later"
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  ChevronDown, FileQuestion, Shield, Calendar,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceRequestResponse {
  id: string;
  requestId: string;
  respondedBy: string;
  responseType: string;
  deferUntilDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface EvidenceRequest {
  id: string;
  caseId: string;
  tenantId: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  sourceEventIds: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  responses: EvidenceRequestResponse[];
}

interface CriminalCase {
  caseId: string;
  title: string;
  caseNumber: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: 'text-red-300', bg: 'bg-red-500/15', label: 'High' },
  medium: { color: 'text-amber-300', bg: 'bg-amber-500/15', label: 'Medium' },
  low: { color: 'text-blue-300', bg: 'bg-blue-500/15', label: 'Low' },
};

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-amber-300', bg: 'bg-amber-500/10', icon: <AlertTriangle size={14} />, label: 'Pending' },
  acknowledged: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', icon: <CheckCircle size={14} />, label: 'Acknowledged' },
  dismissed: { color: 'text-slate-400', bg: 'bg-white/5', icon: <XCircle size={14} />, label: 'Dismissed' },
  deferred: { color: 'text-blue-300', bg: 'bg-blue-500/10', icon: <Clock size={14} />, label: 'Deferred' },
};

const typeLabels: Record<string, string> = {
  missing_bodycam: 'Missing Bodycam',
  missing_dashcam: 'Missing Dashcam',
  missing_witness_statement: 'Missing Witness Statement',
  timeline_gap: 'Timeline Gap',
  missing_dispatch_log: 'Missing Dispatch Log',
  missing_aerial_footage: 'Missing Aerial Footage',
  missing_forensic_report: 'Missing Forensic Report',
  missing_corroboration: 'Missing Corroboration',
  other: 'Other',
};

function getToken(): string | null {
  return localStorage.getItem('court-access-token');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidenceRequestsDashboard() {
  useAuthStore(); // ensure authenticated
  const [cases, setCases] = useState<CriminalCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [requests, setRequests] = useState<EvidenceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [deferDate, setDeferDate] = useState<string>('');
  const [responseNotes, setResponseNotes] = useState<string>('');

  // Fetch cases on mount
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const token = getToken();
        const res = await fetch('/api/cases', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch cases');
        const data = await res.json();
        setCases(data.cases ?? []);
        // Auto-select first case
        if (data.cases?.length > 0 && !selectedCaseId) {
          setSelectedCaseId(data.cases[0].caseId);
        }
      } catch (err) {
        console.error('Failed to fetch cases:', err);
      }
    };
    fetchCases();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch evidence requests when case changes
  const fetchRequests = useCallback(async () => {
    if (!selectedCaseId) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/cases/${selectedCaseId}/evidence-requests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch evidence requests');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Trigger gap detection
  const handleDetect = async () => {
    if (!selectedCaseId) return;
    setDetecting(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/cases/${selectedCaseId}/evidence-requests/detect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Gap detection failed');
      // Refresh requests
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDetecting(false);
    }
  };

  // Respond to a request
  const handleRespond = async (requestId: string, responseType: string) => {
    try {
      const token = getToken();
      const body: Record<string, unknown> = { responseType };
      if (responseType === 'defer' && deferDate) {
        body.deferUntilDate = new Date(deferDate).toISOString();
      }
      if (responseNotes.trim()) {
        body.notes = responseNotes.trim();
      }

      const res = await fetch(`/api/evidence-requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to respond');
      }

      setRespondingId(null);
      setDeferDate('');
      setResponseNotes('');
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Summary counts
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const highPriorityCount = requests.filter((r) => r.priority === 'high' && r.status === 'pending').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileQuestion size={28} className="text-amber-600" />
          <h1 className="text-2xl font-bold text-slate-100">AI Evidence Requests</h1>
        </div>
        <p className="text-slate-400 text-sm">
          AI-detected gaps in your evidence. Review and respond to ensure complete case coverage.
        </p>
      </div>

      {/* Case Selector + Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="case-select" className="text-sm font-medium text-slate-300">Case:</label>
          <select
            id="case-select"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="">Select a case...</option>
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.title} ({c.caseNumber})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-slate-300">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="dismissed">Dismissed</option>
            <option value="deferred">Deferred</option>
          </select>
        </div>

        <button
          onClick={handleDetect}
          disabled={!selectedCaseId || detecting}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={16} className={detecting ? 'animate-spin' : ''} />
          {detecting ? 'Detecting...' : 'Run Gap Detection'}
        </button>
      </div>

      {/* Summary Cards */}
      {selectedCaseId && requests.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <div className="text-sm text-slate-400">Total Requests</div>
            <div className="text-2xl font-bold text-slate-100">{requests.length}</div>
          </div>
          <div className="bg-white/5 rounded-lg border border-amber-500/20 p-4">
            <div className="text-sm text-amber-600">Pending Review</div>
            <div className="text-2xl font-bold text-amber-300">{pendingCount}</div>
          </div>
          <div className="bg-white/5 rounded-lg border border-red-500/20 p-4">
            <div className="text-sm text-red-600">High Priority</div>
            <div className="text-2xl font-bold text-red-300">{highPriorityCount}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-slate-400" />
          <span className="ml-3 text-slate-400">Loading evidence requests...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && selectedCaseId && requests.length === 0 && (
        <div className="text-center py-16 bg-white/5 rounded-lg border border-white/10">
          <Shield size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No evidence gaps detected</h3>
          <p className="text-slate-400 text-sm mb-4">
            {statusFilter
              ? 'No requests match the current filter. Try changing the status filter.'
              : 'Run gap detection to analyze your case evidence for missing items.'}
          </p>
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={detecting ? 'animate-spin' : ''} />
            Run Gap Detection
          </button>
        </div>
      )}

      {/* No case selected */}
      {!selectedCaseId && (
        <div className="text-center py-16 bg-white/5 rounded-lg border border-white/10">
          <FileQuestion size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-300">Select a case to view evidence requests</h3>
        </div>
      )}

      {/* Request Cards */}
      {!loading && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => {
            const priority = priorityConfig[req.priority] ?? priorityConfig.medium;
            const status = statusConfig[req.status] ?? statusConfig.pending;
            const isExpanded = respondingId === req.id;
            const latestResponse = req.responses?.[0];

            return (
              <div
                key={req.id}
                className={`bg-white/5 rounded-lg border ${
                  req.status === 'pending' ? 'border-amber-500/20' : 'border-white/10'
                } overflow-hidden transition-all`}
              >
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Priority indicator */}
                    <div className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${priority.bg} ${priority.color}`}>
                      {priority.label}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-100">{req.title}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{req.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="px-2 py-0.5 bg-white/10 rounded">{typeLabels[req.type] ?? req.type}</span>
                        <span>Detected {new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Latest response info */}
                      {latestResponse && (
                        <div className="mt-2 p-2 bg-white/5 rounded text-xs text-slate-400">
                          <span className="font-medium">Response:</span>{' '}
                          {latestResponse.responseType === 'requested' && 'Already requested'}
                          {latestResponse.responseType === 'not_relevant' && 'Marked as not relevant'}
                          {latestResponse.responseType === 'defer' && (
                            <>Deferred until {latestResponse.deferUntilDate ? new Date(latestResponse.deferUntilDate).toLocaleDateString() : 'later'}</>
                          )}
                          {latestResponse.notes && <> — {latestResponse.notes}</>}
                        </div>
                      )}
                    </div>

                    {/* Action toggle */}
                    {req.status === 'pending' && (
                      <button
                        onClick={() => { setRespondingId(isExpanded ? null : req.id); if (!isExpanded) { setDeferDate(''); setResponseNotes(''); } }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 rounded-lg hover:bg-amber-500/15 transition-colors"
                      >
                        Respond
                        <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Response Panel */}
                {isExpanded && (
                  <div className="border-t border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap gap-3 mb-3">
                      <button
                        onClick={() => handleRespond(req.id, 'requested')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle size={16} />
                        Already Requested
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'not_relevant')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                      >
                        <XCircle size={16} />
                        Not Relevant
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={deferDate}
                          onChange={(e) => setDeferDate(e.target.value)}
                          className="border border-white/10 rounded-lg px-3 py-2 text-sm"
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <button
                          onClick={() => handleRespond(req.id, 'defer')}
                          disabled={!deferDate}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Calendar size={16} />
                          Remind Me Later
                        </button>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Optional notes..."
                        value={responseNotes}
                        onChange={(e) => setResponseNotes(e.target.value)}
                        className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
