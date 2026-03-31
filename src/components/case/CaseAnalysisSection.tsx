// ============================================================================
// Phase 257 — Complete Case Analysis Engine (Overview Section)
// Phase 291.7 — Connected to real evidence processing pipeline
// Rendered inside CaseOverviewPage
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText, Clock, GitCompare, Shield, AlertTriangle,
  Layers, ChevronDown, ChevronRight, ExternalLink,
  Video, Radio, Users, FileSearch, Scale, RefreshCw,
  Camera, Mic, Loader2,
} from 'lucide-react';
import {
  fetchCaseAnalysis,
  triggerRegeneration,
  type CaseAnalysisData,
  type TimelineEvent,
  type CrossDocComparison,
  type OfficerAction,
  type PolicyComparison,
  type Inconsistency,
  type RecommendedExhibit,
  type EvidenceSummaryItem,
  type PipelineStageStatus,
} from '../../services/caseAnalysisService';
import { filterLegalAdviceLanguage } from '../../services/legalAdviceFilterEngine';
import { verifyClaim } from '../../services/aiGuardrailsEngine';

// ---------------------------------------------------------------------------
// Icon Resolver
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Guardrail helpers — all analysis text must pass through both engines
// ---------------------------------------------------------------------------

function safeText(text: string): string {
  return filterLegalAdviceLanguage(text);
}

function shouldDisplay(args: { id: string; text: string; sources: string[]; confidence: number }): boolean {
  return verifyClaim({
    id: args.id,
    text: args.text,
    sources: args.sources,
    confidence: args.confidence,
    category: 'analysis',
  }).approved;
}

function getIcon(iconType: string, size = 16): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    FileText: <FileText size={size} />,
    Video: <Video size={size} />,
    Users: <Users size={size} />,
    Radio: <Radio size={size} />,
    FileSearch: <FileSearch size={size} />,
    Camera: <Camera size={size} />,
    Mic: <Mic size={size} />,
  };
  return iconMap[iconType] ?? <FileText size={size} />;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnalysisSection = 'summary' | 'pipeline' | 'timeline' | 'comparison' | 'officer' | 'policy' | 'inconsistencies' | 'exhibits';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseAnalysisSection() {
  const { caseId } = useParams<{ caseId: string }>();
  const [analysisData, setAnalysisData] = useState<CaseAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true, pipeline: false, timeline: false, comparison: false,
    officer: false, policy: false, inconsistencies: false, exhibits: false,
  });

  // Fetch analysis data from pipeline
  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis() {
      setLoading(true);
      try {
        const data = await fetchCaseAnalysis(caseId ?? 'demo');
        if (!cancelled) setAnalysisData(data);
      } catch (err) {
        console.error('[CaseAnalysisSection] Failed to load analysis:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAnalysis();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await triggerRegeneration(caseId ?? 'demo', 'manual_refresh');
      const data = await fetchCaseAnalysis(caseId ?? 'demo');
      setAnalysisData(data);
    } finally {
      setRegenerating(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Loading case analysis from evidence pipeline...</span>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">No analysis data available. Upload evidence to generate analysis.</p>
      </div>
    );
  }

  const sections: { id: AnalysisSection; title: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'summary', title: 'Evidence Summary', icon: <FileText size={18} /> },
    { id: 'pipeline', title: 'Processing Pipeline', icon: <Loader2 size={18} />, badge: `${analysisData.pipelineStatus.filter(s => s.status === 'completed').length}/${analysisData.pipelineStatus.length} stages` },
    { id: 'timeline', title: 'Timeline Reconstruction', icon: <Clock size={18} />, badge: `${analysisData.timelineEvents.length} events` },
    { id: 'comparison', title: 'Cross-Document Comparison', icon: <GitCompare size={18} />, badge: `${analysisData.crossDocComparisons.length} findings` },
    { id: 'officer', title: 'Officer Action Detection', icon: <Shield size={18} />, badge: `${analysisData.officerActions.length} actions` },
    { id: 'policy', title: 'Policy Comparison', icon: <Scale size={18} />, badge: `${analysisData.policyComparisons.length} observations` },
    { id: 'inconsistencies', title: 'Notable Inconsistencies', icon: <AlertTriangle size={18} />, badge: `${analysisData.inconsistencies.length} flagged` },
    { id: 'exhibits', title: 'Recommended Trial Exhibits', icon: <Layers size={18} />, badge: `${analysisData.recommendedExhibits.length} suggested` },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Complete Case Analysis</h2>
            <p className="text-xs text-gray-500 mt-1">
              {analysisData.cached ? 'Cached result' : 'Generated from evidence pipeline'} — {new Date(analysisData.generatedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {sections.map((section) => (
          <div key={section.id}>
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{section.icon}</span>
                <span className="font-semibold text-gray-900 text-sm">{section.title}</span>
                {section.badge && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">{section.badge}</span>
                )}
              </div>
              {expandedSections[section.id] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>

            {expandedSections[section.id] && (
              <div className="px-6 pb-4">
                {/* Evidence Summary */}
                {section.id === 'summary' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {analysisData.evidenceSummary.map((item: EvidenceSummaryItem) => (
                      <div key={item.type} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-400">{getIcon(item.iconType)}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.type}</p>
                          <p className="text-lg font-bold text-blue-600">{item.count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pipeline Status */}
                {section.id === 'pipeline' && (
                  <div className="space-y-2">
                    {analysisData.pipelineStatus.map((stage: PipelineStageStatus) => (
                      <div key={stage.stage} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${
                            stage.status === 'completed' ? 'bg-green-500' :
                            stage.status === 'running' ? 'bg-blue-500 animate-pulse' :
                            stage.status === 'failed' ? 'bg-red-500' :
                            stage.status === 'skipped' ? 'bg-gray-300' :
                            'bg-gray-300'
                          }`} />
                          <span className="text-sm font-medium text-gray-900">{stage.stage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {stage.durationMs !== undefined && (
                            <span className="text-xs text-gray-500">{stage.durationMs}ms</span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            stage.status === 'completed' ? 'bg-green-100 text-green-700' :
                            stage.status === 'running' ? 'bg-blue-100 text-blue-700' :
                            stage.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {stage.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                {section.id === 'timeline' && (
                  <div className="space-y-2">
                    {analysisData.timelineEvents.map((event: TimelineEvent) => (
                      <div key={event.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">{event.timestamp}</span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{safeText(event.description)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">Source: {event.source}</span>
                            {event.confidence >= 0.85 && (
                              <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-medium">High conf</span>
                            )}
                            <span className="text-[9px] text-gray-400 font-mono">{event.sourceFileId}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cross-Document Comparison */}
                {section.id === 'comparison' && (
                  <div className="space-y-4">
                    {analysisData.crossDocComparisons.map((comp: CrossDocComparison) => (
                      <div key={comp.id} className={`p-4 rounded-lg border-l-4 ${
                        comp.severity === 'high' ? 'bg-red-50 border-red-400' :
                        comp.severity === 'medium' ? 'bg-amber-50 border-amber-400' :
                        'bg-blue-50 border-blue-400'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-gray-600">{comp.sourceA}</span>
                          <span className="text-xs text-gray-400">vs</span>
                          <span className="text-xs font-mono text-gray-600">{comp.sourceB}</span>
                        </div>
                        <p className="text-sm text-gray-800">{safeText(comp.observation)}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[9px] text-gray-400 font-mono">{comp.sourceAFileId}</span>
                          <span className="text-[9px] text-gray-400 font-mono">{comp.sourceBFileId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Officer Actions */}
                {section.id === 'officer' && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Officer</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Action</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Timestamp</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Source</th>
                        <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisData.officerActions.map((action: OfficerAction) => (
                        <tr key={action.id} className="border-b border-gray-50">
                          <td className="py-2 px-2 text-gray-900 font-medium">{action.officerId}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{action.actionType}</span>
                          </td>
                          <td className="py-2 px-2 text-gray-600 font-mono text-xs">{action.timestamp}</td>
                          <td className="py-2 px-2 text-gray-500 text-xs">{action.evidenceSource}</td>
                          <td className="py-2 px-2">
                            <span className={`text-xs font-medium ${action.confidence >= 0.85 ? 'text-green-600' : action.confidence >= 0.7 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {(action.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Policy Comparison */}
                {section.id === 'policy' && (
                  <div className="space-y-4">
                    {analysisData.policyComparisons.map((pc: PolicyComparison) => (
                      <div key={pc.id} className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-purple-700">Officer action: {pc.officerAction}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            pc.confidence >= 0.8 ? 'bg-purple-200 text-purple-800' : 'bg-purple-100 text-purple-600'
                          }`}>
                            {(pc.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-xs text-purple-600 mb-2">Policy reference: {pc.policyReference}</p>
                        <p className="text-sm text-gray-800">{safeText(pc.observation)}</p>
                        <p className="text-[9px] text-gray-400 font-mono mt-1">Finding: {pc.findingId} | Evidence: {pc.evidenceFileId}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inconsistencies */}
                {section.id === 'inconsistencies' && (
                  <div className="space-y-3">
                    {analysisData.inconsistencies.map((inc: Inconsistency) => (
                      <div key={inc.id} className={`p-4 rounded-lg border ${
                        inc.severity === 'high' ? 'bg-red-50 border-red-200' : inc.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle size={14} className={inc.severity === 'high' ? 'text-red-500' : 'text-amber-500'} />
                          <span className={`text-xs font-bold ${inc.severity === 'high' ? 'text-red-700' : 'text-amber-700'}`}>
                            {inc.severity.toUpperCase()} — {inc.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mb-2">{safeText(inc.description)}</p>
                        <div className="flex flex-wrap gap-2">
                          {inc.sources.map((src) => (
                            <span key={`${src.fileId}-${src.timestamp ?? src.paragraph ?? ''}`} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-white border border-gray-200 rounded font-mono text-gray-600">
                              <ExternalLink size={8} />
                              {src.label}
                              {src.timestamp ? ` — ${src.timestamp}` : ''}
                              {src.paragraph ? ` — ${src.paragraph}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommended Exhibits */}
                {section.id === 'exhibits' && (
                  <div className="grid md:grid-cols-2 gap-3">
                    {analysisData.recommendedExhibits.map((exhibit: RecommendedExhibit) => (
                      <div key={exhibit.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers size={14} className="text-blue-600" />
                          <h4 className="font-semibold text-blue-900 text-sm">{exhibit.title}</h4>
                        </div>
                        <span className="inline-block px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-[10px] font-medium mb-2">{exhibit.type}</span>
                        <div className="flex flex-wrap gap-1">
                          {exhibit.linkedEvidence.map((ev) => (
                            <span key={`${ev.fileId}-${ev.label}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-white border border-blue-100 rounded text-blue-700">
                              <ExternalLink size={8} />
                              {ev.label}
                            </span>
                          ))}
                        </div>
                        <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                          Open in Trial Exhibit System <ExternalLink size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
