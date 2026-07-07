// ============================================================================
// Narrative Deconstruction Engine — Narrative Analysis Page
// Route: /cases/:caseId/narrative-analysis
// Displays claims extracted from police narratives, validation status,
// contradictions, and impeachment candidates.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Shield,
  Play,
  Filter,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Target,
  User,
  Crosshair,
} from 'lucide-react';
import type {
  ApiNarrativeClaim,
  ApiImpeachmentCandidate,
  ApiNarrativeContradiction,
} from '../../services/caseApi';
import {
  fetchNarrativeClaims,
  fetchNarrativeContradictions,
  fetchImpeachmentCandidates,
  analyzeNarrative,
} from '../../services/caseApi';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ValidationBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; bg: string; text: string; Icon: typeof CheckCircle }> = {
    supported: { label: 'Supported', bg: 'bg-green-100', text: 'text-green-800', Icon: CheckCircle },
    contradicted: { label: 'Contradicted', bg: 'bg-red-100', text: 'text-red-800', Icon: XCircle },
    unverified: { label: 'Unverified', bg: 'bg-yellow-100', text: 'text-yellow-800', Icon: HelpCircle },
    pending: { label: 'Pending', bg: 'bg-white/10', text: 'text-slate-300', Icon: HelpCircle },
  };
  const config = configs[status] || configs.pending;
  const { Icon } = config;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    high: { label: 'HIGH', bg: 'bg-red-600', text: 'text-white' },
    medium: { label: 'MEDIUM', bg: 'bg-amber-500', text: 'text-white' },
    low: { label: 'LOW', bg: 'bg-blue-500', text: 'text-white' },
  };
  const config = configs[severity] || configs.low;

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400">{pct}%</span>
    </div>
  );
}

function ClaimCard({ claim }: { claim: ApiNarrativeClaim }) {
  const [expanded, setExpanded] = useState(false);
  const validationStatus = claim.validation?.status || 'pending';

  const borderColor =
    validationStatus === 'contradicted'
      ? 'border-red-300'
      : validationStatus === 'supported'
        ? 'border-green-300'
        : 'border-white/10';

  return (
    <div className={`rounded-lg border-2 ${borderColor} bg-white/5 p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ValidationBadge status={validationStatus} />
            <ConfidenceBar confidence={claim.confidence} />
          </div>
          <p className="text-sm text-slate-100">{claim.claimText}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">Subject:</span> {claim.subject}
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Crosshair className="h-3.5 w-3.5" />
              <span className="font-medium">Action:</span> {claim.action}
            </div>
            {claim.object && (
              <div className="flex items-center gap-1.5 text-slate-300">
                <Target className="h-3.5 w-3.5" />
                <span className="font-medium">Object:</span> {claim.object}
              </div>
            )}
            {claim.target && (
              <div className="flex items-center gap-1.5 text-slate-300">
                <Target className="h-3.5 w-3.5" />
                <span className="font-medium">Target:</span> {claim.target}
              </div>
            )}
            {claim.timestampReference && (
              <div className="col-span-2 flex items-center gap-1.5 text-slate-300">
                <span className="font-medium">Time Ref:</span> {claim.timestampReference}
              </div>
            )}
          </div>

          {claim.normalizedEvent && (
            <div className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span className="font-medium">Normalized:</span> {claim.normalizedEvent.eventType} — {claim.normalizedEvent.actor} {claim.normalizedEvent.actionNorm}
              {claim.normalizedEvent.object ? ` → ${claim.normalizedEvent.object}` : ''}
            </div>
          )}

          {claim.validation?.reasoning && (
            <div className="rounded bg-white/5 px-3 py-2 text-xs text-slate-300">
              <span className="font-medium">Analysis:</span> {claim.validation.reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImpeachmentCard({ candidate }: { candidate: ApiImpeachmentCandidate }) {
  return (
    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <SeverityBadge severity={candidate.severity} />
        <span className="text-xs font-medium text-slate-400">{candidate.contradictionType}</span>
        <ConfidenceBar confidence={candidate.confidence} />
      </div>

      <div className="mb-3 space-y-2">
        <div>
          <p className="text-xs font-semibold text-slate-400">Police Claim</p>
          <p className="text-sm text-slate-100">{candidate.claimText}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400">Contradicting Evidence</p>
          <p className="text-sm text-red-700">{candidate.contradictingEvidence}</p>
        </div>
      </div>

      {candidate.suggestedQuestion && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Suggested Impeachment Question</span>
          </div>
          <p className="text-sm italic text-amber-800">&ldquo;{candidate.suggestedQuestion}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAnalyze, loading }: { onAnalyze: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 py-16 text-center">
      <FileText className="mb-4 h-12 w-12 text-slate-500" />
      <h3 className="mb-2 text-lg font-semibold text-slate-200">No Narrative Analysis Yet</h3>
      <p className="mb-6 max-w-md text-sm text-slate-400">
        Upload police reports, supplemental reports, or arrest affidavits, then run the Narrative
        Deconstruction Engine to automatically extract claims and test them against your evidence.
      </p>
      <button
        onClick={onAnalyze}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {loading ? 'Analyzing...' : 'Run Narrative Analysis'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NarrativeAnalysisPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [claims, setClaims] = useState<ApiNarrativeClaim[]>([]);
  const [contradictions, setContradictions] = useState<ApiNarrativeContradiction[]>([]);
  const [impeachmentCandidates, setImpeachmentCandidates] = useState<ApiImpeachmentCandidate[]>([]);
  const [severityCounts, setSeverityCounts] = useState({ high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'claims' | 'contradictions' | 'impeachment'>('claims');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);

    try {
      const [claimsRes, contradictionsRes, impeachmentRes] = await Promise.all([
        fetchNarrativeClaims(caseId).catch(() => ({ claims: [], total: 0 })),
        fetchNarrativeContradictions(caseId).catch(() => ({ contradictions: [], count: 0 })),
        fetchImpeachmentCandidates(caseId).catch(() => ({
          candidates: [],
          total: 0,
          severityCounts: { high: 0, medium: 0, low: 0 },
        })),
      ]);

      setClaims(claimsRes.claims);
      setContradictions(contradictionsRes.contradictions);
      setImpeachmentCandidates(impeachmentRes.candidates);
      setSeverityCounts(impeachmentRes.severityCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load narrative analysis');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAnalyze = async () => {
    if (!caseId) return;
    setAnalyzing(true);
    try {
      await analyzeNarrative(caseId);
      // Reload data after a brief delay
      setTimeout(() => {
        loadData();
        setAnalyzing(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setAnalyzing(false);
    }
  };

  // Filter claims by validation status
  const filteredClaims =
    statusFilter === 'all'
      ? claims
      : claims.filter((c) => (c.validation?.status || 'pending') === statusFilter);

  // Counts
  const supported = claims.filter((c) => c.validation?.status === 'supported').length;
  const contradicted = claims.filter((c) => c.validation?.status === 'contradicted').length;
  const unverified = claims.filter((c) => c.validation?.status === 'unverified').length;
  const pending = claims.filter((c) => !c.validation || c.validation.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={loadData} className="mt-3 text-sm font-medium text-red-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const hasClaims = claims.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Narrative Analysis</h2>
          <p className="text-sm text-slate-400">
            Deconstruct police narratives into testable claims and expose contradictions
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {!hasClaims ? (
        <EmptyState onAnalyze={handleAnalyze} loading={analyzing} />
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
              <p className="text-2xl font-bold text-white">{claims.length}</p>
              <p className="text-xs text-slate-400">Total Claims</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{supported}</p>
              <p className="text-xs text-green-600">Supported</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{contradicted}</p>
              <p className="text-xs text-red-600">Contradicted</p>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{unverified}</p>
              <p className="text-xs text-yellow-600">Unverified</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
              <p className="text-2xl font-bold text-slate-300">{pending}</p>
              <p className="text-xs text-slate-400">Pending</p>
            </div>
          </div>

          {/* Impeachment Alert */}
          {severityCounts.high > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
              <Shield className="h-6 w-6 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {severityCounts.high} High-Confidence Impeachment{severityCounts.high > 1 ? 's' : ''} Detected
                </p>
                <p className="text-xs text-red-600">
                  Evidence directly contradicts police claims. Review impeachment candidates below.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('impeachment')}
                className="ml-auto rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                View
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-white/10">
            <nav className="-mb-px flex gap-6">
              <button
                onClick={() => setActiveTab('claims')}
                className={`border-b-2 pb-3 text-sm font-medium ${
                  activeTab === 'claims'
                    ? 'border-blue-600 text-gold-light'
                    : 'border-transparent text-slate-400 hover:border-white/10 hover:text-slate-200'
                }`}
              >
                All Claims ({claims.length})
              </button>
              <button
                onClick={() => setActiveTab('contradictions')}
                className={`border-b-2 pb-3 text-sm font-medium ${
                  activeTab === 'contradictions'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-400 hover:border-white/10 hover:text-slate-200'
                }`}
              >
                Contradictions ({contradictions.length})
              </button>
              <button
                onClick={() => setActiveTab('impeachment')}
                className={`border-b-2 pb-3 text-sm font-medium ${
                  activeTab === 'impeachment'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-slate-400 hover:border-white/10 hover:text-slate-200'
                }`}
              >
                Impeachment ({impeachmentCandidates.length})
              </button>
            </nav>
          </div>

          {/* Claims Tab */}
          {activeTab === 'claims' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                </button>
                {statusFilter !== 'all' && (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="text-xs text-gold-light hover:underline"
                  >
                    Clear filter
                  </button>
                )}
                <span className="text-xs text-slate-500">
                  Showing {filteredClaims.length} of {claims.length} claims
                </span>
              </div>

              {showFilters && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-300">Filter by Status</p>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'supported', 'contradicted', 'unverified', 'pending'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          statusFilter === s
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Claim List */}
              <div className="space-y-3">
                {filteredClaims.map((claim) => (
                  <ClaimCard key={claim.claimId} claim={claim} />
                ))}
                {filteredClaims.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No claims match the current filter.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Contradictions Tab */}
          {activeTab === 'contradictions' && (
            <div className="space-y-4">
              {contradictions.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-400" />
                  <p className="text-sm font-medium text-slate-300">No contradictions detected</p>
                  <p className="text-xs text-slate-500">All verified claims are consistent with the evidence</p>
                </div>
              ) : (
                contradictions.map((c) => (
                  <div key={c.validationId} className="rounded-lg border-2 border-red-200 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-xs font-semibold text-red-700">CONTRADICTION</span>
                      <ConfidenceBar confidence={c.confidence} />
                    </div>
                    {c.claim && (
                      <div className="mb-2">
                        <p className="text-sm text-slate-100">{c.claim.claimText}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {c.claim.subject} — {c.claim.action}
                          {c.claim.object ? ` → ${c.claim.object}` : ''}
                        </p>
                      </div>
                    )}
                    {c.reasoning && (
                      <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{c.reasoning}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Impeachment Tab */}
          {activeTab === 'impeachment' && (
            <div className="space-y-4">
              {impeachmentCandidates.length === 0 ? (
                <div className="py-12 text-center">
                  <Shield className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                  <p className="text-sm font-medium text-slate-300">No impeachment candidates</p>
                  <p className="text-xs text-slate-500">
                    Run narrative analysis to discover impeachment opportunities
                  </p>
                </div>
              ) : (
                <>
                  {/* Severity Summary */}
                  <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
                    <span className="text-xs font-medium text-slate-400">By Severity:</span>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="h-2 w-2 rounded-full bg-red-600" />
                      High: {severityCounts.high}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Medium: {severityCounts.medium}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Low: {severityCounts.low}
                    </span>
                  </div>

                  {/* Impeachment Cards */}
                  <div className="space-y-4">
                    {impeachmentCandidates.map((candidate) => (
                      <ImpeachmentCard key={candidate.impeachmentId} candidate={candidate} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
