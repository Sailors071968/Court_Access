// ============================================================================
// Phase 257 — Complete Case Analysis Engine (Overview Section)
// Rendered inside CaseOverviewPage
// ============================================================================

import { useState } from 'react';
import {
  FileText, Clock, GitCompare, Shield, AlertTriangle,
  Layers, ChevronDown, ChevronRight, ExternalLink,
  Video, Radio, Users, FileSearch, Scale,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceSummaryItem {
  type: string;
  count: number;
  icon: React.ReactNode;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  source: string;
  description: string;
  sourceType: 'bodycam' | 'dispatch' | '911' | 'officer_report' | 'witness';
}

interface CrossDocComparison {
  id: string;
  sourceA: string;
  sourceB: string;
  observation: string;
  severity: 'high' | 'medium' | 'low';
}

interface OfficerAction {
  id: string;
  officerId: string;
  actionType: string;
  timestamp: string;
  evidenceSource: string;
}

interface PolicyComparison {
  id: string;
  officerAction: string;
  policyReference: string;
  observation: string;
}

interface Inconsistency {
  id: string;
  type: string;
  description: string;
  sources: string[];
  severity: 'high' | 'medium' | 'low';
}

interface RecommendedExhibit {
  id: string;
  title: string;
  type: string;
  linkedEvidence: string[];
}

type AnalysisSection = 'summary' | 'timeline' | 'comparison' | 'officer' | 'policy' | 'inconsistencies' | 'exhibits';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const EVIDENCE_SUMMARY: EvidenceSummaryItem[] = [
  { type: 'Police Reports', count: 3, icon: <FileText size={16} /> },
  { type: 'Bodycam Videos', count: 7, icon: <Video size={16} /> },
  { type: 'Dashcam Videos', count: 2, icon: <Video size={16} /> },
  { type: 'Witness Statements', count: 5, icon: <Users size={16} /> },
  { type: 'Dispatch Audio', count: 1, icon: <Radio size={16} /> },
  { type: 'Forensic Reports', count: 2, icon: <FileSearch size={16} /> },
];

const TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 't1', timestamp: '14:22:03', source: 'Dispatch Log', description: '911 call received — report of disturbance at 1200 Oak Ave', sourceType: '911' },
  { id: 't2', timestamp: '14:24:15', source: 'Dispatch Log', description: 'Unit 42 dispatched to scene', sourceType: 'dispatch' },
  { id: 't3', timestamp: '14:31:42', source: 'Bodycam 1', description: 'Officer Martinez arrives on scene', sourceType: 'bodycam' },
  { id: 't4', timestamp: '14:32:18', source: 'Bodycam 1', description: 'Initial contact with suspect', sourceType: 'bodycam' },
  { id: 't5', timestamp: '14:33:05', source: 'Officer Report', description: 'Officer reports suspect began running', sourceType: 'officer_report' },
  { id: 't6', timestamp: '14:33:12', source: 'Bodycam 2', description: 'Bodycam shows suspect stationary at this timestamp', sourceType: 'bodycam' },
  { id: 't7', timestamp: '14:34:30', source: 'Witness Statement', description: 'Witness reports hearing officer commands', sourceType: 'witness' },
  { id: 't8', timestamp: '14:35:15', source: 'Dispatch Log', description: 'Backup units requested', sourceType: 'dispatch' },
];

const CROSS_DOC_COMPARISONS: CrossDocComparison[] = [
  { id: 'cd1', sourceA: 'Officer Report (pg 3, para 2)', sourceB: 'Bodycam 1 Transcript (14:33:05)', observation: 'Officer report states suspect was running. Bodycam transcript indicates suspect was stationary. Possible narrative discrepancy between officer report and bodycam footage.', severity: 'high' },
  { id: 'cd2', sourceA: 'Dispatch Log (14:24:15)', sourceB: 'Officer Report (pg 1)', observation: 'Dispatch log shows Unit 42 dispatched at 14:24. Officer report states arrival at 14:28. Response time of 4 minutes is within expected range.', severity: 'low' },
  { id: 'cd3', sourceA: 'Witness Statement #3', sourceB: 'Bodycam 2 Transcript', observation: 'Witness reports suspect had hands raised. Bodycam 2 partially corroborates but camera angle limits visibility.', severity: 'medium' },
];

const OFFICER_ACTIONS: OfficerAction[] = [
  { id: 'oa1', officerId: 'Martinez #4821', actionType: 'detention', timestamp: '14:32:18', evidenceSource: 'Bodycam 1' },
  { id: 'oa2', officerId: 'Martinez #4821', actionType: 'pursuit', timestamp: '14:33:05', evidenceSource: 'Officer Report' },
  { id: 'oa3', officerId: 'Martinez #4821', actionType: 'use_of_force', timestamp: '14:34:00', evidenceSource: 'Bodycam 1' },
  { id: 'oa4', officerId: 'Chen #5102', actionType: 'handcuffing', timestamp: '14:36:20', evidenceSource: 'Bodycam 2' },
  { id: 'oa5', officerId: 'Chen #5102', actionType: 'search', timestamp: '14:37:45', evidenceSource: 'Bodycam 2' },
];

const POLICY_COMPARISONS: PolicyComparison[] = [
  { id: 'pc1', officerAction: 'Foot pursuit initiated', policyReference: 'Sacramento PD Foot Pursuit Policy (Section 4.2)', observation: 'Potential policy inconsistency regarding supervisor notification timing.' },
  { id: 'pc2', officerAction: 'Use of force during detention', policyReference: 'Sacramento PD Use of Force Policy (Section 2.1)', observation: 'Evidence suggests force application occurred prior to verbal commands documented in policy requirements.' },
  { id: 'pc3', officerAction: 'Vehicle stop duration', policyReference: 'CHP Vehicle Stop Policy (Fallback)', observation: 'Stop duration of 42 minutes exceeds typical guidelines. Further review recommended.' },
];

const INCONSISTENCIES: Inconsistency[] = [
  { id: 'inc1', type: 'report_vs_camera', description: 'Officer report states suspect resisted arrest. Bodycam footage does not clearly show resistance. Potential narrative inconsistency detected.', sources: ['Officer Report pg 4', 'Bodycam 1 (14:34:00)'], severity: 'high' },
  { id: 'inc2', type: 'timeline_conflict', description: 'Radio dispatch log shows backup requested at 14:35:15. Officer report states backup arrived before force was used at 14:34:00. Timeline sequence inconsistency.', sources: ['Dispatch Log', 'Officer Report pg 5'], severity: 'high' },
  { id: 'inc3', type: 'statement_vs_camera', description: 'Witness #2 states officer was in uniform. Bodycam footage confirms plainclothes at time of initial contact. Discrepancy in witness identification.', sources: ['Witness Statement #2', 'Bodycam 1 (14:31:42)'], severity: 'medium' },
];

const RECOMMENDED_EXHIBITS: RecommendedExhibit[] = [
  { id: 're1', title: 'Timeline Comparison: Report vs Bodycam', type: 'timeline', linkedEvidence: ['Officer Report', 'Bodycam 1', 'Dispatch Log'] },
  { id: 're2', title: 'Officer Report vs Bodycam Visual Comparison', type: 'comparison', linkedEvidence: ['Officer Report pg 3-4', 'Bodycam 1 (14:33-14:35)'] },
  { id: 're3', title: 'Scene Reconstruction — 1200 Oak Ave', type: 'scene', linkedEvidence: ['Bodycam 1', 'Bodycam 2', 'Scene Photos', 'Witness Statements'] },
  { id: 're4', title: 'Policy Compliance Analysis Exhibit', type: 'policy', linkedEvidence: ['Use of Force Report', 'Sacramento PD Policy Manual'] },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseAnalysisSection() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true, timeline: false, comparison: false, officer: false, policy: false, inconsistencies: false, exhibits: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const sections: { id: AnalysisSection; title: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'summary', title: 'Evidence Summary', icon: <FileText size={18} /> },
    { id: 'timeline', title: 'Timeline Reconstruction', icon: <Clock size={18} />, badge: `${TIMELINE_EVENTS.length} events` },
    { id: 'comparison', title: 'Cross-Document Comparison', icon: <GitCompare size={18} />, badge: `${CROSS_DOC_COMPARISONS.length} findings` },
    { id: 'officer', title: 'Officer Action Detection', icon: <Shield size={18} />, badge: `${OFFICER_ACTIONS.length} actions` },
    { id: 'policy', title: 'Policy Comparison', icon: <Scale size={18} />, badge: `${POLICY_COMPARISONS.length} observations` },
    { id: 'inconsistencies', title: 'Notable Inconsistencies', icon: <AlertTriangle size={18} />, badge: `${INCONSISTENCIES.length} flagged` },
    { id: 'exhibits', title: 'Recommended Trial Exhibits', icon: <Layers size={18} />, badge: `${RECOMMENDED_EXHIBITS.length} suggested` },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <h2 className="text-lg font-bold text-gray-900">Complete Case Analysis</h2>
        <p className="text-xs text-gray-500 mt-1">Auto-generated analysis — regenerates when evidence changes</p>
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
                    {EVIDENCE_SUMMARY.map((item) => (
                      <div key={item.type} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-400">{item.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.type}</p>
                          <p className="text-lg font-bold text-blue-600">{item.count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                {section.id === 'timeline' && (
                  <div className="space-y-2">
                    {TIMELINE_EVENTS.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">{event.timestamp}</span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{event.description}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Source: {event.source}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cross-Document Comparison */}
                {section.id === 'comparison' && (
                  <div className="space-y-4">
                    {CROSS_DOC_COMPARISONS.map((comp) => (
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
                        <p className="text-sm text-gray-800">{comp.observation}</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {OFFICER_ACTIONS.map((action) => (
                        <tr key={action.id} className="border-b border-gray-50">
                          <td className="py-2 px-2 text-gray-900 font-medium">{action.officerId}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{action.actionType}</span>
                          </td>
                          <td className="py-2 px-2 text-gray-600 font-mono text-xs">{action.timestamp}</td>
                          <td className="py-2 px-2 text-gray-500 text-xs">{action.evidenceSource}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Policy Comparison */}
                {section.id === 'policy' && (
                  <div className="space-y-4">
                    {POLICY_COMPARISONS.map((pc) => (
                      <div key={pc.id} className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                        <p className="text-xs font-semibold text-purple-700 mb-1">Officer action: {pc.officerAction}</p>
                        <p className="text-xs text-purple-600 mb-2">Policy reference: {pc.policyReference}</p>
                        <p className="text-sm text-gray-800">{pc.observation}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inconsistencies */}
                {section.id === 'inconsistencies' && (
                  <div className="space-y-3">
                    {INCONSISTENCIES.map((inc) => (
                      <div key={inc.id} className={`p-4 rounded-lg border ${
                        inc.severity === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle size={14} className={inc.severity === 'high' ? 'text-red-500' : 'text-amber-500'} />
                          <span className={`text-xs font-bold ${inc.severity === 'high' ? 'text-red-700' : 'text-amber-700'}`}>
                            {inc.severity.toUpperCase()} — {inc.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mb-2">{inc.description}</p>
                        <div className="flex gap-2">
                          {inc.sources.map((src) => (
                            <span key={src} className="text-[10px] px-2 py-0.5 bg-white border border-gray-200 rounded font-mono text-gray-600">{src}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommended Exhibits */}
                {section.id === 'exhibits' && (
                  <div className="grid md:grid-cols-2 gap-3">
                    {RECOMMENDED_EXHIBITS.map((exhibit) => (
                      <div key={exhibit.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers size={14} className="text-blue-600" />
                          <h4 className="font-semibold text-blue-900 text-sm">{exhibit.title}</h4>
                        </div>
                        <span className="inline-block px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-[10px] font-medium mb-2">{exhibit.type}</span>
                        <div className="flex flex-wrap gap-1">
                          {exhibit.linkedEvidence.map((ev) => (
                            <span key={ev} className="text-[10px] px-1.5 py-0.5 bg-white border border-blue-100 rounded text-blue-700">{ev}</span>
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
