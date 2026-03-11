// ============================================================================
// Phase 297 — Judge Intelligence Panel
// Displays judge rulings, motion stats, and frequently cited cases.
// Appears in the Litigation Strategy view.
// ============================================================================

import { useState, useEffect } from 'react';
import {
  User, ExternalLink, ChevronDown, ChevronRight,
  Loader2, Scale, Gavel, Shield, FileSearch, BarChart3,
} from 'lucide-react';
import {
  fetchJudgeIntelligence,
  type JudgeIntelligenceResult,
} from '../../services/caseLawService';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JudgeIntelligencePanelProps {
  judgeName: string;
  court?: string;
}

export function JudgeIntelligencePanel({ judgeName, court }: JudgeIntelligencePanelProps) {
  const [data, setData] = useState<JudgeIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const result = await fetchJudgeIntelligence(judgeName, court);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error('[JudgeIntelligencePanel] Load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (judgeName) {
      loadData();
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [judgeName, court]);

  if (!judgeName || loading) {
    if (loading && judgeName) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-indigo-500 mr-2" />
          <span className="text-sm text-gray-500">Loading judge intelligence...</span>
        </div>
      );
    }
    return null;
  }

  if (!data || data.totalRulings === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <User size={18} className="text-indigo-600" />
          <span className="font-semibold text-gray-900">Judge Intelligence</span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
            {data.totalRulings} rulings
          </span>
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* Judge Info */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Scale size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{data.judgeName}</p>
              <p className="text-xs text-gray-500">{data.court}</p>
            </div>
          </div>

          {/* Motion Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-1 mb-1">
                <Shield size={12} className="text-purple-600" />
                <span className="text-[10px] font-medium text-purple-700">Suppression</span>
              </div>
              <span className="text-lg font-bold text-purple-800">{data.motionStats.suppressionRulings}</span>
              <span className="text-[10px] text-purple-600 ml-1">rulings</span>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-1 mb-1">
                <Gavel size={12} className="text-red-600" />
                <span className="text-[10px] font-medium text-red-700">Brady</span>
              </div>
              <span className="text-lg font-bold text-red-800">{data.motionStats.bradyRulings}</span>
              <span className="text-[10px] text-red-600 ml-1">rulings</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-1 mb-1">
                <FileSearch size={12} className="text-emerald-600" />
                <span className="text-[10px] font-medium text-emerald-700">Discovery</span>
              </div>
              <span className="text-lg font-bold text-emerald-800">{data.motionStats.discoveryRulings}</span>
              <span className="text-[10px] text-emerald-600 ml-1">rulings</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1 mb-1">
                <BarChart3 size={12} className="text-gray-600" />
                <span className="text-[10px] font-medium text-gray-700">Total Motions</span>
              </div>
              <span className="text-lg font-bold text-gray-800">{data.motionStats.totalMotionRulings}</span>
              <span className="text-[10px] text-gray-600 ml-1">rulings</span>
            </div>
          </div>

          {/* Recent Rulings */}
          {data.recentRulings.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recent Rulings</h4>
              <div className="space-y-1">
                {data.recentRulings.slice(0, 5).map((ruling, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">{ruling.caseName}</span>
                      {ruling.citation && ruling.citation !== 'N/A' && (
                        <span className="text-[10px] font-mono text-gray-500">{ruling.citation}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{ruling.dateFiled}</span>
                      {ruling.url !== '#' && (
                        <a href={ruling.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frequently Cited Cases */}
          {data.frequentlyCitedCases.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Frequently Cited Cases</h4>
              <div className="space-y-1">
                {data.frequentlyCitedCases.map((cited, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">{cited.caseName}</span>
                      <span className="text-[10px] font-mono text-gray-500">{cited.citation}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                      cited {cited.citationCount}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
