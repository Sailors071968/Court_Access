// ============================================================================
// Inconsistencies & Contradictions Table Page
// Route: /cases/:caseId/inconsistencies
//
// Requirement #3:
// - All inconsistencies and contradictions listed in table format
// - Rated 1-100 scale
// - Shareable form (text, email, print)
// ============================================================================

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Mail,
  Printer,
  Share2,
  MessageSquare,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  SortDesc,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { AnalysisProgressIndicator } from '../../components/common/AnalysisProgressIndicator';
import { AnalysisOutputWrapper } from '../../components/common/AnalysisOutputWrapper';
import { caseDataProvider } from '../../services/caseDataProvider';
import {
  analyzeFullCase,
  type FullCaseAnalysis,
  type Inconsistency,
} from '../../services/calcrim';
import { filterLegalAdviceLanguage } from '../../services/legalAdviceFilterEngine';
import { verifyClaim } from '../../services/aiGuardrailsEngine';
import { GuardrailStatusBanner } from '../../components/common/VerificationBadge';

function safeText(text: string): string {
  return filterLegalAdviceLanguage(text).filteredText;
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
// Helpers
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-gray-100 text-gray-700';
  if (score >= 80) color = 'bg-red-100 text-red-800';
  else if (score >= 60) color = 'bg-orange-100 text-orange-800';
  else if (score >= 40) color = 'bg-amber-100 text-amber-800';
  else if (score >= 20) color = 'bg-yellow-100 text-yellow-800';

  return (
    <span className={`inline-flex items-center justify-center w-12 h-7 rounded-lg text-sm font-bold ${color}`}>
      {score}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    timeline: 'bg-blue-100 text-blue-700',
    narrative: 'bg-purple-100 text-purple-700',
    physical: 'bg-green-100 text-green-700',
    witness: 'bg-teal-100 text-teal-700',
    procedural: 'bg-red-100 text-red-700',
    documentary: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Share Helpers
// ---------------------------------------------------------------------------

function formatInconsistenciesForText(
  inconsistencies: Inconsistency[],
  caseTitle: string
): string {
  let text = `INCONSISTENCIES & CONTRADICTIONS REPORT\n`;
  text += `Case: ${caseTitle}\n`;
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Total Findings: ${inconsistencies.length}\n`;
  text += `${'='.repeat(60)}\n\n`;

  for (const [idx, inc] of inconsistencies.entries()) {
    text += `#${idx + 1} — Score: ${inc.score}/100 — [${inc.category.toUpperCase()}]\n`;
    text += `${safeText(inc.description)}\n`;
    text += `Sources: ${inc.sources.join(', ')}\n`;
    text += `Recommendation: ${safeText(inc.recommendation)}\n`;
    text += `${'-'.repeat(40)}\n\n`;
  }

  text += `\nDISCLAIMER: This report is generated for informational purposes only `;
  text += `and does not constitute legal advice. All findings must be reviewed `;
  text += `by a licensed attorney.\n`;

  return text;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function InconsistenciesTablePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<FullCaseAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const charges = caseDataProvider.getCharges(caseId);
  const documents = caseDataProvider.getDocuments(caseId);
  const currentCase = caseDataProvider.getCaseById(caseId ?? '');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runAnalysis = useCallback(() => {
    // Cancel any in-flight analysis to prevent interval duplication
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsAnalyzing(true);
    setProgress(0);

    const steps = 15;
    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      setProgress(Math.min(95, (step / steps) * 100));
      if (step >= steps) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        const chargeInputs = charges.map((c) => ({
          id: c.id,
          code: c.code,
          calcrimNumber: c.calcrimNumber ?? undefined,
        }));

        const evidenceDocs = documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          content: `${d.name}. Filed ${d.filedDate}. Document type: ${d.type}. Evidence document ${d.id}.`,
        }));

        const result = analyzeFullCase(caseId ?? '', chargeInputs, evidenceDocs);
        setAnalysis(result);
        setProgress(100);
        setTimeout(() => setIsAnalyzing(false), 400);
      }
    }, 120);
  }, [caseId, charges, documents]);

  // Auto-run analysis on mount; cleanup interval on unmount
  useEffect(() => {
    runAnalysis();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close share menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort inconsistencies
  const allInconsistencies = analysis?.allInconsistencies ?? [];
  const categories = [...new Set(allInconsistencies.map((i) => i.category))].sort();

  const filtered = filterCategory === 'all'
    ? allInconsistencies
    : allInconsistencies.filter((i) => i.category === filterCategory);

  const guardrailFiltered = filtered.filter((inc) =>
    shouldDisplayClaim({
      id: inc.id,
      text: inc.description,
      sources: inc.sources,
      confidence: inc.score,
      category: 'inconsistency',
    }),
  );

  const sorted = [...guardrailFiltered].sort((a, b) =>
    sortDir === 'desc' ? b.score - a.score : a.score - b.score
  );

  // Guardrail stats for banner
  const rejectedCount = filtered.length - guardrailFiltered.length;
  const verifiedCount = guardrailFiltered.length;
  const avgConfidence = guardrailFiltered.length > 0
    ? Math.round(guardrailFiltered.reduce((sum, inc) => sum + inc.score, 0) / guardrailFiltered.length)
    : 0;

  // Share handlers
  const handleCopyToClipboard = () => {
    const text = formatInconsistenciesForText(sorted, currentCase?.title ?? `Case ${caseId}`);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setShowShareMenu(false);
  };

  const handleEmailShare = () => {
    const text = formatInconsistenciesForText(sorted, currentCase?.title ?? `Case ${caseId}`);
    const subject = encodeURIComponent(`Inconsistencies Report — ${currentCase?.title ?? `Case ${caseId}`}`);
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShowShareMenu(false);
  };

  const handleTextShare = () => {
    const text = formatInconsistenciesForText(sorted.slice(0, 5), currentCase?.title ?? `Case ${caseId}`);
    if (navigator.share) {
      navigator.share({
        title: `Inconsistencies Report — ${currentCase?.title ?? 'Case'}`,
        text,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setShowShareMenu(false);
  };

  const handlePrint = () => {
    window.print();
    setShowShareMenu(false);
  };

  const handleDownload = () => {
    const text = formatInconsistenciesForText(sorted, currentCase?.title ?? `Case ${caseId}`);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inconsistencies-report-${caseId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowShareMenu(false);
  };

  // Loading state with animated progress
  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Inconsistencies & Contradictions</h2>
        </div>
        <Card>
          <AnalysisProgressIndicator
            progress={progress}
            label="Scanning evidence for inconsistencies and contradictions"
          />
        </Card>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <AnalysisOutputWrapper>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-600" />
              Inconsistencies & Contradictions
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {sorted.length} finding{sorted.length !== 1 ? 's' : ''} across {analysis.charges.length} charge{analysis.charges.length !== 1 ? 's' : ''}
              {filterCategory !== 'all' && ` (filtered: ${filterCategory})`}
            </p>
          </div>
        </div>

        {/* Share Button & Menu */}
        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Share2 size={16} />
            Share Report
          </button>

          {showShareMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <button
                onClick={handleCopyToClipboard}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={handleTextShare}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare size={16} />
                Share via Text/App
              </button>
              <button
                onClick={handleEmailShare}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Mail size={16} />
                Share via Email
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handlePrint}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Printer size={16} />
                Print Report
              </button>
              <button
                onClick={handleDownload}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download size={16} />
                Download as Text
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Guardrail Status Banner */}
      <GuardrailStatusBanner
        totalClaims={filtered.length}
        verifiedClaims={verifiedCount}
        rejectedClaims={rejectedCount}
        overallConfidence={avgConfidence}
      />

      {/* Filters & Sort */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <SortDesc size={14} />
          Score: {sortDir === 'desc' ? 'Highest First' : 'Lowest First'}
        </button>
      </div>

      {/* Inconsistencies Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-500 font-semibold w-16">#</th>
                <th className="text-left py-3 px-4 text-gray-500 font-semibold w-20">
                  <button
                    onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Score
                    {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-gray-500 font-semibold w-28">Category</th>
                <th className="text-left py-3 px-4 text-gray-500 font-semibold">Description</th>
                <th className="text-left py-3 px-4 text-gray-500 font-semibold w-40">Sources</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((inc, idx) => (
                <Fragment key={inc.id}>
                  <tr
                    onClick={() => setExpandedRow(expandedRow === inc.id ? null : inc.id)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      idx < 5 ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <ScoreBadge score={inc.score} />
                    </td>
                    <td className="py-3 px-4">
                      <CategoryBadge category={inc.category} />
                    </td>
                    <td className="py-3 px-4 text-gray-800 max-w-md">
                      <p className={expandedRow === inc.id ? '' : 'line-clamp-2'}>{safeText(inc.description)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {inc.sources.slice(0, 2).map((s, i) => (
                          <span key={i} className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                            {s}
                          </span>
                        ))}
                        {inc.sources.length > 2 && (
                          <span className="text-[10px] text-gray-400">+{inc.sources.length - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRow === inc.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="max-w-3xl">
                          <p className="text-sm text-gray-800 mb-3">{safeText(inc.description)}</p>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-3">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Recommendation</p>
                            <p className="text-sm text-blue-800">{safeText(inc.recommendation)}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Sources: {inc.sources.join(', ')}</span>
                            {inc.relatedElements.length > 0 && (
                              <span>
                                Related Elements: {inc.relatedElements.map((e) => `#${e}`).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No inconsistencies found{filterCategory !== 'all' ? ` in category "${filterCategory}"` : ''}.</p>
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200" /> 80-100: Critical
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-200" /> 60-79: High
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200" /> 40-59: Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-200" /> 20-39: Low
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200" /> 0-19: Minor
        </span>
      </div>

    </div>
    </AnalysisOutputWrapper>
  );
}
