// ============================================
// Court Access — Defendant Dashboard
// Full client dashboard with Cases tab, evidence management,
// contradictions/suggestions with status tracking, and upload.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Calendar, Clock, CheckCircle, Scale, Loader2,
  Briefcase, Upload, Trash2, AlertTriangle, ChevronDown, ChevronUp,
  Shield, Search, XCircle, BookOpen, Lightbulb, Target,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import {
  fetchCases, fetchCaseEvidence, deleteEvidence, deleteCase, uploadEvidenceDirect,
  fetchContradictionRecommendations, fetchTimelineConflicts,
  type ApiCase, type ApiEvidence, type ApiRecommendation, type ApiTimelineConflict,
  EVIDENCE_TYPES,
} from '../../services/caseApi';

// ---------------------------------------------------------------------------
// Types for suggestion status tracking (persisted in localStorage)
// ---------------------------------------------------------------------------

type SuggestionStatus = 'not_completed' | 'completed' | 'not_relevant' | 'tasked';

interface SuggestionState {
  status: SuggestionStatus;
  updatedAt: string;
}

interface UnifiedSuggestion {
  id: string;
  type: 'contradiction' | 'inconsistency' | 'investigative_task' | 'legal_instrument';
  title: string;
  description: string;
  pageReferences: string;
  priority: number;
  confidence: number;
  sourceType: string;
}

type DashboardTab = 'dashboard' | 'cases';

// ---------------------------------------------------------------------------
// localStorage helpers for suggestion status
// ---------------------------------------------------------------------------

function getSuggestionStates(): Record<string, SuggestionState> {
  const stored = localStorage.getItem('courtaccess_suggestion_states');
  return stored ? JSON.parse(stored) : {};
}

function persistSuggestionState(id: string, status: SuggestionStatus): Record<string, SuggestionState> {
  const states = getSuggestionStates();
  states[id] = { status, updatedAt: new Date().toISOString() };
  localStorage.setItem('courtaccess_suggestion_states', JSON.stringify(states));
  return states;
}

function removeSuggestionState(id: string): Record<string, SuggestionState> {
  const states = getSuggestionStates();
  delete states[id];
  localStorage.setItem('courtaccess_suggestion_states', JSON.stringify(states));
  return states;
}

function getDeletedSuggestions(): Set<string> {
  const stored = localStorage.getItem('courtaccess_deleted_suggestions');
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

function addDeletedSuggestion(id: string): Set<string> {
  const deleted = getDeletedSuggestions();
  deleted.add(id);
  localStorage.setItem('courtaccess_deleted_suggestions', JSON.stringify([...deleted]));
  return deleted;
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
  1: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  2: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-100' },
  3: { label: 'Low', color: 'text-blue-700', bg: 'bg-blue-100' },
};

const STATUS_OPTIONS: { value: SuggestionStatus; label: string; icon: typeof CheckCircle; color: string }[] = [
  { value: 'not_completed', label: 'Not Completed', icon: Clock, color: 'text-gray-500' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-600' },
  { value: 'not_relevant', label: 'Not Relevant', icon: XCircle, color: 'text-gray-400' },
  { value: 'tasked', label: 'Already Tasked', icon: Target, color: 'text-blue-600' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DefendantDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ApiCase | null>(null);
  const [caseEvidence, setCaseEvidence] = useState<ApiEvidence[]>([]);
  const [caseLoading, setCaseLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<UnifiedSuggestion[]>([]);
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionState>>(getSuggestionStates);
  const [deletedSuggestions, setDeletedSuggestions] = useState<Set<string>>(getDeletedSuggestions);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCaseId, setUploadCaseId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('other_document');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteCaseId, setConfirmDeleteCaseId] = useState<string | null>(null);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [deleteCaseError, setDeleteCaseError] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState('');
  const loadIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const allCases = await fetchCases().catch(() => []);
        if (!cancelled) {
          setCases(allCases ?? []);
          if ((allCases ?? []).length > 0 && !uploadCaseId) {
            setUploadCaseId(allCases[0].caseId);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCaseDetail = useCallback(async (caseItem: ApiCase) => {
    const thisLoadId = ++loadIdRef.current;
    setSelectedCase(caseItem);
    setCaseLoading(true);
    setSuggestionsLoading(true);
    try {
      const evidence = await fetchCaseEvidence(caseItem.caseId).catch(() => []);
      if (loadIdRef.current !== thisLoadId) return;
      setCaseEvidence(evidence ?? []);
    } catch {
      if (loadIdRef.current !== thisLoadId) return;
      setCaseEvidence([]);
    } finally {
      if (loadIdRef.current === thisLoadId) setCaseLoading(false);
    }

    if (loadIdRef.current !== thisLoadId) return;

    try {
      const [recsResult, conflictsResult] = await Promise.all([
        fetchContradictionRecommendations(caseItem.caseId).catch(() => ({ recommendations: [] })),
        fetchTimelineConflicts(caseItem.caseId).catch(() => []),
      ]);

      if (loadIdRef.current !== thisLoadId) return;

      const unified: UnifiedSuggestion[] = [];
      const recs = recsResult.recommendations ?? [];
      recs.forEach((rec: ApiRecommendation, idx: number) => {
        const priorityMap: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const typeMap: Record<string, UnifiedSuggestion['type']> = {
          investigation: 'investigative_task',
          legal: 'legal_instrument',
          contradiction: 'contradiction',
        };
        unified.push({
          id: rec.recommendationId || `${caseItem.caseId}-rec-${idx}`,
          type: typeMap[rec.type] ?? 'legal_instrument',
          title: rec.title,
          description: rec.description,
          pageReferences: `See case evidence for supporting documentation. Confidence: ${Math.round(rec.confidence * 100)}%`,
          priority: priorityMap[rec.priority] ?? 2,
          confidence: rec.confidence,
          sourceType: rec.type,
        });
      });

      const conflicts = conflictsResult ?? [];
      conflicts.forEach((conflict: ApiTimelineConflict, idx: number) => {
        const severityMap: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        unified.push({
          id: conflict.conflictId || `${caseItem.caseId}-conflict-${idx}`,
          type: 'inconsistency',
          title: `Timeline ${conflict.type}: ${conflict.description.substring(0, 80)}`,
          description: conflict.description,
          pageReferences: `Involves ${conflict.eventIds.length} timeline event(s). Cross-reference with uploaded evidence documents.`,
          priority: severityMap[conflict.severity ?? 'medium'] ?? 2,
          confidence: 0.8,
          sourceType: conflict.type,
        });
      });

      unified.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
      setSuggestions(unified);
    } catch {
      if (loadIdRef.current === thisLoadId) setSuggestions([]);
    } finally {
      if (loadIdRef.current === thisLoadId) setSuggestionsLoading(false);
    }
  }, []);

  const handleDeleteCase = async (caseId: string) => {
    setDeletingCaseId(caseId);
    setDeleteCaseError(null);
    try {
      await deleteCase(caseId);
      setCases((prev) => {
        const remaining = prev.filter((c) => c.caseId !== caseId);
        if (uploadCaseId === caseId) {
          setUploadCaseId(remaining.length > 0 ? remaining[0].caseId : '');
        }
        return remaining;
      });
      setConfirmDeleteCaseId(null);
      if (selectedCase?.caseId === caseId) {
        setSelectedCase(null);
      }
    } catch (err) {
      setDeleteCaseError(err instanceof Error ? err.message : 'Failed to delete case');
    } finally {
      setDeletingCaseId(null);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    setDeletingEvidenceId(evidenceId);
    try {
      await deleteEvidence(evidenceId);
      setCaseEvidence((prev) => prev.filter((e) => e.evidenceId !== evidenceId));
      setConfirmDeleteId(null);
    } catch {
      // silently handle
    } finally {
      setDeletingEvidenceId(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadCaseId) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      await uploadEvidenceDirect({
        caseId: uploadCaseId,
        file: uploadFile,
        evidenceType: uploadType,
        onProgress: setUploadProgress,
      });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadProgress(0);
      if (selectedCase?.caseId === uploadCaseId) {
        const refreshed = await fetchCaseEvidence(uploadCaseId).catch(() => []);
        setCaseEvidence(refreshed ?? []);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSetSuggestionStatus = (id: string, status: SuggestionStatus) => {
    const updated = persistSuggestionState(id, status);
    setSuggestionStates({ ...updated });
  };

  const handleDeleteSuggestion = (id: string) => {
    const updated = addDeletedSuggestion(id);
    setDeletedSuggestions(new Set(updated));
    removeSuggestionState(id);
  };

  const visibleSuggestions = suggestions.filter((s) => !deletedSuggestions.has(s.id));

  const filteredCases = cases.filter((c) => {
    if (!caseSearch) return true;
    const q = caseSearch.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.caseNumber.toLowerCase().includes(q) ||
      c.jurisdiction.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Your case information, evidence, and defense analysis</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'dashboard'}
            onClick={() => { setActiveTab('dashboard'); setSelectedCase(null); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'cases'}
            onClick={() => { setActiveTab('cases'); setSelectedCase(null); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cases'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Cases ({cases.length})
          </button>
        </nav>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Briefcase size={28} className="text-blue-500" />} value={cases.length} label="Total Cases" />
            <StatCard icon={<FileText size={28} className="text-amber-600" />} value={cases.reduce((sum, c) => sum + (c._count?.evidence ?? 0), 0)} label="Total Evidence" />
            <StatCard icon={<Calendar size={28} className="text-green-500" />} value={cases.filter((c) => c.nextHearing).length} label="Upcoming Hearings" />
            <StatCard icon={<Scale size={28} className="text-purple-500" />} value={cases.filter((c) => c.status === 'active').length} label="Active Cases" />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upload Evidence</h2>
                <p className="text-sm text-gray-500 mt-1">Upload evidence files to any of your cases</p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={cases.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload size={16} />
                Upload Evidence
              </button>
            </div>
            {cases.length === 0 && (
              <p className="text-sm text-gray-400">No cases available. Your attorney will add your case shortly.</p>
            )}
          </Card>

          {cases.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Cases</h2>
              <div className="space-y-3">
                {cases.slice(0, 5).map((c) => (
                  <div
                    key={c.caseId}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => { setActiveTab('cases'); loadCaseDetail(c); }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-500">#{c.caseNumber} &middot; {c.jurisdiction}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {c.status}
                      </span>
                      {c.nextHearing && (
                        <p className="text-xs text-gray-400 mt-1">
                          <Calendar size={10} className="inline mr-1" />
                          {c.nextHearing}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {cases.length > 5 && (
                <button
                  onClick={() => setActiveTab('cases')}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all {cases.length} cases
                </button>
              )}
            </Card>
          )}

          {cases.some((c) => c.nextHearing) && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Court Hearings</h2>
              <div className="space-y-3">
                {cases
                  .filter((c) => c.nextHearing)
                  .sort((a, b) => (a.nextHearing ?? '').localeCompare(b.nextHearing ?? ''))
                  .map((c) => (
                    <div key={c.caseId} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
                        <Calendar size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.nextHearing}
                          {c.nextHearingNote && ` \u2014 ${c.nextHearingNote}`}
                        </p>
                        {c.court && <p className="text-xs text-gray-400 mt-0.5">{c.court}{c.department ? `, Dept. ${c.department}` : ''}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* CASES TAB - List */}
      {activeTab === 'cases' && !selectedCase && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Search cases by title, number, or jurisdiction..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {filteredCases.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Briefcase className="mx-auto mb-4 text-gray-300" size={48} />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {caseSearch ? 'No cases match your search' : 'No Cases Yet'}
                </h3>
                <p className="text-sm text-gray-500">
                  {caseSearch ? 'Try a different search term.' : 'Your attorney will add your case shortly.'}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCases.map((c) => (
                <Card key={c.caseId} hover onClick={() => loadCaseDetail(c)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{c.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">#{c.caseNumber}</span>
                          <span className="text-xs text-gray-400">&middot;</span>
                          <span className="text-xs text-gray-500">{c.jurisdiction}</span>
                          {c.court && (
                            <>
                              <span className="text-xs text-gray-400">&middot;</span>
                              <span className="text-xs text-gray-500">{c.court}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          c.status === 'active' ? 'bg-green-100 text-green-700' :
                          c.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {c.status}
                        </span>
                        {c.nextHearing && (
                          <p className="text-xs text-gray-500 mt-1.5 flex items-center justify-end gap-1">
                            <Calendar size={10} />
                            Next: {c.nextHearing}
                          </p>
                        )}
                        {c._count?.evidence !== undefined && (
                          <p className="text-xs text-gray-400 mt-0.5">{c._count.evidence} evidence items</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteCaseId(c.caseId); setDeleteCaseError(null); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete case"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* CASE DETAIL VIEW */}
      {activeTab === 'cases' && selectedCase && (
        <>
          <button
            onClick={() => setSelectedCase(null)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
          >
            &larr; Back to Cases
          </button>

          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCase.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Case #{selectedCase.caseNumber} &middot; {selectedCase.jurisdiction}
                  {selectedCase.court ? ` &middot; ${selectedCase.court}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                  selectedCase.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {selectedCase.status}
                </span>
                <button
                  onClick={() => { setConfirmDeleteCaseId(selectedCase.caseId); setDeleteCaseError(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Case Number</span>
                <p className="font-medium text-gray-900 mt-1">#{selectedCase.caseNumber}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Case Type</span>
                <p className="font-medium text-gray-900 mt-1 capitalize">{selectedCase.caseType}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Jurisdiction</span>
                <p className="font-medium text-gray-900 mt-1">{selectedCase.jurisdiction}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Court</span>
                <p className="font-medium text-gray-900 mt-1">{selectedCase.court || 'TBD'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Judge</span>
                <p className="font-medium text-gray-900 mt-1">{selectedCase.judge || 'TBD'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Department</span>
                <p className="font-medium text-gray-900 mt-1">{selectedCase.department || 'TBD'}</p>
              </div>
            </div>

            {selectedCase.nextHearing && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                <Calendar size={20} className="text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Next Court Hearing: {selectedCase.nextHearing}</p>
                  {selectedCase.nextHearingNote && (
                    <p className="text-xs text-amber-600 mt-0.5">{selectedCase.nextHearingNote}</p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Evidence Section */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Uploaded Evidence ({caseEvidence.length})
              </h2>
              <button
                onClick={() => { setUploadCaseId(selectedCase.caseId); setShowUploadModal(true); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                <Upload size={14} />
                Upload
              </button>
            </div>

            {caseLoading ? (
              <div className="text-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading evidence...</p>
              </div>
            ) : caseEvidence.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto mb-3 text-gray-300" size={36} />
                <p className="text-sm text-gray-500">No evidence uploaded yet for this case.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-gray-500 font-medium">File Name</th>
                      <th className="text-left py-3 px-2 text-gray-500 font-medium">Type</th>
                      <th className="text-left py-3 px-2 text-gray-500 font-medium">Uploaded</th>
                      <th className="text-left py-3 px-2 text-gray-500 font-medium">Size</th>
                      <th className="text-left py-3 px-2 text-gray-500 font-medium">Status</th>
                      <th className="text-right py-3 px-2 text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseEvidence.map((ev) => (
                      <tr key={ev.evidenceId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-500 flex-shrink-0" />
                            <span className="font-medium text-gray-900 truncate max-w-[200px]">{ev.fileName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-gray-500 capitalize">{ev.evidenceType.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-2 text-gray-500">{new Date(ev.uploadedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-2 text-gray-500">{formatFileSize(Number(ev.size))}</td>
                        <td className="py-3 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ev.processingStatus === 'analyzed' ? 'bg-green-100 text-green-700' :
                            ev.processingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                            ev.processingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {ev.processingStatus}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {confirmDeleteId === ev.evidenceId ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-red-600">Delete?</span>
                              <button
                                onClick={() => handleDeleteEvidence(ev.evidenceId)}
                                disabled={deletingEvidenceId === ev.evidenceId}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingEvidenceId === ev.evidenceId ? 'Deleting...' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(ev.evidenceId)}
                              className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                              title="Delete evidence"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Defense Analysis & Suggestions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Defense Analysis &amp; Suggestions ({visibleSuggestions.length})
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Contradictions, inconsistencies, investigative tasks, and legal instrument suggestions &mdash; ordered by defensive value
                </p>
              </div>
            </div>

            {suggestionsLoading ? (
              <div className="text-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading defense analysis...</p>
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="mx-auto mb-3 text-gray-300" size={36} />
                <p className="text-sm text-gray-500">
                  No suggestions available yet. Upload evidence and process the case to generate defense analysis.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSuggestions.map((suggestion) => {
                  const priorityCfg = PRIORITY_CONFIG[suggestion.priority] ?? PRIORITY_CONFIG[2];
                  const currentStatus = suggestionStates[suggestion.id]?.status ?? 'not_completed';
                  const isExpanded = expandedSuggestion === suggestion.id;
                  const TypeIcon = suggestion.type === 'contradiction' ? AlertTriangle :
                    suggestion.type === 'inconsistency' ? Clock :
                    suggestion.type === 'investigative_task' ? Search :
                    Lightbulb;

                  return (
                    <div
                      key={suggestion.id}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        currentStatus === 'completed' ? 'border-green-200 bg-green-50/30' :
                        currentStatus === 'not_relevant' ? 'border-gray-200 bg-gray-50/50 opacity-60' :
                        currentStatus === 'tasked' ? 'border-blue-200 bg-blue-50/30' :
                        'border-gray-200'
                      }`}
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                        onClick={() => setExpandedSuggestion(isExpanded ? null : suggestion.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${priorityCfg.bg} ${priorityCfg.color}`}>
                            {priorityCfg.label}
                          </div>
                          <TypeIcon size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-gray-800 truncate">{suggestion.title}</h3>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded capitalize flex-shrink-0">
                                {suggestion.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {!isExpanded && (
                              <p className="text-sm text-gray-600 line-clamp-2">{suggestion.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              currentStatus === 'completed' ? 'bg-green-100 text-green-700' :
                              currentStatus === 'tasked' ? 'bg-blue-100 text-blue-700' :
                              currentStatus === 'not_relevant' ? 'bg-gray-100 text-gray-500' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label ?? 'Not Completed'}
                            </span>
                            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-200 p-4 bg-white space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Detailed Explanation</h4>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{suggestion.description}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                              <BookOpen size={12} />
                              Page References &amp; Source
                            </h4>
                            <p className="text-sm text-gray-600">{suggestion.pageReferences}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Confidence: {Math.round(suggestion.confidence * 100)}%</span>
                            <span>Source: {suggestion.sourceType}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-500 mr-2">Set status:</span>
                            {STATUS_OPTIONS.map((opt) => {
                              const Icon = opt.icon;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => handleSetSuggestionStatus(suggestion.id, opt.value)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    currentStatus === opt.value
                                      ? 'bg-slate-800 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  <Icon size={12} />
                                  {opt.label}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => handleDeleteSuggestion(suggestion.id)}
                              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                These suggestions are generated by AI analysis of your case evidence. They do not constitute legal advice.
                Page references are provided for manual verification. Please consult your attorney for guidance.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* UPLOAD MODAL */}
      {/* Case Delete Confirmation Modal */}
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

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Evidence</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadError(null); setUploadFile(null); }} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="upload-case-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Case
              </label>
              <select
                id="upload-case-select"
                value={uploadCaseId}
                onChange={(e) => setUploadCaseId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a case...</option>
                {cases.map((c) => (
                  <option key={c.caseId} value={c.caseId}>
                    {c.title} (#{c.caseNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="upload-type" className="block text-sm font-medium text-gray-700 mb-1">
                Evidence Type
              </label>
              <select
                id="upload-type"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="evidence-file-input"
                />
                <label htmlFor="evidence-file-input" className="cursor-pointer">
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      <span className="text-sm text-gray-700">{uploadFile.name}</span>
                      <span className="text-xs text-gray-400">({formatFileSize(uploadFile.size)})</span>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Click to select a file</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">{uploadProgress}% uploaded</p>
              </div>
            )}

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {uploadError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null); setUploadFile(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadCaseId || uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Uploading...' : 'Upload Evidence'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
