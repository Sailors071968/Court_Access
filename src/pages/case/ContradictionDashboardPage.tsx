// ============================================================================
// Phase 9 — Contradiction Investigation Dashboard
// Route: /cases/:caseId/contradictions
// Displays timeline viewer, contradiction list, evidence comparison,
// doctrine matches, and litigation recommendations.
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  FileSearch,
  GitBranch,
  Scale,
  Shield,
  ChevronDown,
  ChevronRight,
  Activity,
  Eye,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import {
  analyzeContradictions,
  fetchTimelineEvents,
  type ApiContradiction,
  type ApiTimelineEvent,
  type ApiDoctrineMatch,
  type ApiRecommendation,
} from '../../services/caseApi';

// ---------------------------------------------------------------------------
// Types (kept for display compatibility — real data comes from API)
// ---------------------------------------------------------------------------

type ContradictionSummary = ApiContradiction;

type TimelineEventDisplay = ApiTimelineEvent;

interface RecommendationDisplay {
  recommendationId: string;
  type: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
}

type DoctrineMatchDisplay = ApiDoctrineMatch;

// ---------------------------------------------------------------------------
// No mock data — all data fetched from real backend APIs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let color = 'bg-gray-100 text-gray-700';
  if (pct >= 80) color = 'bg-red-100 text-red-700';
  else if (pct >= 60) color = 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {pct}% confidence
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[priority] || styles.low}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    significant: 'bg-orange-500 text-white',
    moderate: 'bg-yellow-500 text-white',
    minor: 'bg-gray-400 text-white',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[severity] || styles.minor}`}>
      {severity}
    </span>
  );
}

function ContradictionTypeBadge({ type }: { type: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    narrative_inconsistency: { label: 'Narrative', color: 'bg-purple-100 text-purple-700' },
    timeline_conflict: { label: 'Timeline', color: 'bg-blue-100 text-blue-700' },
    missing_bodycam_activation: { label: 'Missing BWC', color: 'bg-red-100 text-red-700' },
    dispatch_report_inconsistency: { label: 'Dispatch', color: 'bg-indigo-100 text-indigo-700' },
    witness_conflict: { label: 'Witness', color: 'bg-teal-100 text-teal-700' },
    consent_dispute: { label: 'Consent', color: 'bg-orange-100 text-orange-700' },
    search_authority_gap: { label: 'Search Auth', color: 'bg-red-100 text-red-700' },
    chain_of_custody_gap: { label: 'Chain of Custody', color: 'bg-amber-100 text-amber-700' },
    evidence_appearance_disappearance: { label: 'Evidence', color: 'bg-pink-100 text-pink-700' },
    action_sequence_conflict: { label: 'Sequence', color: 'bg-sky-100 text-sky-700' },
    force_justification_gap: { label: 'Force', color: 'bg-red-100 text-red-800' },
    missing_miranda: { label: 'Miranda', color: 'bg-violet-100 text-violet-700' },
    location_inconsistency: { label: 'Location', color: 'bg-emerald-100 text-emerald-700' },
    identity_inconsistency: { label: 'Identity', color: 'bg-cyan-100 text-cyan-700' },
    count_discrepancy: { label: 'Count', color: 'bg-lime-100 text-lime-700' },
  };

  const entry = labels[type] ?? { label: type.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.color}`}>
      {entry.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab Definitions
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'timeline' | 'contradictions' | 'doctrine' | 'recommendations';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Activity size={16} /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
  { id: 'contradictions', label: 'Contradictions', icon: <AlertTriangle size={16} /> },
  { id: 'doctrine', label: 'Doctrine Matches', icon: <Shield size={16} /> },
  { id: 'recommendations', label: 'Recommendations', icon: <Scale size={16} /> },
];

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function ContradictionDashboardPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedContradiction, setExpandedContradiction] = useState<string | null>(null);

  // Real API state
  const [contradictions, setContradictions] = useState<ContradictionSummary[]>([]);
  const [timeline, setTimeline] = useState<TimelineEventDisplay[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationDisplay[]>([]);
  const [doctrineMatches, setDoctrineMatches] = useState<DoctrineMatchDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadData = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);
      const [timelineData, analysisData] = await Promise.allSettled([
        fetchTimelineEvents(caseId),
        analyzeContradictions(caseId),
      ]);

      if (timelineData.status === 'fulfilled') {
        setTimeline(timelineData.value ?? []);
      }

      if (analysisData.status === 'fulfilled') {
        const analysis = analysisData.value;
        setContradictions(analysis.analysis?.contradictions ?? []);
        setRecommendations(analysis.litigationSummary?.recommendations ?? []);
        const allDoctrineMatches = (analysis.doctrineMatching?.results ?? [])
          .flatMap((r) => r.doctrineMatches ?? []);
        setDoctrineMatches(allDoctrineMatches);
      }

      // If both failed, show error
      if (timelineData.status === 'rejected' && analysisData.status === 'rejected') {
        setError('Failed to load contradiction data. Upload evidence and process the case first.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const handleRunAnalysis = async () => {
    if (!caseId) return;
    try {
      setAnalyzing(true);
      const analysis = await analyzeContradictions(caseId);
      setContradictions(analysis.analysis?.contradictions ?? []);
      setRecommendations(analysis.litigationSummary?.recommendations ?? []);
      const allDoctrineMatches = (analysis.doctrineMatching?.results ?? [])
        .flatMap((r) => r.doctrineMatches ?? []);
      setDoctrineMatches(allDoctrineMatches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const criticalCount = contradictions.filter((c) => c.confidence >= 0.80).length;
  const significantCount = contradictions.filter((c) => c.confidence >= 0.60 && c.confidence < 0.80).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch size={20} className="text-blue-600" />
            Contradiction Detection Engine
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Cross-source evidentiary analysis — All findings require human review
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            CDE Active
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading contradiction analysis...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-8 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-amber-700 text-sm">{error}</p>
          <button onClick={loadData} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{contradictions.length}</p>
              <p className="text-xs text-gray-500">Potential Inconsistencies</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{timeline.length}</p>
              <p className="text-xs text-gray-500">Timeline Events</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{doctrineMatches.length}</p>
              <p className="text-xs text-gray-500">Doctrine Matches</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Scale size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{recommendations.length}</p>
              <p className="text-xs text-gray-500">Recommendations</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Confidence Distribution */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Analysis Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-700">{criticalCount}</p>
                <p className="text-xs text-red-600 mt-1">High Confidence (&ge;80%)</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-3xl font-bold text-amber-700">{significantCount}</p>
                <p className="text-xs text-amber-600 mt-1">Medium Confidence (60-79%)</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-700">
                  {contradictions.length - criticalCount - significantCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">Low Confidence (&lt;60%)</p>
              </div>
            </div>
          </Card>

          {/* Top Contradictions */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Potential Inconsistencies</h3>
            <div className="space-y-3">
              {contradictions.slice(0, 3).map((c) => (
                <div key={c.contradictionId} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ContradictionTypeBadge type={c.contradictionType} />
                      <ConfidenceBadge confidence={c.confidence} />
                    </div>
                    <p className="text-sm text-gray-700">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Recommendations */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Priority Recommendations</h3>
            <div className="space-y-3">
              {recommendations.filter((r) => r.priority === 'critical' || r.priority === 'high').map((r) => (
                <div key={r.recommendationId} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Scale size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <p className="text-sm font-medium text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'timeline' && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            <Clock size={16} className="inline mr-2" />
            Unified Evidence Timeline
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-0">
              {timeline.map((te) => {
                // Check if this event has a contradiction
                const hasContradiction = contradictions.some(
                  (c) =>
                    c.timeRangeStart === te.canonicalTimestamp ||
                    c.timeRangeEnd === te.canonicalTimestamp,
                );

                return (
                  <div key={te.eventId} className="relative flex items-start gap-4 py-3">
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ml-[18px] ${
                      hasContradiction ? 'bg-red-500 ring-2 ring-red-200' : 'bg-blue-500'
                    }`} />

                    {/* Event content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">{te.canonicalTimestamp}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          te.timestampSource === 'cad_dispatch'
                            ? 'bg-green-100 text-green-700'
                            : te.timestampSource === 'bodycam_overlay'
                              ? 'bg-blue-100 text-blue-700'
                              : te.timestampSource === 'video_transcript'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}>
                          {te.timestampSource.replace(/_/g, ' ')}
                        </span>
                        {hasContradiction && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 font-medium">
                            <AlertTriangle size={10} className="mr-1" />
                            Flagged
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 mt-1">
                        {te.eventType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                      </p>
                    </div>

                    <ConfidenceBadge confidence={te.confidence} />
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'contradictions' && (
        <div className="space-y-4">
          {contradictions.map((c) => (
            <Card key={c.contradictionId}>
              <button
                onClick={() => setExpandedContradiction(
                  expandedContradiction === c.contradictionId ? null : c.contradictionId,
                )}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {expandedContradiction === c.contradictionId ? (
                      <ChevronDown size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ContradictionTypeBadge type={c.contradictionType} />
                        <ConfidenceBadge confidence={c.confidence} />
                        {c.timeRangeStart && (
                          <span className="text-xs text-gray-400 font-mono">{c.timeRangeStart}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{c.description}</p>
                    </div>
                  </div>
                </div>
              </button>

              {expandedContradiction === c.contradictionId && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Evidence Sources</h4>
                      <div className="space-y-1">
                        {c.sourceEvidenceIds.map((eid) => (
                          <div key={eid} className="flex items-center gap-2 text-sm text-gray-600">
                            <FileSearch size={14} />
                            <span>{eid}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Time Range</h4>
                      <p className="text-sm text-gray-600 font-mono">
                        {c.timeRangeStart ?? 'N/A'} — {c.timeRangeEnd ?? 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Doctrine matches for this contradiction */}
                  {doctrineMatches.filter((d) => d.contradictionId === c.contradictionId).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Related Doctrine</h4>
                      <div className="space-y-2">
                        {doctrineMatches.filter((d) => d.contradictionId === c.contradictionId).map((d) => (
                          <div key={d.doctrineRuleId} className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                            <Shield size={14} className="text-purple-500" />
                            <span className="text-xs font-mono text-purple-700">{d.doctrineRuleId}</span>
                            <SeverityBadge severity={d.severity} />
                            <span className="text-xs text-gray-600">{d.matchDescription}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors">
                      <Eye size={12} />
                      View Evidence
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors">
                      <FileSearch size={12} />
                      Compare Sources
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'doctrine' && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            <Shield size={16} className="inline mr-2" />
            Doctrine Rule Matches
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Doctrine Rule</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Severity</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Description</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Linked Inconsistency</th>
                </tr>
              </thead>
              <tbody>
                {doctrineMatches.map((d, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-blue-700 text-xs">{d.doctrineRuleId}</td>
                    <td className="py-3 px-4"><SeverityBadge severity={d.severity} /></td>
                    <td className="py-3 px-4 text-gray-700">{d.matchDescription}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs font-mono">{d.contradictionId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {recommendations.map((r) => (
            <Card key={r.recommendationId}>
              <div className="flex items-start gap-3">
                <Scale size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityBadge priority={r.priority} />
                    <ConfidenceBadge confidence={r.confidence} />
                    <span className="text-xs text-gray-400 uppercase">{r.type.replace(/_/g, ' ')}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">{r.title}</h4>
                  <p className="text-sm text-gray-600 mt-2">{r.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Guardrail Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>Notice:</strong> All findings are presented as potential inconsistencies requiring human review.
          The Contradiction Detection Engine does not make determinations of wrongdoing. All language uses
          neutral, investigative framing. Findings should be verified by qualified legal counsel before use
          in any legal proceeding.
        </p>
      </div>
    </div>
  );
}
