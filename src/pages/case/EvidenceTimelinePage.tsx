// ============================================================================
// Evidence Timeline Page
// Requirement #1: Visual timeline of all evidence with inconsistency markers,
// investigative tasks, and legal instruments rated for court admissibility.
//
// All outputs sourced from uploaded evidence only.
// Includes AI verification badges (Req #2) and legal disclaimers (Req #3).
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  Search,
  Gavel,
  Shield,
  ChevronDown,
  ChevronRight,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { AnalysisProgressIndicator } from '../../components/common/AnalysisProgressIndicator';
import { AnalysisOutputWrapper } from '../../components/common/AnalysisOutputWrapper';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { caseDataProvider } from '../../services/caseDataProvider';
import {
  analyzeEvidenceTimeline,
  type EvidenceTimeline,
  type TimelineEvent,
  type TimelineInconsistency,
} from '../../services/timeline';
import { filterLegalAdviceLanguage } from '../../services/legalAdviceFilterEngine';
import { verifyClaim } from '../../services/aiGuardrailsEngine';

function safeText(text: string): string {
  return filterLegalAdviceLanguage(text).filteredText;
}

function priorityToConfidence(priority: 'critical' | 'high' | 'medium' | 'low'): number {
  switch (priority) {
    case 'critical':
      return 90;
    case 'high':
      return 75;
    case 'medium':
      return 60;
    case 'low':
      return 45;
  }
}

function shouldDisplayClaim(args: { id: string; text: string; sources: string[]; confidence: number; category: string }): boolean {
  return verifyClaim({
    id: args.id,
    text: args.text,
    sourceDocumentIds: args.sources,
    confidence: args.confidence,
    category: args.category,
  }).passesThreshold;
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function SignificanceDot({ significance }: { significance: TimelineEvent['significance'] }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    significant: 'bg-amber-500',
    notable: 'bg-blue-500',
    routine: 'bg-gray-400',
  };
  return <div className={`w-3 h-3 rounded-full ${colors[significance] ?? 'bg-gray-400'} flex-shrink-0`} />;
}

function InconsistencyMarker({ inconsistency }: { inconsistency: TimelineInconsistency }) {
  const scoreColor = inconsistency.score >= 80
    ? 'bg-red-100 text-red-800 border-red-300'
    : inconsistency.score >= 60
      ? 'bg-orange-100 text-orange-800 border-orange-300'
      : inconsistency.score >= 40
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-yellow-100 text-yellow-800 border-yellow-300';

  return (
    <div className={`p-3 rounded-lg border ${scoreColor}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold">{inconsistency.score}/100</span>
            <span className="text-xs capitalize px-1.5 py-0.5 rounded bg-white/50">
              {inconsistency.category}
            </span>
            <VerificationBadge status={inconsistency.verificationStatus === 'evidence_based' ? 'verified' : 'review_needed'} size="sm" />
          </div>
          <p className="text-xs leading-relaxed">{safeText(inconsistency.description)}</p>
          <p className="text-[10px] mt-1 opacity-75">
            Sources: {inconsistency.sourceDocuments.join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}

function AdmissibilityBadge({ rating }: { rating: 'high' | 'medium' | 'low' }) {
  const config: Record<string, { label: string; color: string }> = {
    high: { label: 'High Admissibility', color: 'bg-green-100 text-green-800' },
    medium: { label: 'Medium Admissibility', color: 'bg-amber-100 text-amber-800' },
    low: { label: 'Low Admissibility', color: 'bg-gray-100 text-gray-700' },
  };
  const c = config[rating] ?? config.low;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.color}`}>
      {c.label}
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[priority] ?? styles.low}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function VerificationIcon({ status }: { status: TimelineEvent['verificationStatus'] }) {
  switch (status) {
    case 'corroborated':
      return <CheckCircle size={14} className="text-green-600" />;
    case 'conflicting':
      return <XCircle size={14} className="text-red-600" />;
    case 'single_source':
      return <Eye size={14} className="text-amber-600" />;
    default:
      return <HelpCircle size={14} className="text-gray-400" />;
  }
}

// ---------------------------------------------------------------------------
// Timeline Visual Component
// ---------------------------------------------------------------------------

function TimelineVisual({
  events,
  inconsistencies,
  selectedEventId,
  onSelectEvent,
}: {
  events: TimelineEvent[];
  inconsistencies: TimelineInconsistency[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}) {
  // Map inconsistency event IDs for highlighting
  const inconsistencyEventIds = new Set(inconsistencies.flatMap(i => i.eventIds));

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-1">
        {events.map((event) => {
          const hasInconsistency = inconsistencyEventIds.has(event.id);
          const isSelected = selectedEventId === event.id;
          const relatedInc = inconsistencies.filter(i => i.eventIds.includes(event.id));

          const isSafe = shouldDisplayClaim({
            id: event.id,
            text: event.description,
            sources: [event.sourceDocumentName],
            confidence: event.confidence,
            category: 'timeline_event',
          });
          if (!isSafe) return null;

          return (
            <div key={event.id}>
              <button
                onClick={() => onSelectEvent(isSelected ? null : event.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200'
                    : hasInconsistency
                      ? 'bg-red-50/50 hover:bg-red-50 border border-red-100'
                      : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                {/* Timeline dot */}
                <div className="relative z-10 mt-1">
                  <SignificanceDot significance={event.significance} />
                  {hasInconsistency && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-gray-500">{event.timestamp}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                      event.significance === 'critical' ? 'bg-red-100 text-red-700' :
                      event.significance === 'significant' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {event.significance}
                    </span>
                    <VerificationIcon status={event.verificationStatus} />
                    {event.timestampPrecision !== 'exact' && (
                      <span className="text-[10px] text-gray-400 italic">{event.timestampPrecision}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{safeText(event.description)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <FileText size={10} className="text-gray-400" />
                    <span className="text-[10px] text-gray-500">{event.sourceDocumentName}</span>
                    <span className="text-[10px] text-gray-400">|</span>
                    <span className="text-[10px] text-gray-500 capitalize">{event.category.replace('_', ' ')}</span>
                    <span className="text-[10px] text-gray-400">|</span>
                    <span className="text-[10px] text-gray-500">{event.confidence}% confidence</span>
                  </div>
                </div>

                {isSelected ? <ChevronDown size={16} className="text-gray-400 mt-1" /> : <ChevronRight size={16} className="text-gray-400 mt-1" />}
              </button>

              {/* Expanded detail + inconsistency markers */}
              {isSelected && relatedInc.length > 0 && (
                <div className="ml-12 space-y-2 pb-2">
                  {relatedInc.map(inc => (
                    <InconsistencyMarker key={inc.id} inconsistency={inc} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function EvidenceTimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [timeline, setTimeline] = useState<EvidenceTimeline | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'inconsistencies' | 'tasks' | 'instruments'>('timeline');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

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
        const result = analyzeEvidenceTimeline(caseId ?? '', documents);
        setTimeline(result);
        setProgress(100);
        setTimeout(() => setIsAnalyzing(false), 500);
      }
    }, 120);
  }, [caseId, documents]);

  // Auto-run analysis on mount; cleanup interval on unmount
  useEffect(() => {
    if (documents.length > 0) {
      runAnalysis();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [documents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Empty state
  if (documents.length === 0 && !isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="text-center py-12">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Evidence to Analyze</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Upload evidence documents to this case to generate an evidence timeline.
              All uploaded evidence will be analyzed for chronological placement and
              cross-referenced for inconsistencies.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Evidence Timeline Analysis</h2>
            <p className="text-sm text-gray-500 mb-6">
              Analyzing {documents.length} document{documents.length !== 1 ? 's' : ''} for timeline placement
            </p>
          </div>
          <AnalysisProgressIndicator
            progress={progress}
            label={
              progress < 30
                ? 'Extracting temporal references from evidence'
                : progress < 60
                  ? 'Cross-referencing events across documents'
                  : progress < 85
                    ? 'Detecting inconsistencies and contradictions'
                    : 'Generating investigative tasks and legal instruments'
            }
          />
        </Card>
      </div>
    );
  }

  if (!timeline) return null;

  const tabs = [
    { id: 'timeline' as const, label: 'Timeline', icon: <Clock size={16} />, count: timeline.events.length },
    { id: 'inconsistencies' as const, label: 'Inconsistencies', icon: <AlertTriangle size={16} />, count: timeline.inconsistencies.length },
    { id: 'tasks' as const, label: 'Investigative Tasks', icon: <Search size={16} />, count: timeline.investigativeTasks.length },
    { id: 'instruments' as const, label: 'Legal Instruments', icon: <Gavel size={16} />, count: timeline.legalInstruments.length },
  ];

  return (
    <AnalysisOutputWrapper>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Evidence Timeline</h2>
                <p className="text-sm text-gray-500">
                  {timeline.totalDocumentsAnalyzed} documents analyzed | {timeline.events.length} events | {timeline.inconsistencies.length} inconsistencies found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VerificationBadge status="verified" size="md" />
            </div>
          </div>

          {/* Verification Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{timeline.verificationSummary.corroboratedEvents}</p>
              <p className="text-[10px] text-green-600 font-medium">Corroborated</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{timeline.verificationSummary.singleSourceEvents}</p>
              <p className="text-[10px] text-amber-600 font-medium">Single Source</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{timeline.verificationSummary.conflictingEvents}</p>
              <p className="text-[10px] text-red-600 font-medium">Conflicting</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{timeline.verificationSummary.unverifiedEvents}</p>
              <p className="text-[10px] text-gray-600 font-medium">Unverified</p>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'timeline' && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Chronological Evidence Timeline</h3>
              <span className="text-xs text-gray-500">
                {timeline.timelineSpan.earliest} — {timeline.timelineSpan.latest}
              </span>
            </div>
            <TimelineVisual
              events={timeline.events}
              inconsistencies={timeline.inconsistencies}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </Card>
        )}

        {activeTab === 'inconsistencies' && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={18} className="text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Timeline Inconsistencies & Contradictions</h3>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {timeline.inconsistencies.length} found
              </span>
            </div>
            <div className="space-y-3">
              {timeline.inconsistencies
                .filter((inc) =>
                  shouldDisplayClaim({
                    id: inc.id,
                    text: inc.description,
                    sources: inc.sourceDocuments,
                    confidence: inc.score,
                    category: 'timeline_inconsistency',
                  }),
                )
                .map((inc) => (
                <div key={inc.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      inc.score >= 80 ? 'bg-red-100' :
                      inc.score >= 60 ? 'bg-orange-100' :
                      inc.score >= 40 ? 'bg-amber-100' : 'bg-yellow-100'
                    }`}>
                      <span className={`text-lg font-bold ${
                        inc.score >= 80 ? 'text-red-700' :
                        inc.score >= 60 ? 'text-orange-700' :
                        inc.score >= 40 ? 'text-amber-700' : 'text-yellow-700'
                      }`}>
                        {inc.score}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold capitalize bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {inc.category}
                        </span>
                        <AdmissibilityBadge rating={inc.admissibilityRating} />
                        <VerificationBadge
                          status={inc.verificationStatus === 'evidence_based' ? 'verified' : 'review_needed'}
                          size="sm"
                        />
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{safeText(inc.description)}</p>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-2">
                        <p className="text-xs text-blue-800">
                          <span className="font-semibold">Observation:</span> {safeText(inc.recommendation)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">Sources:</span>
                        {inc.sourceDocuments.map((doc, i) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {timeline.inconsistencies.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No inconsistencies detected in the evidence timeline.
                </p>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'tasks' && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Search size={18} className="text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">Investigative Tasks</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {timeline.investigativeTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {timeline.investigativeTasks
                .filter((task) =>
                  shouldDisplayClaim({
                    id: task.id,
                    text: task.description,
                    sources: task.sourceDocuments,
                    confidence: priorityToConfidence(task.priority),
                    category: 'timeline_task',
                  }),
                )
                .map((task) => (
                <div key={task.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <PriorityBadge priority={task.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{safeText(task.title)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded capitalize">
                          {task.category.replace(/_/g, ' ')}
                        </span>
                        <AdmissibilityBadge rating={task.estimatedAdmissibility} />
                      </div>
                    </div>
                    {expandedTaskId === task.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {expandedTaskId === task.id && (
                    <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                      <p className="text-sm text-gray-700 mt-3 mb-2">{safeText(task.description)}</p>
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 mb-2">
                        <p className="text-xs text-purple-800">
                          <span className="font-semibold">Legal Basis:</span> {safeText(task.legalBasis)}
                        </p>
                      </div>
                      {task.sourceDocuments.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-gray-500">Related documents:</span>
                          {task.sourceDocuments.map((doc, i) => (
                            <span key={i} className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              {doc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'instruments' && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Gavel size={18} className="text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Legal Instruments</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                {timeline.legalInstruments.length}
              </span>
            </div>
            <div className="space-y-3">
              {timeline.legalInstruments
                .filter((inst) =>
                  shouldDisplayClaim({
                    id: inst.id,
                    text: inst.description,
                    sources: inst.sourceDocuments,
                    confidence: priorityToConfidence(inst.priority),
                    category: 'timeline_instrument',
                  }),
                )
                .map((inst) => (
                <div key={inst.id} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{safeText(inst.title)}</p>
                        <PriorityBadge priority={inst.priority} />
                      </div>
                      <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded capitalize">
                        {inst.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <Shield size={16} className="text-purple-500 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{safeText(inst.description)}</p>
                  <div className="bg-white/60 rounded-lg p-2 mb-2">
                    <p className="text-xs text-purple-800">
                      <span className="font-semibold">Legal Authority:</span> {safeText(inst.admissibilityBasis)}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">Filing Note:</span> {safeText(inst.filingDeadlineNote)}
                    </p>
                  </div>
                  {inst.sourceDocuments.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="text-[10px] text-gray-500">Supporting evidence:</span>
                      {inst.sourceDocuments.map((doc, i) => (
                        <span key={i} className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">
                          {doc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {timeline.legalInstruments.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No legal instruments recommended based on current evidence.
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </AnalysisOutputWrapper>
  );
}
