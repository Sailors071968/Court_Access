// ============================================
// Court Access — Phase C: AI Case Narrative Page
// AI-generated structured case narrative.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, RefreshCw, Clock, AlertTriangle, Users, Calendar, Loader2, History, Info } from 'lucide-react';
import { Card } from '../../components/common/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyEvent {
  date: string;
  description: string;
  type?: string;
}

interface Conflict {
  description?: string;
  evidence1?: string;
  evidence2?: string;
}

interface Participant {
  name: string;
  role: string;
  evidenceCount?: number;
}

interface CaseNarrative {
  id: string;
  caseId: string;
  generatedTimestamp: string;
  summaryText: string;
  keyEvents: KeyEvent[];
  conflictsDetected: Conflict[];
  participants: Participant[];
  modelVersion: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Main Narrative Page
// ---------------------------------------------------------------------------

export function NarrativePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [narrative, setNarrative] = useState<CaseNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CaseNarrative[]>([]);

  const fetchNarrative = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/narrative/${caseId}`);
      const data = await res.json();
      setNarrative(data.narrative || null);
    } catch (err) {
      console.error('Failed to fetch narrative:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const fetchHistory = useCallback(async () => {
    if (!caseId) return;
    try {
      const res = await fetch(`${API_BASE}/api/narrative/${caseId}/history`);
      const data = await res.json();
      setHistory(data.narratives || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [caseId]);

  useEffect(() => {
    fetchNarrative();
  }, [fetchNarrative]);

  const handleGenerate = async () => {
    if (!caseId) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/narrative/${caseId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.narrative) {
        setNarrative(data.narrative);
      }
    } catch (err) {
      console.error('Failed to generate narrative:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleShowHistory = async () => {
    if (!showHistory) {
      await fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading narrative...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            AI Case Narrative
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {narrative ? 'AI-generated structured case summary' : 'Generate a narrative from your evidence'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShowHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <History size={14} />
            History
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                {narrative ? 'Regenerate' : 'Generate Narrative'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Narrative Content */}
      {!narrative ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No narrative generated yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click &ldquo;Generate Narrative&rdquo; to create an AI-powered case summary from your evidence, timeline, and entities.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {generating ? 'Generating...' : 'Generate Narrative'}
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Phase 60: AI Disclaimer */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              This analysis is automated and intended for investigative assistance only. It does not constitute legal advice, definitive conclusions, or expert opinion. All findings should be independently verified by qualified professionals before use in legal proceedings.
            </p>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              Generated {new Date(narrative.generatedTimestamp).toLocaleString()}
            </span>
            <span>Model: {narrative.modelVersion}</span>
          </div>

          {/* Summary */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Case Summary</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {narrative.summaryText}
            </div>
          </Card>

          {/* Key Events */}
          {Array.isArray(narrative.keyEvents) && narrative.keyEvents.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-blue-500" />
                Key Events
              </h3>
              <div className="space-y-3">
                {narrative.keyEvents.map((event, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                    <div>
                      {event.date && (
                        <p className="text-xs font-medium text-gray-500">{event.date}</p>
                      )}
                      <p className="text-sm text-gray-700">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Participants */}
          {Array.isArray(narrative.participants) && narrative.participants.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users size={14} className="text-purple-500" />
                Key Participants
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {narrative.participants.map((p, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.role}</p>
                    {p.evidenceCount !== undefined && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.evidenceCount} evidence references</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Conflicts */}
          {Array.isArray(narrative.conflictsDetected) && narrative.conflictsDetected.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/30">
              <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                Detected Conflicts
              </h3>
              <div className="space-y-2">
                {narrative.conflictsDetected.map((conflict, i) => (
                  <div key={i} className="p-3 bg-white rounded-lg border border-amber-200">
                    <p className="text-sm text-gray-700">
                      {typeof conflict === 'string' ? conflict : conflict.description || JSON.stringify(conflict)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History size={14} className="text-gray-500" />
            Narrative History
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No previous narratives</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setNarrative(h)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    narrative?.id === h.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">
                      {new Date(h.generatedTimestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400">{h.modelVersion}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{h.summaryText}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
