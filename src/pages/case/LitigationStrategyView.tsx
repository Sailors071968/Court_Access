// ============================================================================
// Phase 288 — Trial Strategy View
// Phase 289 — Case Readiness Score
// Phase 290 — Litigation Roadmap
// Route: /cases/:caseId/litigation-strategy
// ============================================================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Target, BarChart3, CheckCircle, Clock, AlertTriangle,
  Search, Gavel, Send, Globe, Users, ChevronDown, ChevronRight,
  Info, TrendingUp, Layers,
} from 'lucide-react';
import { JudgeIntelligencePanel } from '../../components/case/JudgeIntelligencePanel';
import { CaseLawIntelligencePanel } from '../../components/case/CaseLawIntelligencePanel';

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
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_OBSERVATIONS: StrategyObservation[] = [
  { id: 'obs-1', evidenceSource: 'Bodycam Video #1', observation: 'Officer Martinez uses specific restraint technique at 00:05:30', timestamp: '00:05:30' },
  { id: 'obs-2', evidenceSource: 'Officer Report pg 3', observation: 'Report states suspect was running; bodycam shows suspect stationary', timestamp: '14:33:05' },
  { id: 'obs-3', evidenceSource: 'Dispatch Log', observation: 'Radio traffic references additional communications not in evidence file', timestamp: '14:28:00' },
  { id: 'obs-4', evidenceSource: 'Evidence Log Entry #14', observation: 'Referenced video footage not included in discovery package', timestamp: 'N/A' },
  { id: 'obs-5', evidenceSource: 'Cross-Case Analysis', observation: 'Officer Martinez has 3 prior use-of-force incidents on file', timestamp: 'N/A' },
  { id: 'obs-6', evidenceSource: 'Scene Photos', observation: 'Incident at commercial intersection — nearby businesses with cameras', timestamp: 'N/A' },
];

const MOCK_STRATEGY_RECS: StrategyRecommendation[] = [
  { id: 'sr-1', type: 'INVESTIGATION', suggestedOpportunity: 'Obtain intersection surveillance footage', evidenceSource: 'Scene Photos', confidenceScore: 0.90, status: 'pending' },
  { id: 'sr-2', type: 'INVESTIGATION', suggestedOpportunity: 'Interview additional witnesses from dispatch log', evidenceSource: 'Dispatch Log', confidenceScore: 0.80, status: 'pending' },
  { id: 'sr-3', type: 'MOTION', suggestedOpportunity: 'Evaluate suppression motion for vehicle search', evidenceSource: 'Officer Report pg 3', confidenceScore: 0.85, status: 'pending' },
  { id: 'sr-4', type: 'MOTION', suggestedOpportunity: 'Request Brady disclosure of missing video evidence', evidenceSource: 'Evidence Log #14', confidenceScore: 0.90, status: 'addressed' },
  { id: 'sr-5', type: 'MOTION', suggestedOpportunity: 'Consider Pitchess motion for officer personnel records', evidenceSource: 'Cross-Case Analysis', confidenceScore: 0.75, status: 'pending' },
  { id: 'sr-6', type: 'SUBPOENA', suggestedOpportunity: 'Obtain full dispatch log and CAD records', evidenceSource: 'Radio Traffic Log', confidenceScore: 0.90, status: 'addressed' },
  { id: 'sr-7', type: 'SUBPOENA', suggestedOpportunity: 'Obtain nearby surveillance camera recordings', evidenceSource: 'Scene Photos', confidenceScore: 0.80, status: 'pending' },
  { id: 'sr-8', type: 'PUBLIC_RECORD', suggestedOpportunity: 'Request restraint technique training records', evidenceSource: 'Bodycam #1', confidenceScore: 0.85, status: 'pending' },
  { id: 'sr-9', type: 'PUBLIC_RECORD', suggestedOpportunity: 'Request agency policy manuals for incident date', evidenceSource: 'Officer Report', confidenceScore: 0.90, status: 'addressed' },
  { id: 'sr-10', type: 'EXPERT', suggestedOpportunity: 'Consult use-of-force expert', evidenceSource: 'Bodycam #1', confidenceScore: 0.90, status: 'pending' },
  { id: 'sr-11', type: 'EXPERT', suggestedOpportunity: 'Consult video forensic analyst', evidenceSource: 'Surveillance Video', confidenceScore: 0.82, status: 'pending' },
];

const MOCK_READINESS: ReadinessMetric[] = [
  { label: 'Evidence Completeness', score: 72, maxScore: 100, icon: <Layers size={16} /> },
  { label: 'Investigative Opportunities', score: 1, maxScore: 3, icon: <Search size={16} /> },
  { label: 'Records Obtained', score: 3, maxScore: 7, icon: <Send size={16} /> },
  { label: 'Expert Consultation', score: 0, maxScore: 2, icon: <Users size={16} /> },
];

const MOCK_ROADMAP: RoadmapStep[] = [
  { stepNumber: 1, description: 'Obtain full dispatch records and CAD logs', category: 'SUBPOENA', status: 'completed' },
  { stepNumber: 2, description: 'Request agency policy manuals effective on incident date', category: 'PUBLIC_RECORD', status: 'completed' },
  { stepNumber: 3, description: 'File Brady motion for undisclosed video evidence', category: 'MOTION', status: 'completed' },
  { stepNumber: 4, description: 'Obtain intersection surveillance camera recordings', category: 'SUBPOENA', status: 'in_progress' },
  { stepNumber: 5, description: 'Review bodycam inconsistencies with officer report narrative', category: 'INVESTIGATION', status: 'in_progress' },
  { stepNumber: 6, description: 'Request restraint technique training records', category: 'PUBLIC_RECORD', status: 'pending' },
  { stepNumber: 7, description: 'Consult use-of-force expert for restraint analysis', category: 'EXPERT', status: 'pending' },
  { stepNumber: 8, description: 'Evaluate suppression motion for pre-probable-cause search', category: 'MOTION', status: 'pending' },
  { stepNumber: 9, description: 'Consider Pitchess motion for officer personnel records', category: 'MOTION', status: 'pending' },
  { stepNumber: 10, description: 'Consult video forensic analyst for surveillance enhancement', category: 'EXPERT', status: 'pending' },
];

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
  const { caseId: _caseId } = useParams<{ caseId: string }>();
  const [expandedSection, setExpandedSection] = useState<string | null>('roadmap');

  // Phase 289: Calculate readiness score
  const overallReadiness = Math.round(
    MOCK_READINESS.reduce((sum, m) => sum + (m.score / m.maxScore) * 100, 0) / MOCK_READINESS.length,
  );
  const completedSteps = MOCK_ROADMAP.filter((s) => s.status === 'completed').length;
  const totalSteps = MOCK_ROADMAP.length;

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

      {/* Phase 289: Case Readiness Score */}
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
          {MOCK_READINESS.map((metric) => {
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

      {/* Phase 290: Litigation Roadmap */}
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
                <span className="text-xs font-bold text-gray-700">{Math.round((completedSteps / totalSteps) * 100)}%</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(completedSteps / totalSteps) * 100}%` }} />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {MOCK_ROADMAP.map((step) => (
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

      {/* Evidence Observations */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'observations' ? null : 'observations')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="font-semibold text-gray-900">Evidence Observations</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
              {MOCK_OBSERVATIONS.length} detected
            </span>
          </div>
          {expandedSection === 'observations' ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>

        {expandedSection === 'observations' && (
          <div className="px-6 pb-4 space-y-2">
            {MOCK_OBSERVATIONS.map((obs) => (
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

      {/* Strategy Recommendations by Type */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'recommendations' ? null : 'recommendations')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Target size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-900">All Recommendations</span>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
              {MOCK_STRATEGY_RECS.length} total
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
                {MOCK_STRATEGY_RECS.map((rec) => (
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

      {/* Phase 297: Judge Intelligence Panel */}
      <JudgeIntelligencePanel judgeName="Hon. Patricia M. Guerrero" court="Sacramento County Superior Court" />

      {/* Phase 296: Case Law Intelligence Panel */}
      <CaseLawIntelligencePanel />
    </div>
  );
}
