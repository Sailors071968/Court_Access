// ============================================================================
// Phase 296 — Case Law Intelligence Panel
// Displays relevant precedents, recent cases, and citation summaries.
// Added to: Case Overview, Litigation Strategy, Motion Recommendations.
// Each precedent includes: case name, court, year, summary, CourtListener link.
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BookOpen, ExternalLink, Scale, ChevronDown, ChevronRight,
  Loader2, Search, RefreshCw, Shield, Gavel, FileSearch,
  AlertTriangle, Globe,
} from 'lucide-react';
import {
  fetchCaseLawIntelligence,
  type CaseLawPrecedent,
  type CaseLawIntelligence,
} from '../../services/caseLawService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  suppression: { label: 'Suppression', icon: <Shield size={12} />, color: 'bg-purple-100 text-purple-700' },
  brady: { label: 'Brady', icon: <AlertTriangle size={12} />, color: 'bg-red-100 text-red-700' },
  pitchess: { label: 'Pitchess', icon: <FileSearch size={12} />, color: 'bg-amber-100 text-amber-700' },
  use_of_force: { label: 'Use of Force', icon: <Gavel size={12} />, color: 'bg-orange-100 text-orange-700' },
  pursuit: { label: 'Pursuit', icon: <Scale size={12} />, color: 'bg-blue-100 text-blue-700' },
  miranda: { label: 'Miranda', icon: <Shield size={12} />, color: 'bg-indigo-100 text-indigo-700' },
  discovery: { label: 'Discovery', icon: <Search size={12} />, color: 'bg-emerald-100 text-emerald-700' },
  general: { label: 'General', icon: <BookOpen size={12} />, color: 'bg-gray-100 text-gray-600' },
};

function getRelevanceBadge(score: number): { label: string; color: string } {
  if (score >= 0.85) return { label: 'Highly Relevant', color: 'bg-green-100 text-green-700' };
  if (score >= 0.70) return { label: 'Relevant', color: 'bg-blue-100 text-blue-700' };
  return { label: 'Related', color: 'bg-gray-100 text-gray-600' };
}

// ---------------------------------------------------------------------------
// Precedent Card Component
// ---------------------------------------------------------------------------

function PrecedentCard({ precedent }: { precedent: CaseLawPrecedent }) {
  const categoryConfig = CATEGORY_LABELS[precedent.category] || CATEGORY_LABELS['general'];
  const relevance = getRelevanceBadge(precedent.relevanceScore);

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
      {/* Case Name + Year */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <a
            href={precedent.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
          >
            {precedent.caseName} ({precedent.year})
            <ExternalLink size={10} className="flex-shrink-0" />
          </a>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${relevance.color}`}>
          {relevance.label}
        </span>
      </div>

      {/* Citation + Court */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {precedent.citation && (
          <span className="text-xs font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
            {precedent.citation}
          </span>
        )}
        <span className="text-xs text-gray-500">{precedent.court}</span>
      </div>

      {/* Holding Summary */}
      {precedent.holdingSummary && (
        <p className="text-xs text-gray-700 leading-relaxed mb-2">
          <span className="font-medium">Holding:</span> {precedent.holdingSummary.substring(0, 300)}
          {precedent.holdingSummary.length > 300 ? '...' : ''}
        </p>
      )}

      {/* Footer: Category + Link */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${categoryConfig.color}`}>
          {categoryConfig.icon}
          {categoryConfig.label}
        </span>
        <a
          href={precedent.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium"
        >
          <Globe size={10} />
          View on CourtListener
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel Component
// ---------------------------------------------------------------------------

export function CaseLawIntelligencePanel() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<CaseLawIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const result = await fetchCaseLawIntelligence(caseId ?? 'demo', {
          jurisdiction: 'California',
          motionTypes: 'suppression,brady,pitchess',
        });
        if (!cancelled) setData(result);
      } catch (err) {
        console.error('[CaseLawIntelligencePanel] Load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [caseId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await fetchCaseLawIntelligence(caseId ?? 'demo', {
        jurisdiction: 'California',
        motionTypes: 'suppression,brady,pitchess',
      });
      setData(result);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Loading case law intelligence...</span>
      </div>
    );
  }

  if (!data || data.precedents.length === 0) {
    return null;
  }

  // Group by category
  const byCategory = new Map<string, CaseLawPrecedent[]>();
  for (const p of data.precedents) {
    const existing = byCategory.get(p.category) || [];
    existing.push(p);
    byCategory.set(p.category, existing);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-blue-600" />
          <span className="font-semibold text-gray-900">Case Law Intelligence</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
            {data.precedents.length} precedents
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={refreshing}
            className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Refresh case law"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* Source Attribution */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <Globe size={12} className="text-gray-400" />
            <span className="text-[10px] text-gray-500">
              Powered by CourtListener — Searched {new Date(data.searchedAt).toLocaleString()}
            </span>
          </div>

          {/* Precedent Cards by Category */}
          {Array.from(byCategory.entries()).map(([category, precedents]) => {
            const config = CATEGORY_LABELS[category] || CATEGORY_LABELS['general'];
            return (
              <div key={category} className="mb-4 last:mb-0">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  {config.icon}
                  {config.label} Precedent ({precedents.length})
                </h4>
                <div className="space-y-2">
                  {precedents.map((p) => (
                    <PrecedentCard key={p.id} precedent={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
