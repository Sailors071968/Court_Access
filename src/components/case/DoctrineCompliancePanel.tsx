// ============================================
// Court Access — Doctrine Compliance Panel
// Displays POST training doctrine compliance
// analysis results for evidence text.
// ============================================

import { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, AlertCircle, CheckCircle,
  ChevronDown, ChevronUp, RefreshCw, Loader2,
  BookOpen, Scale, ExternalLink,
} from 'lucide-react';
import {
  analyzeDoctrineCompliance,
  fetchDoctrineStatus,
} from '../../services/doctrineService';
import type {
  DoctrineComplianceResponse,
  DoctrineMatchResult,
  DoctrineStatusResponse,
} from '../../services/doctrineService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DoctrineCompliancePanelProps {
  /** Evidence text to analyze. If not provided, shows status overview. */
  evidenceText?: string;
  /** Auto-analyze on mount */
  autoAnalyze?: boolean;
  /** Compact mode for sidebar display */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Category Colors & Labels
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  // LD-15: Laws of Arrest
  constitutional: { color: 'text-violet-300', bg: 'bg-violet-500/10', label: 'Constitutional' },
  encounter: { color: 'text-blue-300', bg: 'bg-blue-500/10', label: 'Encounter' },
  detention: { color: 'text-amber-300', bg: 'bg-amber-500/10', label: 'Detention' },
  search: { color: 'text-orange-700', bg: 'bg-orange-50', label: 'Search' },
  arrest: { color: 'text-red-300', bg: 'bg-red-500/10', label: 'Arrest' },
  miranda: { color: 'text-indigo-300', bg: 'bg-indigo-500/10', label: 'Miranda' },
  interrogation: { color: 'text-pink-700', bg: 'bg-pink-50', label: 'Interrogation' },
  use_of_force: { color: 'text-rose-300', bg: 'bg-rose-500/10', label: 'Use of Force' },
  pursuit: { color: 'text-cyan-700', bg: 'bg-cyan-50', label: 'Pursuit' },
  // LD-17: Presentation of Evidence
  evidence_presentation: { color: 'text-violet-300', bg: 'bg-violet-500/10', label: 'Evidence Presentation' },
  chain_of_custody: { color: 'text-fuchsia-700', bg: 'bg-fuchsia-50', label: 'Chain of Custody' },
  testimony: { color: 'text-sky-300', bg: 'bg-sky-500/10', label: 'Testimony' },
  // LD-18: Report Writing
  report_writing: { color: 'text-teal-700', bg: 'bg-teal-50', label: 'Report Writing' },
  // LD-24 & LD-30: Evidence Handling & Crime Scene
  evidence_handling: { color: 'text-lime-700', bg: 'bg-lime-50', label: 'Evidence Handling' },
  evidence_collection: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', label: 'Evidence Collection' },
  crime_scene: { color: 'text-stone-700', bg: 'bg-stone-50', label: 'Crime Scene' },
  // LD-21: Patrol
  patrol: { color: 'text-slate-200', bg: 'bg-white/5', label: 'Patrol' },
  field_contact: { color: 'text-zinc-700', bg: 'bg-zinc-50', label: 'Field Contact' },
  general: { color: 'text-slate-200', bg: 'bg-white/5', label: 'General' },
};

const FLAG_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  violation: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20', label: 'Violation' },
  concern: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Concern' },
  compliant: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Compliant' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DoctrineCompliancePanel({
  evidenceText,
  autoAnalyze = false,
  compact = false,
}: DoctrineCompliancePanelProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(false);
  const [compliance, setCompliance] = useState<DoctrineComplianceResponse | null>(null);
  const [status, setStatus] = useState<DoctrineStatusResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Load status on mount
  useEffect(() => {
    fetchDoctrineStatus().then(setStatus).catch(() => {});
  }, []);

  // Auto-analyze if evidence text is provided
  useEffect(() => {
    if (evidenceText && autoAnalyze) {
      runAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceText, autoAnalyze]);

  async function runAnalysis() {
    if (!evidenceText) return;
    setIsLoading(true);
    try {
      const result = await analyzeDoctrineCompliance(evidenceText);
      setCompliance(result);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter matches
  const filteredMatches = compliance?.matches.filter((m) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'violations') return m.flagType === 'violation';
    if (activeFilter === 'concerns') return m.flagType === 'concern';
    if (activeFilter === 'compliant') return m.flagType === 'compliant';
    return m.category === activeFilter;
  }) ?? [];

  // Overall compliance badge
  const complianceBadge = compliance ? (
    compliance.overallCompliance === 'violations' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-300">
        <AlertTriangle size={12} /> {compliance.violations} Violation{compliance.violations !== 1 ? 's' : ''}
      </span>
    ) : compliance.overallCompliance === 'concerns' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300">
        <AlertCircle size={12} /> {compliance.concerns} Concern{compliance.concerns !== 1 ? 's' : ''}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300">
        <CheckCircle size={12} /> Compliant
      </span>
    )
  ) : null;

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Shield size={20} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-white">
              Police Training Doctrine Compliance
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              POST LD-15/16/17/18/20/21/24/30 {status ? `\u2022 ${status.totalRules} doctrine rules \u2022 ${Object.keys(status.rulesBySource).length} domains` : ''}
            </p>
          </div>
          {complianceBadge}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 size={16} className="animate-spin text-indigo-500" />}
          {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-white/10">
          {/* Status Overview */}
          {status && !compliance && (
            <div className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-indigo-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-300">{status.totalRules}</p>
                  <p className="text-xs text-indigo-600 mt-1">Doctrine Rules</p>
                </div>
                <div className="bg-violet-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-violet-300">{Object.keys(status.rulesByCategory).length}</p>
                  <p className="text-xs text-purple-600 mt-1">Categories</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-300">{status.totalEmbeddings}</p>
                  <p className="text-xs text-gold-light mt-1">Embeddings</p>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-300">{Object.keys(status.rulesBySource).length}</p>
                  <p className="text-xs text-green-600 mt-1">Sources</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-200 mb-2">Doctrine Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(status.rulesByCategory).map(([cat, count]) => {
                    const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['general'];
                    return (
                      <span key={cat} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        {config.label}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Analyze Button */}
              {evidenceText && (
                <button
                  onClick={runAnalysis}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Scale size={16} />}
                  Analyze Evidence for Doctrine Compliance
                </button>
              )}

              {!evidenceText && (
                <div className="bg-white/5 rounded-lg p-3 text-center text-sm text-slate-400">
                  <BookOpen size={20} className="mx-auto mb-2 text-slate-400" />
                  Select evidence to analyze against POST training doctrine
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && !compliance && (
            <div className="mt-4 flex items-center justify-center py-8 text-sm text-indigo-600">
              <Loader2 size={20} className="animate-spin mr-2" />
              Analyzing evidence against {status?.totalRules ?? 45} doctrine rules...
            </div>
          )}

          {/* Compliance Results */}
          {compliance && (
            <div className="mt-4">
              {/* Summary Bar */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-sm font-medium text-red-300">{compliance.violations}</span>
                  <span className="text-xs text-slate-400">violations</span>
                </div>
                <div className="w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-500" />
                  <span className="text-sm font-medium text-amber-300">{compliance.concerns}</span>
                  <span className="text-xs text-slate-400">concerns</span>
                </div>
                <div className="w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-green-500" />
                  <span className="text-sm font-medium text-emerald-300">{compliance.compliant}</span>
                  <span className="text-xs text-slate-400">compliant</span>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={runAnalysis}
                    disabled={isLoading}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                    title="Re-analyze"
                  >
                    <RefreshCw size={14} className={`text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-1 mb-4">
                {['all', 'violations', 'concerns', 'compliant'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeFilter === filter
                        ? 'bg-indigo-100 text-indigo-300'
                        : 'bg-white/10 text-slate-300 hover:bg-gray-200'
                    }`}
                  >
                    {filter === 'all' ? `All (${compliance.matches.length})` :
                     filter === 'violations' ? `Violations (${compliance.violations})` :
                     filter === 'concerns' ? `Concerns (${compliance.concerns})` :
                     `Compliant (${compliance.compliant})`}
                  </button>
                ))}
              </div>

              {/* Match Cards */}
              <div className="space-y-3">
                {filteredMatches.map((match) => (
                  <DoctrineMatchCard key={match.doctrineId} match={match} />
                ))}
              </div>

              {filteredMatches.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4">
                  No matches for the selected filter.
                </p>
              )}

              {/* Attribution */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <span>Source: California POST Training Standards</span>
                <span>Checked {compliance.totalRulesChecked} rules \u2022 {new Date(compliance.analyzedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doctrine Match Card
// ---------------------------------------------------------------------------

function DoctrineMatchCard({ match }: { match: DoctrineMatchResult }) {
  const [expanded, setExpanded] = useState(match.flagType === 'violation');
  const flagConfig = FLAG_CONFIG[match.flagType] || FLAG_CONFIG['compliant'];
  const catConfig = CATEGORY_CONFIG[match.category] || CATEGORY_CONFIG['general'];
  const FlagIcon = flagConfig.icon;

  return (
    <div className={`rounded-lg border p-3 ${flagConfig.bg} transition-all`}>
      <div className="flex items-start gap-3">
        <FlagIcon size={18} className={`${flagConfig.color} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${flagConfig.color}`}>
              {flagConfig.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catConfig.bg} ${catConfig.color}`}>
              {catConfig.label}
            </span>
            <span className="text-xs text-slate-400">
              {match.chapter} \u2022 {match.topic}
            </span>
            <span className="ml-auto text-xs font-mono text-slate-400" title={`Raw: ${Math.round(match.similarityScore * 100)}%`}>
              {Math.round((match.effectiveSimilarity ?? match.similarityScore) * 100)}%
            </span>
          </div>

          <p className="text-sm text-slate-100 mt-1.5 leading-relaxed">
            {match.ruleText}
          </p>

          {expanded && (
            <div className="mt-2 space-y-2">
              {match.legalImplication && (
                <div className="bg-white/60 rounded-md p-2 text-xs text-slate-300">
                  <span className="font-medium text-slate-200">Legal Implication: </span>
                  {match.legalImplication}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono">{match.doctrineId}</span>
                <span>\u2022</span>
                <span>{match.source}</span>
                <a
                  href="https://post.ca.gov/training"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-300"
                >
                  POST Reference <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>
    </div>
  );
}
