// ============================================
// Court Access — Case Analysis Panel
// Displays evidence-governed analysis from /api/cases/:id/analysis
// ============================================

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, FileSearch, AlertTriangle } from 'lucide-react';
import { Card } from '../common/Card';
import { fetchCaseAnalysis, type ApiCaseAnalysis } from '../../services/caseApi';

interface CaseAnalysisPanelProps {
  caseId: string;
}

export function CaseAnalysisPanel({ caseId }: CaseAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<ApiCaseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchCaseAnalysis(caseId);
        if (!cancelled) setAnalysis(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case analysis');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-gray-500 py-4">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading case analysis...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      </Card>
    );
  }

  if (!analysis) return null;

  const hasSignals =
    analysis.inconsistencies.length > 0 ||
    analysis.crossDocComparisons.length > 0 ||
    analysis.officerActions.length > 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Case Analysis</h2>
        <span className="text-xs text-gray-400">
          Generated {new Date(analysis.generatedAt).toLocaleString()}
        </span>
      </div>

      {analysis.unknowns.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm space-y-1">
          {analysis.unknowns.map((u) => (
            <p key={u}>{u}</p>
          ))}
        </div>
      )}

      {analysis.evidenceSummary.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Evidence Summary</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.evidenceSummary.map((item) => (
              <span key={item.type} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {item.type}: {item.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasSignals && analysis.unknowns.length === 0 && (
        <p className="text-sm text-gray-500">No analysis signals detected from current evidence.</p>
      )}

      {analysis.inconsistencies.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600" />
            Inconsistencies ({analysis.inconsistencies.length})
          </h3>
          <ul className="space-y-2">
            {analysis.inconsistencies.slice(0, 5).map((inc) => (
              <li key={inc.id} className="text-sm p-2 rounded bg-gray-50 border border-gray-100">
                <span className={`text-xs font-medium uppercase ${
                  inc.severity === 'high' ? 'text-red-600' : inc.severity === 'medium' ? 'text-amber-600' : 'text-gray-500'
                }`}>{inc.severity}</span>
                <p className="text-gray-800 mt-0.5">{inc.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.recommendedExhibits.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <FileSearch size={14} className="text-blue-600" />
            Recommended Exhibits ({analysis.recommendedExhibits.length})
          </h3>
          <ul className="space-y-1">
            {analysis.recommendedExhibits.slice(0, 4).map((ex) => (
              <li key={ex.id} className="text-sm text-gray-700">{ex.title}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
