// ============================================
// Court Access — AI Insight Panel
// Phase 118: Graph Intelligence v2 + AI Analysis Layer
//
// Displays: case summary, timeline analysis,
// contradiction alerts, key actors
// Panel updates when graph selection changes.
// ============================================

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIAnalysisResult {
  type: string;
  result: string;
  metadata: Record<string, unknown>;
}

interface AnalysisType {
  id: string;
  name: string;
  description: string;
}

interface AIInsightPanelProps {
  caseId: string;
  selectedNodeId?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIInsightPanel({
  caseId,
  selectedNodeId,
  className = '',
}: AIInsightPanelProps) {
  const [analyses, setAnalyses] = useState<AIAnalysisResult[]>([]);
  const [availableTypes, setAvailableTypes] = useState<AnalysisType[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityScore, setEntityScore] = useState<Record<string, unknown> | null>(null);

  // Load available analysis types
  useEffect(() => {
    if (!caseId) return;
    fetchWithAuth(`/api/cases/${caseId}/graph/ai-analyses`)
      .then(data => setAvailableTypes(data.analyses || []))
      .catch(() => setAvailableTypes([]));
  }, [caseId]);

  // Load entity score when selection changes
  useEffect(() => {
    if (!caseId || !selectedNodeId) {
      setEntityScore(null);
      return;
    }

    fetchWithAuth(`/api/cases/${caseId}/graph/entity-score/${encodeURIComponent(selectedNodeId)}`)
      .then(data => setEntityScore(data))
      .catch(() => setEntityScore(null));
  }, [caseId, selectedNodeId]);

  // Run AI analysis
  const runAnalysis = useCallback(async (analysisType: string) => {
    if (!caseId || loading) return;
    setLoading(true);
    setError(null);
    setActiveAnalysis(analysisType);

    try {
      const result = await fetchWithAuth(`/api/cases/${caseId}/graph/ai-analysis`, {
        method: 'POST',
        body: JSON.stringify({ analysisType }),
      });

      setAnalyses(prev => {
        const filtered = prev.filter(a => a.type !== analysisType);
        return [...filtered, result];
      });
    } catch (err) {
      console.error('[AIInsight] Analysis error:', err);
      setError('Failed to run AI analysis. Check OpenAI API key configuration.');
    } finally {
      setLoading(false);
      setActiveAnalysis(null);
    }
  }, [caseId, loading]);

  // Get current analysis result
  const getAnalysisResult = (type: string) => {
    return analyses.find(a => a.type === type);
  };

  // Parse AI response (may be JSON string or plain text)
  const parseResult = (result: string): string => {
    try {
      const parsed = JSON.parse(result);
      if (parsed.error) return `[AI unavailable] ${parsed.message || parsed.error}`;
      return result;
    } catch {
      return result;
    }
  };

  return (
    <div className={`flex flex-col bg-gray-950 ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">AI Insights</h3>
        <span className="text-xs text-gray-500">Phase 118</span>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Entity Score (when node selected) */}
        {entityScore && !('error' in entityScore) && (
          <div className="p-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-300">
                {(entityScore.label as string) || 'Selected Entity'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                (entityScore.score as number) >= 0.7
                  ? 'bg-green-900/50 text-green-300'
                  : (entityScore.score as number) >= 0.4
                    ? 'bg-yellow-900/50 text-yellow-300'
                    : 'bg-red-900/50 text-red-300'
              }`}>
                {Math.round((entityScore.score as number) * 100)}% strength
              </span>
            </div>

            {entityScore.factors && (
              <div className="space-y-1">
                {Object.entries(entityScore.factors as Record<string, number>).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-28 truncate">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className="flex-1 bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full"
                        style={{ width: `${Math.round(val * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-7 text-right">{Math.round(val * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            {entityScore.interpretation && (
              <p className="text-xs text-gray-500 mt-2">
                {(entityScore.interpretation as Record<string, string>).description}
              </p>
            )}
          </div>
        )}

        {/* Analysis Buttons */}
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-2">Run AI Analysis</p>
          <div className="grid grid-cols-2 gap-1.5">
            {availableTypes.map(at => {
              const hasResult = !!getAnalysisResult(at.id);
              const isRunning = activeAnalysis === at.id;

              return (
                <button
                  key={at.id}
                  onClick={() => runAnalysis(at.id)}
                  disabled={loading}
                  className={`text-xs px-2 py-1.5 rounded border transition-colors text-left ${
                    hasResult
                      ? 'border-green-700 bg-green-900/20 text-green-300 hover:bg-green-900/30'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                  } disabled:opacity-50`}
                  title={at.description}
                >
                  {isRunning ? 'Running...' : at.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        <div className="p-3 space-y-3">
          {analyses.length === 0 && !loading && (
            <div className="text-center text-gray-500 py-4">
              <p className="text-xs">No analyses run yet.</p>
              <p className="text-xs mt-1">Click an analysis button above to start.</p>
            </div>
          )}

          {analyses.map((analysis) => {
            const typeMeta = availableTypes.find(t => t.id === analysis.type);
            const resultText = parseResult(analysis.result);

            return (
              <div key={analysis.type} className="bg-gray-900 rounded border border-gray-800">
                <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-200">
                    {typeMeta?.name || analysis.type}
                  </span>
                  <button
                    onClick={() => runAnalysis(analysis.type)}
                    disabled={loading}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Refresh
                  </button>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
                    {resultText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { AIInsightPanel };
