// ============================================================================
// Phase 288 — Trial Strategy View
// Phase 289 — Case Readiness Score
// Phase 290 — Litigation Roadmap
// Route: /cases/:caseId/litigation-strategy
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Target, BarChart3, CheckCircle, Clock, AlertTriangle,
  Search, Gavel, Send, Globe, Users, ChevronDown, ChevronRight,
  Info, TrendingUp, Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecommendationType = 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';
type RoadmapStatus = 'pending' | 'in_progress' | 'completed';

interface StrategyObservation {
  id: string;
  evidenceSource: string;
  observation: string;
  timestamp: string;
}

interface StrategyRecommendation {
  id: string;
  type: RecommendationType;
  suggestedOpportunity: string;
  evidenceSource: string;
  confidenceScore: number;
  status: 'pending' | 'addressed' | 'dismissed';
}

interface ReadinessMetric {
  label: string;
  score: number;
  maxScore: number;
  icon: React.ReactNode;
}

interface RoadmapStep {
  stepNumber: number;
  description: string;
  category: RecommendationType;
  status: RoadmapStatus;
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<RecommendationType, React.ReactNode> = {
  INVESTIGATION: <Search size={14} />,
  MOTION: <Gavel size={14} />,
  SUBPOENA: <Send size={14} />,
  PUBLIC_RECORD: <Globe size={14} />,
  EXPERT: <Users size={14} />,
};

const TYPE_COLORS: Record<RecommendationType, string> = {
  INVESTIGATION: 'bg-blue-100 text-blue-700',
  MOTION: 'bg-purple-100 text-purple-700',
  SUBPOENA: 'bg-amber-100 text-amber-700',
  PUBLIC_RECORD: 'bg-emerald-100 text-emerald-700',
  EXPERT: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<RoadmapStatus, string> = {
  completed: 'bg-green-500',
  in_progress: 'bg-blue-500',
  pending: 'bg-gray-300',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LitigationStrategyView() {
  const { caseId } = useParams<{ caseId: string }>();
  const [expandedSection, setExpandedSection] = useState<string | null>('roadmap');
  const [isLoading, setIsLoading] = useState(true);
  const [observations, setObservations] = useState<StrategyObservation[]>([]);
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [readiness, setReadiness] = useState<ReadinessMetric[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapStep[]>([]);

  useEffect(() => {
    async function fetchStrategy() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/litigation-strategy`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('court-access-token') ?? ''}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.observations) setObservations(json.observations);
          if (json.recommendations) setRecommendations(json.recommendations);
          if (json.readiness) setReadiness(json.readiness);
          if (json.roadmap) setRoadmap(json.roadmap);
        }
      } catch {
        // API not available yet
      } finally {
        setIsLoading(false);
      }
    }
    if (caseId) fetchStrategy();
  }, [caseId]);

  const overallReadiness = readiness.length > 0
    ? Math.round(readiness.reduce((sum, m) => sum + (m.score / m.maxScore) * 100, 0) / readiness.length)
    : 0;
  const completedSteps = roadmap.filter((s) => s.status === 'completed').length;
  const totalSteps = roadmap.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading strategy data...</span>
      </div>
    );
  }

  const hasNoData = observations.length === 0 && recommendations.length === 0 && readiness.length === 0 && roadmap.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target size={22} className="text-indigo-600" />
          Litigation Strategy Dashboard
        </h2>
        <p className="text-sm text-gray-500 mt-1">Evidence-driven litigation planning and case readiness tracking</p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          CourtAccess provides analytical observations based on uploaded evidence. Attorneys must independently evaluate all legal strategies.
        </p>
      </div>

      {hasNoData && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Target size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No litigation strategy data available yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload evidence to generate strategy recommendations.</p>
        </div>
      )}

      {/* Phase 289: Case Readiness Score */}
      {readiness.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            Case Readiness Score
          </h3>
          <div className="flex items-center gap-2">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl ${
              overallReadiness >= 75 ? 'bg-green-100 text-green-700' :
              overallReadiness >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {overallReadiness}%
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {readiness.map((metric) => {
            const pct = Math.round((metric.score / metric.maxScore) * 100);
            return (
              <div key={metric.label} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400">{metric.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{metric.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-600">{metric.score}/{metric.maxScore}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Phase 290: Litigation Roadmap */}
      {roadmap.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'roadmap' ? null : 'roadmap')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-900">Case Litigation Roadmap</span>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
              {completedSteps}/{totalSteps} steps
            </span>
          </div>
          {expandedSection === 'roadmap' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>

        {expandedSection === 'roadmap' && (
          <div className="px-6 pb-6">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">Roadmap Progress</span>
                <span className="text-xs font-bold text-gray-700">{totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0}%</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {roadmap.map((step) => (
                <div key={step.stepNumber} className="flex items-start gap-3 py-2">
                  {/* Status indicator */}
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${STATUS_COLORS[step.status]}`}>
                      {step.status === 'completed' ? (
                        <CheckCircle size={14} className="text-white" />
                      ) : step.status === 'in_progress' ? (
                        <Clock size={14} className="text-white" />
                      ) : (
                        <span className="text-xs text-gray-500 font-bold">{step.stepNumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${step.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        Step {step.stepNumber} — {step.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[step.category]}`}>
                        {TYPE_ICONS[step.category]}
                        {step.category.replace(/_/g, ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        step.status === 'completed' ? 'bg-green-100 text-green-700' :
                        step.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {step.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Evidence Observations */}
      {observations.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'observations' ? null : 'observations')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="font-semibold text-gray-900">Evidence Observations</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
              {observations.length} detected
            </span>
          </div>
          {expandedSection === 'observations' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>

        {expandedSection === 'observations' && (
          <div className="px-6 pb-4 space-y-2">
            {observations.map((obs) => (
              <div key={obs.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">{obs.timestamp}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{obs.observation}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Source: {obs.evidenceSource}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Strategy Recommendations by Type */}
      {recommendations.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'recommendations' ? null : 'recommendations')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Target size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-900">All Recommendations</span>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
              {recommendations.length} total
            </span>
          </div>
          {expandedSection === 'recommendations' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>

        {expandedSection === 'recommendations' && (
          <div className="px-6 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Type</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Recommendation</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Evidence</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">Confidence</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => (
                  <tr key={rec.id} className="border-b border-gray-50">
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[rec.type]}`}>
                        {TYPE_ICONS[rec.type]}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-900 text-xs">{rec.suggestedOpportunity}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs font-mono">{rec.evidenceSource}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.confidenceScore >= 0.85 ? 'bg-green-100 text-green-700' :
                        rec.confidenceScore >= 0.70 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {(rec.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.status === 'addressed' ? 'bg-green-100 text-green-700' :
                        rec.status === 'dismissed' ? 'bg-gray-100 text-gray-500' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {rec.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
