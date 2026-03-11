// ============================================================================
// Phase 282 — Litigation Intelligence Panel
// Displayed on Case Overview page. Shows recommendation categories.
// Phase 283 — Evidence Linking (each recommendation links to evidence)
// Phase 284 — Duplicate Detection (collapsed duplicates)
// Phase 285 — Confidence Scoring (score badges)
// Phase 286 — Attorney Feedback Loop (mark relevant/handled/not relevant)
// Phase 287 — Recommendation Export
// ============================================================================

import { useState } from 'react';
import {
  Search, FileText, Gavel, Send, Globe, Users,
  ChevronDown, ChevronRight, ExternalLink, Download,
  ThumbsUp, Check, X as XIcon, AlertTriangle, Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecommendationType = 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';
type FeedbackStatus = 'relevant' | 'already_handled' | 'not_relevant' | null;

interface EvidenceLink {
  fileName: string;
  timestamp?: string;
  paragraph?: string;
}

interface Recommendation {
  id: string;
  type: RecommendationType;
  observation: string;
  suggestedOpportunity: string;
  evidenceSource: string;
  evidenceLinks: EvidenceLink[];
  confidenceScore: number;
  feedbackStatus: FeedbackStatus;
  duplicateCount?: number;
}

// ---------------------------------------------------------------------------
// Mock Data (Phases 276-280 output simulation)
// ---------------------------------------------------------------------------

const MOCK_RECOMMENDATIONS: Recommendation[] = [
  // Investigative Opportunities
  {
    id: 'inv-1', type: 'INVESTIGATION',
    observation: 'Body camera footage indicates the officer states the suspect discarded an object prior to arrest.',
    suggestedOpportunity: 'Search for evidence logs or photographs documenting the recovered object.',
    evidenceSource: 'Bodycam Video #3 — 00:02:14',
    evidenceLinks: [
      { fileName: 'Bodycam Video #3', timestamp: '00:02:14' },
      { fileName: 'Officer Report', paragraph: 'Paragraph 9' },
    ],
    confidenceScore: 0.85, feedbackStatus: null,
  },
  {
    id: 'inv-2', type: 'INVESTIGATION',
    observation: 'Dispatch log references additional witnesses not yet interviewed.',
    suggestedOpportunity: 'Identify and interview additional witnesses referenced in dispatch communications.',
    evidenceSource: 'Dispatch Log — 14:35:15',
    evidenceLinks: [
      { fileName: 'Dispatch Log', timestamp: '14:35:15' },
    ],
    confidenceScore: 0.80, feedbackStatus: null,
  },
  {
    id: 'inv-3', type: 'INVESTIGATION',
    observation: 'Incident occurred at intersection with traffic cameras.',
    suggestedOpportunity: 'Obtain and review available surveillance recordings from the intersection.',
    evidenceSource: 'Scene Photos — Photo Set A',
    evidenceLinks: [
      { fileName: 'Scene Photos', paragraph: 'Photo Set A' },
    ],
    confidenceScore: 0.90, feedbackStatus: null,
  },

  // Procedural Opportunities (Motions)
  {
    id: 'mot-1', type: 'MOTION',
    observation: 'Vehicle search occurred prior to documented probable cause statement.',
    suggestedOpportunity: 'Review for potential suppression motion regarding search legality.',
    evidenceSource: 'Officer Report — Page 3',
    evidenceLinks: [
      { fileName: 'Officer Report', paragraph: 'Page 3, Paragraph 2' },
      { fileName: 'Bodycam Video #1', timestamp: '00:04:22' },
    ],
    confidenceScore: 0.85, feedbackStatus: null,
  },
  {
    id: 'mot-2', type: 'MOTION',
    observation: 'Evidence log references video footage not included in discovery.',
    suggestedOpportunity: 'Request disclosure of referenced evidence (potential Brady material).',
    evidenceSource: 'Evidence Log — Entry #14',
    evidenceLinks: [
      { fileName: 'Evidence Log', paragraph: 'Entry #14' },
    ],
    confidenceScore: 0.90, feedbackStatus: null,
  },
  {
    id: 'mot-3', type: 'MOTION',
    observation: 'Officer has multiple use-of-force events referenced across cases.',
    suggestedOpportunity: 'Consider officer personnel record discovery review (Pitchess motion).',
    evidenceSource: 'Cross-Case Analysis',
    evidenceLinks: [
      { fileName: 'Use of Force Report #1' },
      { fileName: 'Use of Force Report #2' },
      { fileName: 'Internal Affairs Summary' },
    ],
    confidenceScore: 0.75, feedbackStatus: null,
  },

  // Records to Obtain (Subpoenas)
  {
    id: 'sub-1', type: 'SUBPOENA',
    observation: 'Officer radio traffic references additional dispatch communications not present in the evidence file.',
    suggestedOpportunity: 'Obtain full dispatch log and CAD records.',
    evidenceSource: 'Radio Traffic Log',
    evidenceLinks: [
      { fileName: 'Radio Traffic Log', timestamp: '14:28:00' },
    ],
    confidenceScore: 0.90, feedbackStatus: null, duplicateCount: 3,
  },
  {
    id: 'sub-2', type: 'SUBPOENA',
    observation: 'Incident occurred in commercial district with multiple nearby businesses.',
    suggestedOpportunity: 'Obtain nearby surveillance camera recordings.',
    evidenceSource: 'Scene Photos — Photo Set B',
    evidenceLinks: [
      { fileName: 'Scene Photos', paragraph: 'Photo Set B' },
    ],
    confidenceScore: 0.80, feedbackStatus: null,
  },

  // Public Records
  {
    id: 'pub-1', type: 'PUBLIC_RECORD',
    observation: 'Officer used specific restraint technique during arrest.',
    suggestedOpportunity: 'Request training records for the restraint technique used.',
    evidenceSource: 'Bodycam Video #1 — 00:05:30',
    evidenceLinks: [
      { fileName: 'Bodycam Video #1', timestamp: '00:05:30' },
    ],
    confidenceScore: 0.85, feedbackStatus: null,
  },
  {
    id: 'pub-2', type: 'PUBLIC_RECORD',
    observation: 'Department policy referenced but not included in evidence.',
    suggestedOpportunity: 'Request updated agency policy manuals effective on the incident date.',
    evidenceSource: 'Officer Report — Page 5',
    evidenceLinks: [
      { fileName: 'Officer Report', paragraph: 'Page 5' },
    ],
    confidenceScore: 0.90, feedbackStatus: null,
  },

  // Expert Consultations
  {
    id: 'exp-1', type: 'EXPERT',
    observation: 'Use-of-force incident detected in timeline with potential excessive force indicators.',
    suggestedOpportunity: 'Consult police practices / use-of-force expert.',
    evidenceSource: 'Bodycam Video #1 — 00:05:30',
    evidenceLinks: [
      { fileName: 'Bodycam Video #1', timestamp: '00:05:30' },
      { fileName: 'Use of Force Report' },
    ],
    confidenceScore: 0.90, feedbackStatus: null,
  },
  {
    id: 'exp-2', type: 'EXPERT',
    observation: 'Low-quality surveillance footage from nearby business.',
    suggestedOpportunity: 'Consult video forensic analyst for enhancement and analysis.',
    evidenceSource: 'Surveillance Video — Store #4',
    evidenceLinks: [
      { fileName: 'Surveillance Video — Store #4' },
    ],
    confidenceScore: 0.82, feedbackStatus: null,
  },
];

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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    INVESTIGATION: true, MOTION: false, SUBPOENA: false, PUBLIC_RECORD: false, EXPERT: false,
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>(MOCK_RECOMMENDATIONS);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Phase 286: Attorney feedback
  const setFeedback = (recId: string, status: FeedbackStatus) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, feedbackStatus: status } : r)),
    );
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Litigation Intelligence</h2>
            <p className="text-xs text-gray-500 mt-1">Evidence-driven recommendations — auto-generated from uploaded evidence</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
              {recommendations.length} recommendations
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer — Phase 290 legal protection */}
      <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <Info size={12} className="text-amber-600 flex-shrink-0" />
        <p className="text-[10px] text-amber-700">
          CourtAccess provides analytical observations based on uploaded evidence. Attorneys must independently evaluate all legal strategies.
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

                        {/* Evidence Links — Phase 283 */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {rec.evidenceLinks.map((link, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-600">
                              <ExternalLink size={8} />
                              {link.fileName}{link.timestamp ? ` — ${link.timestamp}` : ''}{link.paragraph ? ` — ${link.paragraph}` : ''}
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
