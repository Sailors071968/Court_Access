// ============================================================================
// CALCRIM Defense Analysis Page
// Route: /cases/:caseId/defense-analysis
//
// Requirements #1 & #2:
// - Uses CALCRIM jury instructions to obtain elements of each criminal charge
// - Compares elements against uploaded evidence to determine investigative
//   tasks, legal instruments, and defense strategies
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Scale,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Gavel,
  Search,
  BookOpen,
  CheckCircle,
  XCircle,
  HelpCircle,
  MinusCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { AnalysisProgressIndicator } from '../../components/common/AnalysisProgressIndicator';
import { AnalysisOutputWrapper } from '../../components/common/AnalysisOutputWrapper';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { caseDataProvider } from '../../services/caseDataProvider';
import {
  analyzeFullCase,
  type FullCaseAnalysis,
  type ChargeAnalysisResult,
  type ElementStrength,
  type Inconsistency,
} from '../../services/calcrim';
import { filterLegalAdviceLanguage } from '../../services/legalAdviceFilterEngine';
import { verifyClaim, type AnalysisClaim } from '../../services/aiGuardrailsEngine';
import { GuardrailStatusBanner } from '../../components/common/VerificationBadge';

// ---------------------------------------------------------------------------
// Scoring → Enum mapping (Requirement #6)
// Maps numeric prosecution scores to deterministic evidence status enums.
// ---------------------------------------------------------------------------

type EvidenceStatusEnum = 'ESTABLISHED' | 'DISPUTED' | 'UNCORROBORATED' | 'NOT_PRESENT';

function scoreToEvidenceStatus(score: number, supportingCount: number, refutingCount: number): EvidenceStatusEnum {
  if (supportingCount === 0 && refutingCount === 0) return 'NOT_PRESENT';
  if (supportingCount > 0 && refutingCount > 0) return 'DISPUTED';
  if (supportingCount >= 2 && score >= 60) return 'ESTABLISHED';
  if (supportingCount === 1) return 'UNCORROBORATED';
  return 'NOT_PRESENT';
}

const EVIDENCE_STATUS_STYLE: Record<EvidenceStatusEnum, { label: string; color: string }> = {
  ESTABLISHED: { label: 'Established', color: 'bg-green-100 text-green-800' },
  DISPUTED: { label: 'Disputed', color: 'bg-red-100 text-red-800' },
  UNCORROBORATED: { label: 'Uncorroborated', color: 'bg-amber-100 text-amber-800' },
  NOT_PRESENT: { label: 'Not Present', color: 'bg-gray-100 text-gray-600' },
};

function EvidenceStatusBadge({ status }: { status: EvidenceStatusEnum }) {
  const s = EVIDENCE_STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

/** Filter text through legal advice filter before display */
function safeText(text: string): string {
  return filterLegalAdviceLanguage(text).filteredText;
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function StrengthBadge({ strength }: { strength: ElementStrength }) {
  const config: Record<ElementStrength, { label: string; color: string; icon: React.ReactNode }> = {
    strong: { label: 'Strong', color: 'bg-red-100 text-red-800', icon: <XCircle size={14} /> },
    moderate: { label: 'Moderate', color: 'bg-amber-100 text-amber-800', icon: <MinusCircle size={14} /> },
    weak: { label: 'Weak', color: 'bg-green-100 text-green-800', icon: <CheckCircle size={14} /> },
    unsupported: { label: 'Unsupported', color: 'bg-blue-100 text-blue-800', icon: <HelpCircle size={14} /> },
  };
  const c = config[strength];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  let color = 'bg-gray-100 text-gray-700';
  if (score >= 75) color = 'bg-red-100 text-red-800';
  else if (score >= 50) color = 'bg-amber-100 text-amber-800';
  else if (score >= 25) color = 'bg-green-100 text-green-800';
  else color = 'bg-blue-100 text-blue-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {score}/100{label ? ` ${label}` : ''}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-gray-400 text-white',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[priority] || styles.low}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    constitutional: 'bg-purple-100 text-purple-700',
    procedural: 'bg-blue-100 text-blue-700',
    factual: 'bg-green-100 text-green-700',
    affirmative: 'bg-amber-100 text-amber-700',
    mitigation: 'bg-teal-100 text-teal-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ElementsSection({ charge }: { charge: ChargeAnalysisResult }) {
  const [expandedEl, setExpandedEl] = useState<number | null>(null);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={18} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          {charge.calcrimNumber} — Elements the Prosecution Must Prove
        </h3>
      </div>

      <div className="space-y-3">
        {charge.elements.map((el) => (
          <div key={el.elementNumber} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedEl(expandedEl === el.elementNumber ? null : el.elementNumber)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                {el.elementNumber}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{safeText(el.elementText)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StrengthBadge strength={el.strength} />
                <EvidenceStatusBadge status={scoreToEvidenceStatus(el.prosecutionScore, el.supportingEvidence.length, el.refutingEvidence.length)} />
                <ScoreBadge score={el.prosecutionScore} />
                {expandedEl === el.elementNumber ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </button>

            {expandedEl === el.elementNumber && (
              <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                <div className="grid md:grid-cols-2 gap-4 mt-3">
                  {/* Supporting evidence */}
                  <div>
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                      Prosecution Evidence ({el.supportingEvidence.length})
                    </p>
                    {el.supportingEvidence.length > 0 ? (
                      <ul className="space-y-1">
                        {el.supportingEvidence.map((ev, i) => (
                          <li key={i} className="text-xs text-gray-600 bg-red-50 rounded p-2">
                            {safeText(ev)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No supporting evidence found</p>
                    )}
                  </div>

                  {/* Refuting evidence */}
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                      Defense Evidence ({el.refutingEvidence.length})
                    </p>
                    {el.refutingEvidence.length > 0 ? (
                      <ul className="space-y-1">
                        {el.refutingEvidence.map((ev, i) => (
                          <li key={i} className="text-xs text-gray-600 bg-green-50 rounded p-2">
                            {safeText(ev)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No refuting evidence found yet</p>
                    )}
                  </div>
                </div>

                {/* Defense angle */}
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Defense Strategy</p>
                  <p className="text-sm text-blue-800">{safeText(el.defenseAngle)}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function InvestigativeTasksSection({ charge }: { charge: ChargeAnalysisResult }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} className="text-amber-600" />
        <h3 className="text-lg font-semibold text-gray-900">Investigative Tasks</h3>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          {charge.investigativeTasks.length}
        </span>
      </div>
      <div className="space-y-3">
        {charge.investigativeTasks.map((task) => (
          <div key={task.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex-shrink-0 mt-0.5">
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{safeText(task.title)}</p>
              <p className="text-xs text-gray-600 mt-1">{safeText(task.description)}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                  {task.category}
                </span>
                {task.relatedElements.map((el) => (
                  <span key={el} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    Element {el}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LegalInstrumentsSection({ charge }: { charge: ChargeAnalysisResult }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Gavel size={18} className="text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Legal Instruments</h3>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
          {charge.legalInstruments.length}
        </span>
      </div>
      <div className="space-y-3">
        {charge.legalInstruments.map((li) => (
          <div key={li.id} className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{safeText(li.title)}</p>
                <p className="text-xs text-gray-600 mt-1">{safeText(li.description)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <PriorityBadge priority={li.priority} />
                <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded capitalize">
                  {li.type.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DefenseStrategiesSection({ charge }: { charge: ChargeAnalysisResult }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-green-600" />
        <h3 className="text-lg font-semibold text-gray-900">Defense Strategies</h3>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          {charge.defenseStrategies.length}
        </span>
      </div>
      <div className="space-y-3">
        {charge.defenseStrategies.map((strategy) => (
          <div key={strategy.id} className="p-3 bg-green-50 rounded-xl border border-green-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900">{safeText(strategy.title)}</p>
                  <CategoryBadge category={strategy.category} />
                </div>
                <p className="text-xs text-gray-600">{safeText(strategy.description)}</p>
              </div>
              <div className="flex-shrink-0">
                <ScoreBadge score={strategy.confidence} label="confidence" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InconsistenciesPreview({
  inconsistencies,
  onViewAll,
}: {
  inconsistencies: Inconsistency[];
  onViewAll: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Inconsistencies Found</h3>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {inconsistencies.length}
          </span>
        </div>
        <button
          onClick={onViewAll}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View All &rarr;
        </button>
      </div>
      <div className="space-y-2">
        {inconsistencies.slice(0, 3).map((inc) => (
          <div key={inc.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <ScoreBadge score={inc.score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{safeText(inc.description)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded capitalize">
                  {inc.category}
                </span>
                {inc.sources.slice(0, 2).map((s, i) => (
                  <span key={i} className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function CalcrimDefenseAnalysisPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<FullCaseAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeChargeIdx, setActiveChargeIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'elements' | 'tasks' | 'legal' | 'strategies'>('elements');

  const charges = caseDataProvider.getCharges(caseId);
  const documents = caseDataProvider.getDocuments(caseId);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runAnalysis = useCallback(() => {
    // Cancel any in-flight analysis to prevent interval duplication
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsAnalyzing(true);
    setProgress(0);

    // Progressive analysis with animated progress
    const steps = 20;
    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      setProgress(Math.min(95, (step / steps) * 100));
      if (step >= steps) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Run the actual analysis engine
        const chargeInputs = charges.map((c) => ({
          id: c.id,
          code: c.code,
          calcrimNumber: c.calcrimNumber ?? undefined,
        }));

        const evidenceDocs = documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          content: `${d.name}. Filed ${d.filedDate}. Document type: ${d.type}. This is evidence document ${d.id} in case ${caseId}.`,
        }));

        const result = analyzeFullCase(caseId ?? '', chargeInputs, evidenceDocs);
        setAnalysis(result);
        setProgress(100);

        setTimeout(() => {
          setIsAnalyzing(false);
        }, 500);
      }
    }, 150);
  }, [caseId, charges, documents]);

  // Auto-run analysis on mount; cleanup interval on unmount
  useEffect(() => {
    if (charges.length > 0) {
      runAnalysis();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [charges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCharge = analysis?.charges[activeChargeIdx];

  // Compute guardrail report for the active charge's claims
  const guardrailStats = useMemo(() => {
    if (!activeCharge) return { total: 0, verified: 0, rejected: 0, confidence: 0 };
    const claims: AnalysisClaim[] = [
      ...activeCharge.elements.map((el, i) => ({
        id: `el-${i}`,
        text: el.defenseAngle,
        sourceDocumentIds: [...el.supportingEvidence, ...el.refutingEvidence].map((_, j) => `doc-${j}`),
        confidence: el.prosecutionScore,
        category: 'element',
      })),
      ...activeCharge.inconsistencies.map((inc) => ({
        id: inc.id,
        text: inc.description,
        sourceDocumentIds: inc.sources,
        confidence: inc.score,
        category: 'inconsistency',
      })),
    ];
    const results = claims.map(c => verifyClaim(c));
    const passed = results.filter(r => r.passesThreshold);
    const rejected = results.filter(r => !r.passesThreshold);
    const avgConf = passed.length > 0
      ? Math.round(passed.reduce((s, r) => s + r.confidence, 0) / passed.length)
      : 0;
    return { total: claims.length, verified: passed.length, rejected: rejected.length, confidence: avgConf };
  }, [activeCharge]);

  // Show empty state when no charges exist
  if (charges.length === 0 && !isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="text-center py-12">
            <Scale size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Charges to Analyze</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Add criminal charges to this case to begin CALCRIM element analysis.
              The system will compare uploaded evidence against each element the
              prosecution must prove.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Show analysis progress indicator (Requirement #4)
  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">CALCRIM Defense Analysis</h2>
            <p className="text-sm text-gray-500 mb-6">
              Analyzing {charges.length} charge{charges.length !== 1 ? 's' : ''} against {documents.length} evidence document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <AnalysisProgressIndicator
            progress={progress}
            label={
              progress < 30
                ? 'Extracting CALCRIM elements'
                : progress < 60
                ? 'Comparing evidence against charge elements'
                : progress < 85
                ? 'Detecting inconsistencies and contradictions'
                : 'Generating defense strategies'
            }
          />
        </Card>
      </div>
    );
  }

  if (!analysis || !activeCharge) {
    return null;
  }

  return (
    <AnalysisOutputWrapper>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Scale size={20} className="text-blue-600" />
            CALCRIM Defense Analysis
            <VerificationBadge
              status={guardrailStats.rejected === 0 && guardrailStats.verified > 0 ? 'verified' : guardrailStats.verified > 0 ? 'corroborated' : 'review_needed'}
              size="sm"
            />
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Element-by-element analysis using California Jury Instructions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAnalysis}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Re-Analyze
          </button>
          <span className="text-xs text-gray-400">
            Last analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Scale size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analysis.charges.length}</p>
              <p className="text-xs text-gray-500">Charges Analyzed</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analysis.totalInconsistencies}</p>
              <p className="text-xs text-gray-500">Inconsistencies</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {analysis.charges.reduce((sum, c) => sum + c.defenseStrategies.length, 0)}
              </p>
              <p className="text-xs text-gray-500">Defense Strategies</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gavel size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {analysis.charges.reduce((sum, c) => sum + c.legalInstruments.length, 0)}
              </p>
              <p className="text-xs text-gray-500">Legal Instruments</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charge Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {analysis.charges.map((charge, idx) => (
          <button
            key={charge.chargeId}
            onClick={() => { setActiveChargeIdx(idx); setActiveTab('elements'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeChargeIdx === idx
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {charge.penalCode} — {charge.chargeTitle}
            <span className="ml-2 text-xs opacity-75">
              Defense: {charge.overallDefenseScore}/100
            </span>
          </button>
        ))}
      </div>

      {/* Overall Defense Score for active charge */}
      <Card className={
        activeCharge.overallDefenseScore >= 70
          ? 'border-green-300 bg-green-50'
          : activeCharge.overallDefenseScore >= 40
          ? 'border-amber-300 bg-amber-50'
          : 'border-red-300 bg-red-50'
      }>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {activeCharge.calcrimNumber} — {activeCharge.chargeTitle}
            </h3>
            <p className="text-sm text-gray-600">{activeCharge.penalCode}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{activeCharge.overallDefenseScore}</p>
            <p className="text-xs text-gray-500">Defense Score</p>
          </div>
        </div>
      </Card>

      {/* Guardrail Status Banner (Req #2) */}
      <GuardrailStatusBanner
        totalClaims={guardrailStats.total}
        verifiedClaims={guardrailStats.verified}
        rejectedClaims={guardrailStats.rejected}
        overallConfidence={guardrailStats.confidence}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'elements' as const, label: 'Elements', icon: <BookOpen size={16} />, count: activeCharge.elements.length },
          { id: 'tasks' as const, label: 'Investigative Tasks', icon: <Search size={16} />, count: activeCharge.investigativeTasks.length },
          { id: 'legal' as const, label: 'Legal Instruments', icon: <Gavel size={16} />, count: activeCharge.legalInstruments.length },
          { id: 'strategies' as const, label: 'Defense Strategies', icon: <Shield size={16} />, count: activeCharge.defenseStrategies.length },
        ].map((tab) => (
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
            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'elements' && <ElementsSection charge={activeCharge} />}
      {activeTab === 'tasks' && <InvestigativeTasksSection charge={activeCharge} />}
      {activeTab === 'legal' && <LegalInstrumentsSection charge={activeCharge} />}
      {activeTab === 'strategies' && <DefenseStrategiesSection charge={activeCharge} />}

      {/* Inconsistencies Preview */}
      {activeCharge.inconsistencies.length > 0 && (
        <InconsistenciesPreview
          inconsistencies={activeCharge.inconsistencies}
          onViewAll={() => navigate(`/cases/${caseId}/inconsistencies`)}
        />
      )}

    </div>
    </AnalysisOutputWrapper>
  );
}
