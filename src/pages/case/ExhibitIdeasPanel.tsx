// ============================================
// Court Access — Exhibit Ideas Panel
// Displays AI-suggested trial exhibits with
// save, generate, and dismiss controls.
// ============================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Lightbulb,
  Save,
  Play,
  X,
  AlertTriangle,
  Clock,
  MessageSquare,
  GitCompare,
  Map,
  Link2,
  Network,
  Shield,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';
import { Card } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExhibitIdeaStatus = 'suggested' | 'saved' | 'dismissed' | 'generated';

type ExhibitType =
  | 'timeline_comparison'
  | 'testimony_vs_transcript'
  | 'officer_movement_map'
  | 'chain_of_custody_flow'
  | 'evidence_relationship_graph'
  | 'narrative_conflict_visualization';

interface ExhibitIdea {
  id: string;
  caseId: string;
  title: string;
  description: string;
  exhibitType: ExhibitType;
  evidenceIds: string[];
  conflictIds: string[];
  priorityScore: number;
  status: ExhibitIdeaStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Exhibit Type Config
// ---------------------------------------------------------------------------

const EXHIBIT_TYPE_CONFIG: Record<ExhibitType, {
  label: string;
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
}> = {
  timeline_comparison: {
    label: 'Timeline Comparison',
    icon: Clock,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  testimony_vs_transcript: {
    label: 'Testimony vs. Transcript',
    icon: MessageSquare,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  officer_movement_map: {
    label: 'Officer Movement Map',
    icon: Map,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  chain_of_custody_flow: {
    label: 'Chain of Custody Flow',
    icon: Link2,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  evidence_relationship_graph: {
    label: 'Evidence Relationship Graph',
    icon: Network,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
  },
  narrative_conflict_visualization: {
    label: 'Narrative Conflict Visualization',
    icon: GitCompare,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
};

// ---------------------------------------------------------------------------
// Priority Badge
// ---------------------------------------------------------------------------

function PriorityBadge({ score }: { score: number }) {
  let label: string;
  let bgColor: string;
  let textColor: string;

  if (score >= 0.85) {
    label = 'Critical';
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
  } else if (score >= 0.65) {
    label = 'High';
    bgColor = 'bg-orange-100';
    textColor = 'text-orange-800';
  } else if (score >= 0.40) {
    label = 'Medium';
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
  } else {
    label = 'Low';
    bgColor = 'bg-gray-100';
    textColor = 'text-gray-700';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${bgColor} ${textColor}`}>
      <Star size={10} />
      {label} ({(score * 100).toFixed(0)}%)
    </span>
  );
}

// ---------------------------------------------------------------------------
// Demo Data
// ---------------------------------------------------------------------------

function getDemoExhibitIdeas(caseId: string): ExhibitIdea[] {
  return [
    {
      id: 'exhibit-idea-001',
      caseId,
      title: 'Timeline Comparison: 19-minute timeline gap detected',
      description:
        'Gap between "Officer filed arrest report" (Officer Report) at 10:02 and ' +
        '"Dispatch confirms arrival" (Dispatch Log) at 10:21. A timeline comparison ' +
        'exhibit could help a jury visualize the 19-minute unexplained gap.\n\n' +
        'Recommended Visual: A side-by-side timeline showing conflicting accounts or unexplained gaps.\n\n' +
        'Evidence Items: 2',
      exhibitType: 'timeline_comparison',
      evidenceIds: ['ev-officer-report-001', 'ev-dispatch-log-001'],
      conflictIds: [],
      priorityScore: 0.82,
      status: 'suggested',
      createdAt: '2026-03-07T14:30:00Z',
    },
    {
      id: 'exhibit-idea-002',
      caseId,
      title: 'Testimony vs. Record Comparison: Officer Williams vs Bodycam',
      description:
        'Officer testimony states "Suspect exited vehicle immediately" but bodycam transcript ' +
        'shows officer ordering suspect to exit twice before compliance. A comparison chart ' +
        'showing the contradicting testimony side-by-side would help a jury understand the inconsistency.\n\n' +
        'Recommended Visual: A comparison chart placing official testimony beside physical evidence.\n\n' +
        'Evidence Items: 3 | Conflicts Referenced: 1',
      exhibitType: 'testimony_vs_transcript',
      evidenceIds: ['ev-officer-testimony-001', 'ev-bodycam-001', 'ev-transcript-001'],
      conflictIds: ['conflict-testimony-001'],
      priorityScore: 0.78,
      status: 'suggested',
      createdAt: '2026-03-07T14:30:00Z',
    },
    {
      id: 'exhibit-idea-003',
      caseId,
      title: 'Chain of Custody Flow Diagram: 2 problem(s) with evidence EV-FIREARM-001',
      description:
        'Evidence item "EV-FIREARM-001" has 2 chain of custody issues: Missing transfer signature ' +
        'by Officer Chen at 2026-01-15T22:30:00Z; 36-hour gap between custody transfers. A chain ' +
        'of custody flow diagram would expose these gaps to the jury.\n\n' +
        'Recommended Visual: A flow diagram tracing evidence handling from collection to court.\n\n' +
        'Evidence Items: 1',
      exhibitType: 'chain_of_custody_flow',
      evidenceIds: ['ev-firearm-001'],
      conflictIds: [],
      priorityScore: 0.74,
      status: 'suggested',
      createdAt: '2026-03-07T14:35:00Z',
    },
    {
      id: 'exhibit-idea-004',
      caseId,
      title: 'Officer Movement Reconstruction: Officer Williams (8 events over 47 min)',
      description:
        'Officer "Officer Williams" has 8 timestamped events spanning 47 minutes. An officer ' +
        'movement map could reconstruct their actions and identify gaps or inconsistencies.\n\n' +
        'Recommended Visual: A chronological map of officer actions, positions, and timestamps.\n\n' +
        'Evidence Items: 8',
      exhibitType: 'officer_movement_map',
      evidenceIds: ['ev-timeline-001', 'ev-timeline-002', 'ev-timeline-003', 'ev-timeline-004', 'ev-timeline-005', 'ev-timeline-006', 'ev-timeline-007', 'ev-timeline-008'],
      conflictIds: [],
      priorityScore: 0.61,
      status: 'suggested',
      createdAt: '2026-03-07T14:40:00Z',
    },
    {
      id: 'exhibit-idea-005',
      caseId,
      title: 'Evidence Relationship Graph: 6 connected items around "Bodycam Footage"',
      description:
        'Evidence node "Bodycam Footage" is connected to 5 other nodes with average confidence 82%. ' +
        'An evidence relationship graph would show the jury how these pieces connect.\n\n' +
        'Recommended Visual: A network visualization showing how evidence items connect.\n\n' +
        'Evidence Items: 6',
      exhibitType: 'evidence_relationship_graph',
      evidenceIds: ['ev-bodycam-001', 'ev-transcript-001', 'ev-officer-report-001', 'ev-dispatch-log-001', 'ev-witness-stmt-001', 'ev-firearm-001'],
      conflictIds: [],
      priorityScore: 0.55,
      status: 'suggested',
      createdAt: '2026-03-07T14:45:00Z',
    },
    {
      id: 'exhibit-idea-006',
      caseId,
      title: 'Narrative Conflict Visualization: 3 related conflicts',
      description:
        '3 conflicts relate to "Cross-speaker timeline conflict: Officer Williams reports event at different time". ' +
        'Average severity: 72%. A narrative conflict visualization would show the jury how multiple ' +
        'inconsistencies compound around this event.\n\n' +
        'Recommended Visual: A visualization showing how multiple contradictions cluster.\n\n' +
        'Evidence Items: 5 | Conflicts Referenced: 3',
      exhibitType: 'narrative_conflict_visualization',
      evidenceIds: ['ev-officer-report-001', 'ev-dispatch-log-001', 'ev-bodycam-001', 'ev-witness-stmt-001', 'ev-witness-stmt-002'],
      conflictIds: ['conflict-timeline-001', 'conflict-testimony-001', 'conflict-timeline-002'],
      priorityScore: 0.69,
      status: 'suggested',
      createdAt: '2026-03-07T14:50:00Z',
    },
  ];
}

// ---------------------------------------------------------------------------
// Exhibit Ideas Panel Component
// ---------------------------------------------------------------------------

export function ExhibitIdeasPanel() {
  const { caseId } = useParams<{ caseId: string }>();
  const [ideas, setIdeas] = useState<ExhibitIdea[]>(() =>
    getDemoExhibitIdeas(caseId ?? 'case-001'),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ExhibitType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ExhibitIdeaStatus | 'all'>('all');

  // Filter ideas
  const filteredIdeas = ideas.filter(idea => {
    if (filterType !== 'all' && idea.exhibitType !== filterType) return false;
    if (filterStatus !== 'all' && idea.status !== filterStatus) return false;
    return true;
  });

  // Sort by priority score descending
  const sortedIdeas = [...filteredIdeas].sort((a, b) => b.priorityScore - a.priorityScore);

  // Action handlers
  const handleSave = (ideaId: string) => {
    setIdeas(prev =>
      prev.map(idea =>
        idea.id === ideaId ? { ...idea, status: 'saved' as const } : idea,
      ),
    );
  };

  const handleDismiss = (ideaId: string) => {
    setIdeas(prev =>
      prev.map(idea =>
        idea.id === ideaId ? { ...idea, status: 'dismissed' as const } : idea,
      ),
    );
  };

  const handleGenerate = (ideaId: string) => {
    setIdeas(prev =>
      prev.map(idea =>
        idea.id === ideaId ? { ...idea, status: 'generated' as const } : idea,
      ),
    );
  };

  const toggleExpand = (ideaId: string) => {
    setExpandedId(prev => (prev === ideaId ? null : ideaId));
  };

  // Counts
  const suggestedCount = ideas.filter(i => i.status === 'suggested').length;
  const savedCount = ideas.filter(i => i.status === 'saved').length;

  return (
    <div className="space-y-6">
      {/* AI Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>Important:</strong> These are AI-generated exhibit suggestions based on
          detected patterns in the evidence graph. All suggestions reference verified evidence
          IDs and conflict nodes. No facts are fabricated. Review all suggestions with your
          licensed attorney before use in court.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Suggested Trial Exhibits</h2>
          <p className="text-sm text-gray-500 mt-1">
            {suggestedCount} new suggestion{suggestedCount !== 1 ? 's' : ''} &middot; {savedCount} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Lightbulb size={20} className="text-amber-500" />
          <Shield size={16} className="text-green-600" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as ExhibitType | 'all')}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by exhibit type"
        >
          <option value="all">All Types</option>
          {(Object.keys(EXHIBIT_TYPE_CONFIG) as ExhibitType[]).map(type => (
            <option key={type} value={type}>
              {EXHIBIT_TYPE_CONFIG[type].label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as ExhibitIdeaStatus | 'all')}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="suggested">Suggested</option>
          <option value="saved">Saved</option>
          <option value="dismissed">Dismissed</option>
          <option value="generated">Generated</option>
        </select>
      </div>

      {/* Exhibit Idea Cards */}
      {sortedIdeas.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Lightbulb size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-500">No exhibit suggestions yet</h3>
            <p className="text-sm text-gray-400 mt-2">
              Suggestions will appear as evidence is analyzed and patterns are detected.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedIdeas.map(idea => {
            const typeConfig = EXHIBIT_TYPE_CONFIG[idea.exhibitType];
            const TypeIcon = typeConfig.icon;
            const isExpanded = expandedId === idea.id;

            return (
              <Card key={idea.id} className={idea.status === 'dismissed' ? 'opacity-50' : ''}>
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${typeConfig.bgColor} flex-shrink-0`}>
                        <TypeIcon size={18} className={typeConfig.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                          {idea.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          <PriorityBadge score={idea.priorityScore} />
                          {idea.status !== 'suggested' && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              idea.status === 'saved'
                                ? 'bg-green-100 text-green-700'
                                : idea.status === 'generated'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {idea.status.charAt(0).toUpperCase() + idea.status.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse */}
                    <button
                      onClick={() => toggleExpand(idea.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {/* Evidence & Conflict Counts */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Evidence: {idea.evidenceIds.length} item{idea.evidenceIds.length !== 1 ? 's' : ''}</span>
                    {idea.conflictIds.length > 0 && (
                      <span>Conflicts: {idea.conflictIds.length}</span>
                    )}
                  </div>

                  {/* Expanded Description */}
                  {isExpanded && (
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {idea.description}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {idea.status === 'suggested' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleSave(idea.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        <Save size={12} />
                        Save Idea
                      </button>
                      <button
                        onClick={() => handleGenerate(idea.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Play size={12} />
                        Generate Exhibit
                      </button>
                      <button
                        onClick={() => handleDismiss(idea.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        <X size={12} />
                        Dismiss
                      </button>
                    </div>
                  )}

                  {idea.status === 'saved' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleGenerate(idea.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Play size={12} />
                        Generate Exhibit
                      </button>
                      <button
                        onClick={() => handleDismiss(idea.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        <X size={12} />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
