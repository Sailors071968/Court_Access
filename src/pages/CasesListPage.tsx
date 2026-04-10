// ============================================
// Court Access — Cases List Page
// Wired to real backend API (Phase 4 — Product Completion)
// ============================================

import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { CaseStatusBadge } from '../components/common/StatusBadge';
import { fetchCases, createCase, deleteCase, type ApiCase, CASE_TYPES } from '../services/caseApi';

export function CasesListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDeleteCaseId, setConfirmDeleteCaseId] = useState<string | null>(null);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [deleteCaseError, setDeleteCaseError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCases();
      setCases(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleDeleteCase = useCallback(async (caseId: string) => {
    setDeletingCaseId(caseId);
    setDeleteCaseError(null);
    try {
      await deleteCase(caseId);
      setCases((prev) => prev.filter((c) => c.caseId !== caseId));
      setConfirmDeleteCaseId(null);
    } catch (err) {
      setDeleteCaseError(err instanceof Error ? err.message : 'Failed to delete case');
    } finally {
      setDeletingCaseId(null);
    }
  }, []);

  const filteredCases = cases.filter((c) => {
    const matchesSearch = !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-sm text-gray-500 mt-1">{cases.length} total cases</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus size={16} />
          New Case
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search cases"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading cases...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-600 mb-2">{error}</p>
          <button onClick={loadCases} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Retry</button>
        </div>
      )}

      {/* Cases Grid */}
      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((c) => (
            <Card key={c.caseId} hover padding="md" className="cursor-pointer" onClick={() => navigate(`/cases/${c.caseId}/overview`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  <p className="text-sm text-gray-500">#{c.caseNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CaseStatusBadge status={c.status} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteCaseId(c.caseId); setDeleteCaseError(null); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete case"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium">Jurisdiction:</span> {c.jurisdiction}</p>
                {c.judge && <p><span className="font-medium">Judge:</span> {c.judge}</p>}
                {c.nextHearing && <p><span className="font-medium">Next Hearing:</span> {c.nextHearing}</p>}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                <span>{c._count?.evidence ?? 0} evidence items</span>
                <span>{c.caseType}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && filteredCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {cases.length === 0
              ? 'No cases yet. Click "New Case" to create your first case.'
              : 'No cases found matching your criteria.'}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Case</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {cases.find((c) => c.caseId === confirmDeleteCaseId)?.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                #{cases.find((c) => c.caseId === confirmDeleteCaseId)?.caseNumber}
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this case? All associated evidence, timeline events, and analysis data will be permanently removed.
            </p>

            {deleteCaseError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {deleteCaseError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmDeleteCaseId(null); setDeleteCaseError(null); }}
                disabled={deletingCaseId === confirmDeleteCaseId}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCase(confirmDeleteCaseId)}
                disabled={deletingCaseId === confirmDeleteCaseId}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingCaseId === confirmDeleteCaseId ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Case
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <CreateCaseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newCase) => {
            setCases((prev) => [newCase, ...prev]);
            setShowCreateModal(false);
            navigate(`/cases/${newCase.caseId}/overview`);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Case Modal
// ---------------------------------------------------------------------------

function CreateCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: ApiCase) => void }) {
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [caseType, setCaseType] = useState('felony');
  const [court, setCourt] = useState('');
  const [judge, setJudge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !caseNumber || !jurisdiction) return;

    try {
      setSubmitting(true);
      setFormError(null);
      const newCase = await createCase({ title, caseNumber, jurisdiction, caseType, court: court || undefined, judge: judge || undefined });
      onCreated(newCase);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Case</h2>
        {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., People v. Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Number *</label>
              <input type="text" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., 2024-CF-001234" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
              <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction *</label>
            <input type="text" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Santa Clara County" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Court</label>
              <input type="text" value={court} onChange={(e) => setCourt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Superior Court" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Judge</label>
              <input type="text" value={judge} onChange={(e) => setJudge(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Hon. Wilson" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
