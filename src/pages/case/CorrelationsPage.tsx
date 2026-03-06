// ============================================
// Court Access — Phase 53/56: Evidence Correlations Page
// View cross-evidence correlations, contradictions,
// timeline mismatches, and entity reference matches.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { GitCompare, AlertTriangle, CheckCircle, Clock, Search, Filter, RefreshCw, Loader2, XCircle, Link2, Info } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { apiFetch } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceRef {
  id: string;
  filename: string;
  evidenceType: string;
}

interface EvidenceCorrelation {
  id: string;
  caseId: string;
  sourceEvidenceId: string;
  relatedEvidenceId: string;
  correlationType: string;
  confidenceScore: number;
  description: string;
  sourceSnippet: string;
  relatedSnippet: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  sourceEvidence: EvidenceRef | null;
  relatedEvidence: EvidenceRef | null;
}

interface CorrelationSummary {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  avgConfidence: number;
}

const CORRELATION_TYPE_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  timeline_mismatch: {
    label: 'Timeline Mismatch',
    icon: Clock,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  statement_contradiction: {
    label: 'Statement Contradiction',
    icon: XCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  entity_reference_match: {
    label: 'Entity Reference Match',
    icon: Link2,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  event_confirmation: {
    label: 'Event Confirmation',
    icon: CheckCircle,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-500' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
};

// ---------------------------------------------------------------------------
// Summary Stats Bar
// ---------------------------------------------------------------------------

function SummaryBar({ summary }: { summary: CorrelationSummary | null }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="text-center py-3">
        <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
        <p className="text-xs text-gray-500 mt-0.5">Total Correlations</p>
      </Card>
      <Card className="text-center py-3">
        <p className="text-2xl font-bold text-amber-600">{summary.byType?.timeline_mismatch || 0}</p>
        <p className="text-xs text-gray-500 mt-0.5">Timeline Mismatches</p>
      </Card>
      <Card className="text-center py-3">
        <p className="text-2xl font-bold text-red-600">{summary.byType?.statement_contradiction || 0}</p>
        <p className="text-xs text-gray-500 mt-0.5">Contradictions</p>
      </Card>
      <Card className="text-center py-3">
        <p className="text-2xl font-bold text-green-600">{summary.byType?.event_confirmation || 0}</p>
        <p className="text-xs text-gray-500 mt-0.5">Confirmations</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Correlation Card
// ---------------------------------------------------------------------------

function CorrelationCard({
  correlation,
  onUpdateStatus,
}: {
  correlation: EvidenceCorrelation;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = CORRELATION_TYPE_CONFIG[correlation.correlationType] || {
    label: correlation.correlationType,
    icon: GitCompare,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  };
  const Icon = typeConfig.icon;
  const statusConfig = STATUS_CONFIG[correlation.status] || STATUS_CONFIG.active;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${typeConfig.bgColor} flex-shrink-0`}>
          <Icon size={16} className={typeConfig.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(correlation.confidenceScore * 100)}% confidence
            </span>
          </div>

          <p className="text-sm text-gray-900 leading-relaxed mb-1">
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mr-1">Possible correlation detected</span>
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-2">
            {correlation.description}
          </p>

          {/* Evidence links */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="font-medium">Source:</span>
              {correlation.sourceEvidence?.filename || correlation.sourceEvidenceId.substring(0, 8) + '...'}
            </span>
            <span className="text-gray-300">→</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">Related:</span>
              {correlation.relatedEvidence?.filename || correlation.relatedEvidenceId.substring(0, 8) + '...'}
            </span>
          </div>

          {/* Expanded snippets */}
          {expanded && (correlation.sourceSnippet || correlation.relatedSnippet) && (
            <div className="mt-3 space-y-2">
              {correlation.sourceSnippet && (
                <div className="p-2 bg-gray-50 rounded-lg border-l-2 border-blue-300">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Source Excerpt</p>
                  <p className="text-xs text-gray-700">{correlation.sourceSnippet}</p>
                </div>
              )}
              {correlation.relatedSnippet && (
                <div className="p-2 bg-gray-50 rounded-lg border-l-2 border-amber-300">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Related Excerpt</p>
                  <p className="text-xs text-gray-700">{correlation.relatedSnippet}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Toggle details"
          >
            {expanded ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>}
          </button>
          {correlation.status === 'active' && (
            <>
              <button
                onClick={() => onUpdateStatus(correlation.id, 'confirmed')}
                className="p-1 text-gray-400 hover:text-green-600 rounded"
                title="Confirm correlation"
              >
                <CheckCircle size={14} />
              </button>
              <button
                onClick={() => onUpdateStatus(correlation.id, 'dismissed')}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                title="Dismiss correlation"
              >
                <XCircle size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Correlations Page
// ---------------------------------------------------------------------------

export function CorrelationsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [correlations, setCorrelations] = useState<EvidenceCorrelation[]>([]);
  const [summary, setSummary] = useState<CorrelationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchCorrelations = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);

      const [corrRes, summaryRes] = await Promise.all([
        apiFetch(`/api/correlations/${caseId}?${params}`),
        apiFetch(`/api/correlations/${caseId}/summary`),
      ]);

      const corrData = await corrRes.json();
      const summaryData = await summaryRes.json();

      setCorrelations(corrData.correlations || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to fetch correlations:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, filterType, filterStatus]);

  useEffect(() => {
    fetchCorrelations();
  }, [fetchCorrelations]);

  const handleAnalyze = async () => {
    if (!caseId) return;
    setAnalyzing(true);
    try {
      await apiFetch(`/api/correlations/${caseId}/analyze`, { method: 'POST' });
      await fetchCorrelations();
    } catch (err) {
      console.error('Correlation analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateStatus = async (correlationId: string, status: string) => {
    if (!caseId) return;
    try {
      await apiFetch(`/api/correlations/${caseId}/${correlationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await fetchCorrelations();
    } catch (err) {
      console.error('Failed to update correlation:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GitCompare size={20} className="text-blue-600" />
            Evidence Correlations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cross-evidence comparison findings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCorrelations}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Phase 60: AI Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          This analysis is automated and intended for investigative assistance only. It does not constitute legal advice, definitive conclusions, or expert opinion. All findings should be independently verified by qualified professionals before use in legal proceedings.
        </p>
      </div>

      {/* Summary */}
      <SummaryBar summary={summary} />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter size={12} />
          Filters:
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="timeline_mismatch">Timeline Mismatch</option>
          <option value="statement_contradiction">Statement Contradiction</option>
          <option value="entity_reference_match">Entity Reference Match</option>
          <option value="event_confirmation">Event Confirmation</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="confirmed">Confirmed</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {/* Correlations List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="mx-auto mb-2 text-gray-400 animate-spin" />
          <p className="text-gray-400 text-sm">Loading correlations...</p>
        </div>
      ) : correlations.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <GitCompare size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No evidence correlations found.</p>
            <p className="text-gray-400 text-xs mt-1">
              Run correlation analysis to compare evidence across the case.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {correlations.map((c) => (
            <CorrelationCard
              key={c.id}
              correlation={c}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
