// ============================================================================
// Phase 282 — Litigation Intelligence Panel
// Displayed on Case Overview page. Shows recommendation categories.
// Phase 283 — Evidence Linking (each recommendation links to evidence)
// Phase 284 — Duplicate Detection (collapsed duplicates)
// Phase 285 — Confidence Scoring (score badges)
// Phase 286 — Attorney Feedback Loop (mark relevant/handled/not relevant)
// Phase 287 — Recommendation Export
// Phase 291.8 — Connected to real evidence processing pipeline
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Gavel, Send, Globe, Users,
  ChevronDown, ChevronRight, ExternalLink, Download,
  ThumbsUp, Check, X as XIcon, AlertTriangle, Info,
  Loader2, RefreshCw,
} from 'lucide-react';
import {
  fetchRecommendations,
  submitFeedback,
  invalidateCaseCache,
  type Recommendation,
  type RecommendationType,
  type FeedbackStatus,
  type RecommendationData,
} from '../../services/caseAnalysisService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<RecommendationType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  INVESTIGATION: { label: 'Investigative Opportunities', icon: <Search size={16} />, color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  MOTION: { label: 'Procedural Opportunities', icon: <Gavel size={16} />, color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  SUBPOENA: { label: 'Records to Obtain', icon: <Send size={16} />, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  PUBLIC_RECORD: { label: 'Public Records Requests', icon: <Globe size={16} />, color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  EXPERT: { label: 'Expert Consultations', icon: <Users size={16} />, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

function getConfidenceBadge(score: number): { label: string; color: string } {
  if (score >= 0.85) return { label: 'High', color: 'bg-green-100 text-green-700' };
  if (score >= 0.70) return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Low', color: 'bg-gray-100 text-gray-600' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LitigationIntelligencePanel() {
  const { caseId } = useParams<{ caseId: string }>();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    INVESTIGATION: true, MOTION: false, SUBPOENA: false, PUBLIC_RECORD: false, EXPERT: false,
  });
  const [recData, setRecData] = useState<RecommendationData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Phase 291.8: Fetch recommendations from pipeline
  useEffect(() => {
    let cancelled = false;
    async function loadRecommendations() {
      setLoading(true);
      try {
        const data = await fetchRecommendations(caseId ?? 'demo');
        if (!cancelled) {
          setRecData(data);
          setRecommendations(data.recommendations);
        }
      } catch (err) {
        console.error('[LitigationIntelligencePanel] Failed to load recommendations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRecommendations();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      invalidateCaseCache(caseId ?? 'demo');
      const data = await fetchRecommendations(caseId ?? 'demo');
      setRecData(data);
      setRecommendations(data.recommendations);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Phase 286: Attorney feedback (now persists via service)
  const setFeedback = (recId: string, status: FeedbackStatus) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, feedbackStatus: status } : r)),
    );
    if (status) {
      submitFeedback(caseId ?? 'demo', recId, status);
    }
  };

  // Phase 287: Export recommendations
  const exportRecommendations = (type: RecommendationType) => {
    const items = recommendations.filter((r) => r.type === type);
    const lines = items.map((r, i) =>
      `${i + 1}. ${r.suggestedOpportunity}\n   Evidence: ${r.evidenceSource}\n   Observation: ${r.observation}\n   Confidence: ${(r.confidenceScore * 100).toFixed(0)}%\n   Status: ${r.feedbackStatus || 'pending'}\n`,
    );
    const blob = new Blob([`${CATEGORY_CONFIG[type].label}\n${'='.repeat(40)}\n\n${lines.join('\n')}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type.toLowerCase()}_recommendations.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories: RecommendationType[] = ['INVESTIGATION', 'MOTION', 'SUBPOENA', 'PUBLIC_RECORD', 'EXPERT'];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-indigo-500 mr-2" />
        <span className="text-sm text-gray-500">Loading litigation recommendations from evidence pipeline...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Litigation Intelligence</h2>
            <p className="text-xs text-gray-500 mt-1">
              {recData?.cached ? 'Cached result' : 'Generated from evidence pipeline'} — {recData ? new Date(recData.generatedAt).toLocaleString() : 'auto-generated'}
              {recData?.duplicatesRemoved ? ` | ${recData.duplicatesRemoved} duplicates collapsed` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
              {recommendations.length} recommendations
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Disclaimer — Phase 290 legal protection */}
      <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <Info size={12} className="text-amber-600 flex-shrink-0" />
        <p className="text-[10px] text-amber-700">
          {recData?.disclaimer ?? 'CourtAccess provides analytical observations based on uploaded evidence. Attorneys must independently evaluate all legal strategies.'}
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const catRecs = recommendations.filter((r) => r.type === cat);
          const addressedCount = catRecs.filter((r) => r.feedbackStatus).length;

          return (
            <div key={cat}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={config.color}>{config.icon}</span>
                  <span className="font-semibold text-gray-900 text-sm">{config.label}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold">
                    {catRecs.length}
                  </span>
                  {addressedCount > 0 && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                      {addressedCount} addressed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); exportRecommendations(cat); }}
                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                    title="Export recommendations"
                  >
                    <Download size={14} />
                  </button>
                  {expandedCategories[cat] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Category Items */}
              {expandedCategories[cat] && (
                <div className="px-6 pb-4 space-y-3">
                  {catRecs.map((rec) => {
                    const confidence = getConfidenceBadge(rec.confidenceScore);
                    return (
                      <div key={rec.id} className={`p-4 rounded-lg border ${config.bgColor} ${rec.feedbackStatus === 'not_relevant' ? 'opacity-50' : ''}`}>
                        {/* Duplicate badge — Phase 284 */}
                        {rec.duplicateCount && rec.duplicateCount > 1 && (
                          <div className="flex items-center gap-1 mb-2">
                            <AlertTriangle size={10} className="text-amber-500" />
                            <span className="text-[10px] text-amber-600 font-medium">{rec.duplicateCount} similar recommendations collapsed</span>
                          </div>
                        )}

                        {/* Observation */}
                        <p className="text-sm text-gray-800 mb-2">
                          <span className="font-semibold">Observation:</span> {rec.observation}
                        </p>

                        {/* Suggested Opportunity */}
                        <p className="text-sm text-gray-900 font-medium mb-2">
                          <span className={config.color}>→</span> {rec.suggestedOpportunity}
                        </p>

                        {/* Evidence Links — Phase 283 + 291.3 citation linking */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {rec.evidenceLinks.map((link, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-600">
                              <ExternalLink size={8} />
                              {link.evidenceFileName}{link.timestamp ? ` — ${link.timestamp}` : ''}{link.documentParagraph ? ` — ${link.documentParagraph}` : ''}
                            </span>
                          ))}
                        </div>

                        {/* Footer: Confidence + Feedback */}
                        <div className="flex items-center justify-between">
                          {/* Phase 285: Confidence Score */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${confidence.color}`}>
                            Confidence: {confidence.label} ({(rec.confidenceScore * 100).toFixed(0)}%)
                          </span>

                          {/* Phase 286: Attorney Feedback */}
                          <div className="flex items-center gap-1.5">
                            {rec.feedbackStatus ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                rec.feedbackStatus === 'relevant' ? 'bg-green-100 text-green-700' :
                                rec.feedbackStatus === 'already_handled' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {rec.feedbackStatus === 'relevant' ? 'Relevant' :
                                 rec.feedbackStatus === 'already_handled' ? 'Already Handled' : 'Not Relevant'}
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => setFeedback(rec.id, 'relevant')}
                                  className="p-1 hover:bg-green-100 rounded text-gray-400 hover:text-green-600"
                                  title="Mark as relevant"
                                >
                                  <ThumbsUp size={12} />
                                </button>
                                <button
                                  onClick={() => setFeedback(rec.id, 'already_handled')}
                                  className="p-1 hover:bg-blue-100 rounded text-gray-400 hover:text-blue-600"
                                  title="Already handled"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setFeedback(rec.id, 'not_relevant')}
                                  className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                                  title="Not relevant"
                                >
                                  <XIcon size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
