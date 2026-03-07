// ============================================
// Court Access — Trial Preparation Canvas (Phase 140)
// Unified trial prep workspace:
//   - Witness exam outlines (direct + cross)
//   - Motion strategy board
//   - Narrative comparison viewer
//   - Trial outline with readiness scoring
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Scale, Users, AlertTriangle, CheckCircle,
  ChevronRight, Clock, Target, Shield, Loader2, BarChart3,
  MessageSquare, Gavel, BookOpen, Layers, RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WitnessExam {
  id: string;
  witnessName: string;
  examType: 'direct' | 'cross';
  totalQuestions: number;
  estimatedMinutes: number;
  sections: { title: string; questions: string[] }[];
}

interface MotionRecommendation {
  id: string;
  motionType: string;
  legalBasis: string;
  strengthScore: number;
  requirements: string[];
  standardOfReview: string;
}

interface NarrativeComparison {
  agreementPoints: string[];
  disagreementPoints: string[];
  alignmentScore: number;
  sharedEvidence: string[];
  exclusiveDefense: string[];
  exclusiveProsecution: string[];
}

interface TrialOutline {
  id: string;
  side: string;
  phases: { name: string; items: string[]; estimatedMinutes: number }[];
  readinessScore: number;
  estimatedTrialDays: number;
}

interface TaskProgress {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  completionRate: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/intelligence';

async function fetchJSON(url: string) {
  const token = localStorage.getItem('court_access_token') || '';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJSON(url: string, body: Record<string, unknown> = {}) {
  const token = localStorage.getItem('court_access_token') || '';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StrengthBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'text-green-700 bg-green-100' : pct >= 40 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct}%</span>;
}

function SectionHeader({ icon: Icon, title, count }: { icon: typeof Scale; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-blue-600" />
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

function ExamCard({ exam }: { exam: WitnessExam }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${exam.examType === 'direct' ? 'bg-blue-100' : 'bg-amber-100'}`}>
            {exam.examType === 'direct' ? <MessageSquare size={14} className="text-blue-600" /> : <Target size={14} className="text-amber-600" />}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{exam.witnessName}</p>
            <p className="text-xs text-gray-500 capitalize">{exam.examType} Examination &middot; {exam.totalQuestions} questions &middot; ~{exam.estimatedMinutes} min</p>
          </div>
        </div>
        <ChevronRight size={16} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {exam.sections.map((section, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-gray-700 mb-1">{section.title}</p>
              <ul className="space-y-0.5">
                {section.questions.slice(0, 5).map((q, j) => (
                  <li key={j} className="text-xs text-gray-600 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-blue-400">{q}</li>
                ))}
                {section.questions.length > 5 && <li className="text-xs text-gray-400 pl-3">+{section.questions.length - 5} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MotionCard({ motion }: { motion: MotionRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Gavel size={14} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 capitalize">{motion.motionType.replace(/_/g, ' ')}</p>
            <p className="text-xs text-gray-500">{motion.legalBasis} &middot; {motion.standardOfReview}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StrengthBadge score={motion.strengthScore} />
          <ChevronRight size={16} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-700 mb-1">Requirements</p>
          <ul className="space-y-0.5">
            {motion.requirements.map((req, i) => (
              <li key={i} className="text-xs text-gray-600 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-purple-400">{req}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReadinessGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600';
  const bg = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold ${color}`}>{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const CANVAS_TABS = [
  { id: 'witnesses', label: 'Witnesses', icon: Users },
  { id: 'motions', label: 'Motions', icon: Gavel },
  { id: 'narratives', label: 'Narratives', icon: BookOpen },
  { id: 'outline', label: 'Trial Outline', icon: Layers },
  { id: 'tasks', label: 'Tasks', icon: Target },
] as const;

type TabId = typeof CANVAS_TABS[number]['id'];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TrialPreparationCanvas() {
  const { caseId } = useParams<{ caseId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('witnesses');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exams, setExams] = useState<WitnessExam[]>([]);
  const [motions, setMotions] = useState<MotionRecommendation[]>([]);
  const [comparison, setComparison] = useState<NarrativeComparison | null>(null);
  const [outline, setOutline] = useState<TrialOutline | null>(null);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [examData, motionData, compData, outlineData, taskData] = await Promise.allSettled([
        fetchJSON(`${API_BASE}/${caseId}/exam/outlines`),
        fetchJSON(`${API_BASE}/${caseId}/motions`),
        fetchJSON(`${API_BASE}/${caseId}/narrative/comparisons`),
        fetchJSON(`${API_BASE}/${caseId}/trial/outlines`),
        fetchJSON(`${API_BASE}/${caseId}/tasks/progress`),
      ]);

      if (examData.status === 'fulfilled') setExams(Array.isArray(examData.value) ? examData.value : []);
      if (motionData.status === 'fulfilled') setMotions(Array.isArray(motionData.value) ? motionData.value : []);
      if (compData.status === 'fulfilled') {
        const comps = Array.isArray(compData.value) ? compData.value : [];
        setComparison(comps[0] || null);
      }
      if (outlineData.status === 'fulfilled') {
        const outlines = Array.isArray(outlineData.value) ? outlineData.value : [];
        setOutline(outlines[0] || null);
      }
      if (taskData.status === 'fulfilled') setTaskProgress(taskData.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trial prep data');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async (type: string) => {
    if (!caseId) return;
    setLoading(true);
    try {
      switch (type) {
        case 'motions': await postJSON(`${API_BASE}/${caseId}/motions/generate`); break;
        case 'outline': await postJSON(`${API_BASE}/${caseId}/trial/outline`, { side: 'defense' }); break;
        case 'tasks': await postJSON(`${API_BASE}/${caseId}/tasks/generate`); break;
        case 'narratives': await postJSON(`${API_BASE}/${caseId}/narrative/compare`); break;
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale size={24} className="text-blue-600" />
            Trial Preparation Canvas
          </h1>
          <p className="text-sm text-gray-500 mt-1">Unified trial preparation workspace — witnesses, motions, narratives, and trial outline</p>
        </div>
        <button onClick={loadData} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Readiness Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-gray-500">Witness Exams</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{exams.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gavel size={14} className="text-purple-600" />
            <span className="text-xs font-medium text-gray-500">Motions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{motions.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-green-600" />
            <span className="text-xs font-medium text-gray-500">Trial Readiness</span>
          </div>
          {outline ? <ReadinessGauge score={outline.readinessScore} /> : <p className="text-sm text-gray-400">Not generated</p>}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-amber-600" />
            <span className="text-xs font-medium text-gray-500">Task Completion</span>
          </div>
          {taskProgress ? (
            <ReadinessGauge score={taskProgress.completionRate / 100} />
          ) : (
            <p className="text-sm text-gray-400">No tasks</p>
          )}
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {CANVAS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Tab Content */}
      {!loading && activeTab === 'witnesses' && (
        <Card className="p-6">
          <SectionHeader icon={Users} title="Witness Examination Outlines" count={exams.length} />
          {exams.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No examination outlines generated yet.</p>
              <p className="text-xs text-gray-400 mt-1">Use the Exam Builder to generate witness outlines.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
            </div>
          )}
        </Card>
      )}

      {!loading && activeTab === 'motions' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={Gavel} title="Motion Strategy Board" count={motions.length} />
            <button onClick={() => handleGenerate('motions')} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 flex items-center gap-1">
              <RefreshCw size={12} /> Generate Motions
            </button>
          </div>
          {motions.length === 0 ? (
            <div className="text-center py-8">
              <Gavel size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No motion recommendations yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click Generate Motions to analyze admissibility issues.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {motions.map((motion) => <MotionCard key={motion.id} motion={motion} />)}
            </div>
          )}
        </Card>
      )}

      {!loading && activeTab === 'narratives' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={BookOpen} title="Narrative Comparison" />
            <button onClick={() => handleGenerate('narratives')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1">
              <RefreshCw size={12} /> Compare Narratives
            </button>
          </div>
          {!comparison ? (
            <div className="text-center py-8">
              <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No narrative comparison available.</p>
              <p className="text-xs text-gray-400 mt-1">Generate defense and prosecution narratives first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-medium text-gray-500">Alignment Score:</span>
                <StrengthBadge score={comparison.alignmentScore} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle size={12} /> Points of Agreement ({comparison.agreementPoints.length})
                  </h4>
                  <ul className="space-y-1">
                    {comparison.agreementPoints.map((pt, i) => (
                      <li key={i} className="text-xs text-gray-600 bg-green-50 rounded px-2 py-1">{pt}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> Points of Disagreement ({comparison.disagreementPoints.length})
                  </h4>
                  <ul className="space-y-1">
                    {comparison.disagreementPoints.map((pt, i) => (
                      <li key={i} className="text-xs text-gray-600 bg-red-50 rounded px-2 py-1">{pt}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-600">{comparison.sharedEvidence.length}</p>
                  <p className="text-xs text-gray-500">Shared Evidence</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">{comparison.exclusiveDefense.length}</p>
                  <p className="text-xs text-gray-500">Defense Only</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">{comparison.exclusiveProsecution.length}</p>
                  <p className="text-xs text-gray-500">Prosecution Only</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {!loading && activeTab === 'outline' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={Layers} title="Trial Outline" />
            <button onClick={() => handleGenerate('outline')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1">
              <RefreshCw size={12} /> Generate Outline
            </button>
          </div>
          {!outline ? (
            <div className="text-center py-8">
              <Layers size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No trial outline generated yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click Generate Outline to create a defense trial plan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <span className="text-xs text-gray-500">Readiness</span>
                  <div className="w-48 mt-1"><ReadinessGauge score={outline.readinessScore} /></div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Est. Trial Days</span>
                  <p className="text-lg font-bold text-gray-900 flex items-center gap-1"><Clock size={14} /> {outline.estimatedTrialDays}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Side</span>
                  <p className="text-lg font-bold text-gray-900 capitalize flex items-center gap-1"><Shield size={14} /> {outline.side}</p>
                </div>
              </div>
              <div className="space-y-3">
                {outline.phases.map((phase, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900">{phase.name}</h4>
                      <span className="text-xs text-gray-500">~{phase.estimatedMinutes} min</span>
                    </div>
                    <ul className="space-y-1">
                      {phase.items.map((item, j) => (
                        <li key={j} className="text-xs text-gray-600 pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-blue-400">{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {!loading && activeTab === 'tasks' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={Target} title="Investigative Tasks" />
            <button onClick={() => handleGenerate('tasks')} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 flex items-center gap-1">
              <RefreshCw size={12} /> Generate Tasks
            </button>
          </div>
          {!taskProgress ? (
            <div className="text-center py-8">
              <Target size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No tasks generated yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{taskProgress.total}</p>
                  <p className="text-xs text-gray-500">Total Tasks</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{taskProgress.completed}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{taskProgress.inProgress}</p>
                  <p className="text-xs text-gray-500">In Progress</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{taskProgress.blocked}</p>
                  <p className="text-xs text-gray-500">Blocked</p>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Overall Completion</span>
                <div className="mt-1"><ReadinessGauge score={taskProgress.completionRate / 100} /></div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
