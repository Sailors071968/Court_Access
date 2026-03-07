// ============================================
// Court Access — Case Intelligence Dashboard
// Phase 118: Graph Intelligence v2 + AI Analysis Layer
//
// Display: graph insights, timeline anomalies, conflict alerts,
// evidence strength scores, entity frequency charts
// Route: /app/cases/:caseId/intelligence
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphInsight {
  id: string;
  caseId: string;
  insightType: string;
  description: string;
  confidenceScore: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface TimelineAnomaly {
  type: string;
  description: string;
  severity: string;
  details: Record<string, unknown>;
}

interface EvidenceScore {
  nodeId: string;
  label: string;
  type: string;
  score: number;
  factors: {
    corroboration: number;
    timelineConsistency: number;
    entityConfidence: number;
    documentReliability: number;
  };
}

interface IntelligenceStats {
  centralActors: number;
  eventClusters: number;
  entityFrequencies: number;
  timelineAnomalies: number;
  totalInsights: number;
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
// Score bar component
// ---------------------------------------------------------------------------

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-32 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-10 text-right">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-900/50 text-red-300 border-red-700',
    medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    low: 'bg-blue-900/50 text-blue-300 border-blue-700',
  };

  return (
    <span className={`px-1.5 py-0.5 text-xs rounded border ${colors[severity] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CaseIntelligenceDashboard() {
  const { caseId } = useParams<{ caseId: string }>();

  const [insights, setInsights] = useState<GraphInsight[]>([]);
  const [anomalies, setAnomalies] = useState<TimelineAnomaly[]>([]);
  const [scores, setScores] = useState<EvidenceScore[]>([]);
  const [stats, setStats] = useState<IntelligenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'anomalies' | 'scores' | 'actors'>('insights');

  // Load intelligence data
  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);

    try {
      const [insightsRes, anomaliesRes, scoresRes] = await Promise.all([
        fetchWithAuth(`/api/cases/${caseId}/graph/intelligence`).catch(() => ({ insights: [], count: 0 })),
        fetchWithAuth(`/api/cases/${caseId}/graph/anomalies`).catch(() => ({ anomalies: [], count: 0 })),
        fetchWithAuth(`/api/cases/${caseId}/graph/scores`).catch(() => ({ scores: [], count: 0 })),
      ]);

      setInsights(insightsRes.insights || []);
      setAnomalies(anomaliesRes.anomalies || []);
      setScores(scoresRes.scores || []);
    } catch (err) {
      console.error('[Intelligence] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run full intelligence analysis
  const runAnalysis = useCallback(async () => {
    if (!caseId || running) return;
    setRunning(true);

    try {
      const result = await fetchWithAuth(`/api/cases/${caseId}/graph/intelligence/run`, {
        method: 'POST',
      });

      setStats(result.stats);
      // Reload data after analysis
      await loadData();
    } catch (err) {
      console.error('[Intelligence] Analysis error:', err);
    } finally {
      setRunning(false);
    }
  }, [caseId, running, loadData]);

  // Run evidence scoring
  const runScoring = useCallback(async () => {
    if (!caseId || running) return;
    setRunning(true);

    try {
      const result = await fetchWithAuth(`/api/cases/${caseId}/graph/scores/run`, {
        method: 'POST',
      });

      setScores(result.scores || []);
    } catch (err) {
      console.error('[Intelligence] Scoring error:', err);
    } finally {
      setRunning(false);
    }
  }, [caseId, running]);

  // Group insights by type
  const insightsByType = insights.reduce<Record<string, GraphInsight[]>>((acc, i) => {
    if (!acc[i.insightType]) acc[i.insightType] = [];
    acc[i.insightType].push(i);
    return acc;
  }, {});

  const INSIGHT_TYPE_LABELS: Record<string, string> = {
    central_actor: 'Central Actors',
    event_cluster: 'Event Clusters',
    entity_frequency: 'Entity Frequency',
    relationship_density: 'Relationship Density',
    timeline_anomaly: 'Timeline Anomalies',
    contradiction_pattern: 'Contradiction Patterns',
  };

  const tabs = [
    { id: 'insights' as const, label: 'Graph Insights', count: insights.length },
    { id: 'anomalies' as const, label: 'Timeline Anomalies', count: anomalies.length },
    { id: 'scores' as const, label: 'Evidence Scores', count: scores.length },
    { id: 'actors' as const, label: 'Key Actors', count: insightsByType.central_actor?.length || 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-semibold">Case Intelligence Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            AI-powered graph analysis and evidence strength scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/app/cases/${caseId}/investigation`}
            className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Investigation Workspace
          </Link>
          <button
            onClick={runScoring}
            disabled={running}
            className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            {running ? 'Running...' : 'Score Evidence'}
          </button>
          <button
            onClick={runAnalysis}
            disabled={running}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded transition-colors"
          >
            {running ? 'Running...' : 'Run Intelligence'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 px-6 py-3 bg-gray-900/50 border-b border-gray-800">
          {[
            { label: 'Central Actors', value: stats.centralActors },
            { label: 'Event Clusters', value: stats.eventClusters },
            { label: 'Entity Frequencies', value: stats.entityFrequencies },
            { label: 'Timeline Anomalies', value: stats.timelineAnomalies },
            { label: 'Total Insights', value: stats.totalInsights },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-bold text-blue-400">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-700 rounded">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <div className="animate-spin text-2xl mb-2">&#x2699;&#xFE0F;</div>
              <p className="text-sm">Loading intelligence data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Insights Tab */}
            {activeTab === 'insights' && (
              <div className="space-y-4">
                {Object.entries(insightsByType).map(([type, items]) => (
                  <div key={type} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-200">
                        {INSIGHT_TYPE_LABELS[type] || type}
                      </h3>
                      <span className="text-xs text-gray-500">{items.length} insights</span>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {items.slice(0, 10).map((insight, idx) => (
                        <div key={insight.id || idx} className="px-4 py-3 flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm text-gray-300">{insight.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16">
                              <div className="text-xs text-gray-500 mb-0.5">Confidence</div>
                              <div className="bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.round(insight.confidenceScore * 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">
                              {Math.round(insight.confidenceScore * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {insights.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <p className="text-lg mb-2">No insights yet</p>
                    <p className="text-sm mb-4">Run the intelligence analysis to generate graph insights.</p>
                    <button
                      onClick={runAnalysis}
                      disabled={running}
                      className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
                    >
                      Run Intelligence Analysis
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Anomalies Tab */}
            {activeTab === 'anomalies' && (
              <div className="space-y-2">
                {anomalies.map((anomaly, idx) => (
                  <div key={idx} className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex items-start gap-3">
                    <SeverityBadge severity={anomaly.severity} />
                    <div className="flex-1">
                      <p className="text-sm text-gray-300">{anomaly.description}</p>
                      <p className="text-xs text-gray-500 mt-1">Type: {anomaly.type.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                ))}

                {anomalies.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <p className="text-lg mb-2">No timeline anomalies detected</p>
                    <p className="text-sm">Timeline gaps, conflicts, and duplicate timestamps will appear here.</p>
                  </div>
                )}
              </div>
            )}

            {/* Scores Tab */}
            {activeTab === 'scores' && (
              <div className="space-y-3">
                {scores.length > 0 && (
                  <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                    <h3 className="text-sm font-medium text-gray-200 mb-3">Evidence Strength Scores</h3>
                    <div className="space-y-2">
                      {scores.slice(0, 30).map((s, idx) => (
                        <ScoreBar key={s.nodeId || idx} score={s.score} label={`${s.label} (${s.type})`} />
                      ))}
                    </div>
                  </div>
                )}

                {scores.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <h3 className="text-sm font-medium text-gray-200 mb-3">Strong Evidence</h3>
                      <div className="space-y-2">
                        {scores.filter(s => s.score >= 0.7).slice(0, 10).map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-green-400 truncate">{s.label}</span>
                            <span className="text-gray-400">{Math.round(s.score * 100)}%</span>
                          </div>
                        ))}
                        {scores.filter(s => s.score >= 0.7).length === 0 && (
                          <p className="text-xs text-gray-500">No strong evidence items</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <h3 className="text-sm font-medium text-gray-200 mb-3">Weak Evidence</h3>
                      <div className="space-y-2">
                        {scores.filter(s => s.score < 0.4).slice(0, 10).map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-red-400 truncate">{s.label}</span>
                            <span className="text-gray-400">{Math.round(s.score * 100)}%</span>
                          </div>
                        ))}
                        {scores.filter(s => s.score < 0.4).length === 0 && (
                          <p className="text-xs text-gray-500">No weak evidence items</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {scores.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <p className="text-lg mb-2">No evidence scores yet</p>
                    <p className="text-sm mb-4">Run evidence scoring to assess reliability of each evidence item.</p>
                    <button
                      onClick={runScoring}
                      disabled={running}
                      className="text-sm px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded"
                    >
                      Score Evidence
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Key Actors Tab */}
            {activeTab === 'actors' && (
              <div className="space-y-2">
                {(insightsByType.central_actor || []).map((actor, idx) => {
                  const meta = actor.metadata as Record<string, unknown>;
                  return (
                    <div key={actor.id || idx} className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-400 text-lg">
                        &#x1F464;
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-200">
                          {(meta.label as string) || actor.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(meta.degree as number) || 0} connections
                          {meta.relationshipTypes ? ` | ${(meta.relationshipTypes as string[]).join(', ')}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-400">
                          {Math.round(actor.confidenceScore * 100)}%
                        </div>
                        <div className="text-xs text-gray-500">confidence</div>
                      </div>
                    </div>
                  );
                })}

                {(!insightsByType.central_actor || insightsByType.central_actor.length === 0) && (
                  <div className="text-center text-gray-500 py-12">
                    <p className="text-lg mb-2">No key actors identified</p>
                    <p className="text-sm mb-4">Run intelligence analysis to identify central actors in the evidence graph.</p>
                    <button
                      onClick={runAnalysis}
                      disabled={running}
                      className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
                    >
                      Run Intelligence Analysis
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { CaseIntelligenceDashboard };
