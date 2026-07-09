// ============================================
// Court Access — Cases List Page
// Wired to real backend API (Phase 4 — Product Completion)
// ============================================

import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { CaseStatusBadge } from '../components/common/StatusBadge';
import { fetchCases, deleteCase, type ApiCase } from '../services/caseApi';
import { CaseIntakeModal } from '../components/cases/CaseIntakeModal';

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
          <h1 className="text-2xl font-bold text-white">Cases</h1>
          <p className="text-sm text-slate-400 mt-1">{cases.length} total cases</p>
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light"
            aria-label="Search cases"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light"
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
          <Loader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-slate-400">Loading cases...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-600 mb-2">{error}</p>
          <button onClick={loadCases} className="text-sm text-gold-light hover:text-gold-bright font-medium">Retry</button>
        </div>
      )}

      {/* Cases Grid */}
      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((c) => (
            <Card key={c.caseId} hover padding="md" className="cursor-pointer" onClick={() => navigate(`/cases/${c.caseId}/overview`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{c.title}</h3>
                  <p className="text-sm text-slate-400">#{c.caseNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CaseStatusBadge status={c.status} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteCaseId(c.caseId); setDeleteCaseError(null); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete case"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <p><span className="font-medium">Jurisdiction:</span> {c.jurisdiction}</p>
                {c.judge && <p><span className="font-medium">Judge:</span> {c.judge}</p>}
                {c.nextHearing && <p><span className="font-medium">Next Hearing:</span> {c.nextHearing}</p>}
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-4 text-xs text-slate-400">
                <span>{c._count?.evidence ?? 0} evidence items</span>
                <span>{c.caseType}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && filteredCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">
            {cases.length === 0
              ? 'No cases yet. Click "New Case" to create your first case.'
              : 'No cases found matching your criteria.'}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white/5 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/15">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Case</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <p className="text-sm font-medium text-white">
                {cases.find((c) => c.caseId === confirmDeleteCaseId)?.title}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                #{cases.find((c) => c.caseId === confirmDeleteCaseId)?.caseNumber}
              </p>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              Are you sure you want to delete this case? All associated evidence, timeline events, and analysis data will be permanently removed.
            </p>

            {deleteCaseError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                {deleteCaseError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmDeleteCaseId(null); setDeleteCaseError(null); }}
                disabled={deletingCaseId === confirmDeleteCaseId}
                className="px-4 py-2 text-sm font-medium text-slate-200 bg-white/10 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
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

      {/* Case Intake */}
      {showCreateModal && (
        <CaseIntakeModal
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

