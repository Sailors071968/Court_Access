// ============================================================================
// Phase F.2 — Live Litigation Intelligence Cockpit
// 8-pane real-time case intelligence layer.
// Analyzes uploaded/live-authorized litigation materials.
// NEVER operates as a surveillance system.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface LiveLitigationProps {
  caseId: string;
}

interface ContradictionEmergence {
  id: string; emergenceType: string; severity: string;
  statementAText: string; statementBText: string; speaker: string | null;
  acknowledged: boolean; detectedAt: string;
}

interface BurdenShift {
  id: string; elementId: string; shiftType: string;
  previousState: string; newState: string; magnitude: number;
  triggerDescription: string;
}

interface CredibilityUpdate {
  id: string; witnessName: string; updateType: string;
  previousScore: number; newScore: number; triggerDescription: string;
}

interface ObjectionConsequence {
  id: string; objectionType: string; ruling: string;
  consequenceType: string; impactDescription: string;
  appellatePreservation: boolean;
}

interface AppellatePreservation {
  id: string; issueType: string; issueDescription: string;
  preservationStatus: string; lastAction: string; requiredFollowUp: string | null;
}

interface CourtroomEvent {
  id: string; eventType: string; eventDescription: string;
  speaker: string | null; trialPhase: string; sequenceNumber: number;
}

interface TimelineUpdate {
  id: string; updateType: string; eventDescription: string;
  newState: string;
}

interface LitigationSnapshot {
  id: string; snapshotType: string; litigationPhase: string;
  burdenState: string; contradictionState: string;
  witnessCredibility: string; createdAt: string;
}

type PaneName = 'contradictions' | 'burden' | 'credibility' | 'objections' | 'appellate' | 'events' | 'timeline' | 'snapshots';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'contradictions', label: 'Active Contradictions', icon: '⚡' },
  { key: 'burden', label: 'Burden Shifts', icon: '⚖️' },
  { key: 'credibility', label: 'Witness Credibility', icon: '👤' },
  { key: 'objections', label: 'Live Objections', icon: '🔨' },
  { key: 'appellate', label: 'Appellate Preservation', icon: '📋' },
  { key: 'events', label: 'Courtroom Events', icon: '🏛️' },
  { key: 'timeline', label: 'Dynamic Timeline', icon: '📅' },
  { key: 'snapshots', label: 'Litigation Snapshots', icon: '📸' },
];

const severityColor = (s: string) => s === 'critical' ? '#ef4444' : s === 'high' ? '#f59e0b' : s === 'medium' ? '#3b82f6' : '#64748b';
const shiftColor = (s: string) => s === 'collapsed' ? '#ef4444' : s === 'weakened' ? '#f59e0b' : s === 'strengthened' ? '#22c55e' : '#3b82f6';
const preservationColor = (s: string) => s === 'preserved' ? '#22c55e' : s === 'at_risk' ? '#f59e0b' : s === 'forfeited' ? '#ef4444' : '#64748b';
const rulingColor = (s: string) => s === 'sustained' ? '#22c55e' : s === 'overruled' ? '#ef4444' : '#f59e0b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const LiveLitigationCockpit: React.FC<LiveLitigationProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('contradictions');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [contradictions, setContradictions] = useState<ContradictionEmergence[]>([]);
  const [burdenShifts, setBurdenShifts] = useState<BurdenShift[]>([]);
  const [credibility, setCredibility] = useState<CredibilityUpdate[]>([]);
  const [objections, setObjections] = useState<ObjectionConsequence[]>([]);
  const [appellate, setAppellate] = useState<AppellatePreservation[]>([]);
  const [events, setEvents] = useState<CourtroomEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineUpdate[]>([]);
  const [snapshots, setSnapshots] = useState<LitigationSnapshot[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [coR, buR, crR, obR, apR, evR, tiR, snR] = await Promise.all([
        fetch(`/api/litigation/contradictions/${caseId}`).then(r => r.json()).catch(() => ({ emergences: [] })),
        fetch(`/api/litigation/burden/${caseId}`).then(r => r.json()).catch(() => ({ shifts: [] })),
        fetch(`/api/litigation/credibility/${caseId}`).then(r => r.json()).catch(() => ({ updates: [] })),
        fetch(`/api/litigation/objections/${caseId}`).then(r => r.json()).catch(() => ({ consequences: [] })),
        fetch(`/api/litigation/appellate/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/litigation/events/${caseId}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`/api/litigation/timeline/${caseId}`).then(r => r.json()).catch(() => ({ updates: [] })),
        fetch(`/api/litigation/snapshots/${caseId}`).then(r => r.json()).catch(() => ({ snapshots: [] })),
      ]);
      setContradictions(coR.emergences || []);
      setBurdenShifts(buR.shifts || []);
      setCredibility(crR.updates || []);
      setObjections(obR.consequences || []);
      setAppellate(apR.issues || []);
      setEvents(evR.events || []);
      setTimeline(tiR.updates || []);
      setSnapshots(snR.snapshots || []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/litigation/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderContradictionsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Active Contradiction Emergence</h3>
      {contradictions.length === 0 ? <p style={{ color: '#64748b' }}>No live contradictions detected.</p> : null}
      {contradictions.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.emergenceType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.severity} color={severityColor(c.severity)} />
              {!c.acknowledged && <Badge text="NEW" color="#7c3aed" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0' }}>A: {c.statementAText.slice(0, 120)}...</p>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0' }}>B: {c.statementBText.slice(0, 120)}...</p>
        </div>
      ))}
    </div>
  );

  const renderBurdenPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Dynamic Burden Shifts</h3>
      {burdenShifts.length === 0 ? <p style={{ color: '#64748b' }}>No burden shifts detected.</p> : null}
      {burdenShifts.map(b => (
        <div key={b.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Element: {(b.elementId || 'unknown').slice(0, 12)}...</span>
            <Badge text={b.shiftType} color={shiftColor(b.shiftType)} />
          </div>
          <div style={{ background: '#0f172a', borderRadius: 4, height: 8, marginBottom: 8 }}>
            <div style={{ background: shiftColor(b.shiftType), height: '100%', borderRadius: 4, width: `${b.magnitude * 100}%` }} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{b.triggerDescription.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderCredibilityPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Active Witness Credibility Changes</h3>
      {credibility.length === 0 ? <p style={{ color: '#64748b' }}>No credibility changes tracked.</p> : null}
      {credibility.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.witnessName}</span>
            <Badge text={c.updateType.replace(/_/g, ' ')} color={c.updateType === 'impeachment' ? '#ef4444' : c.updateType === 'credibility_decrease' ? '#f59e0b' : '#22c55e'} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>Previous: {c.previousScore.toFixed(2)}</span>
            <span style={{ color: c.newScore < c.previousScore ? '#ef4444' : '#22c55e' }}>New: {c.newScore.toFixed(2)}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{c.triggerDescription.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderObjectionsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Live Objection Consequences</h3>
      {objections.length === 0 ? <p style={{ color: '#64748b' }}>No objection consequences tracked.</p> : null}
      {objections.map(o => (
        <div key={o.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{o.objectionType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={o.ruling} color={rulingColor(o.ruling)} />
              {o.appellatePreservation && <Badge text="PRESERVED" color="#22c55e" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{o.impactDescription.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderAppellatePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Ongoing Appellate Preservation State</h3>
      {appellate.length === 0 ? <p style={{ color: '#64748b' }}>No appellate preservation issues tracked.</p> : null}
      {appellate.map(a => (
        <div key={a.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.issueType.replace(/_/g, ' ')}</span>
            <Badge text={a.preservationStatus} color={preservationColor(a.preservationStatus)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{a.issueDescription.slice(0, 200)}</p>
          {a.requiredFollowUp && (
            <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>Follow-up: {a.requiredFollowUp}</p>
          )}
        </div>
      ))}
    </div>
  );

  const renderEventsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Courtroom Event Timeline</h3>
      {events.length === 0 ? <p style={{ color: '#64748b' }}>No courtroom events recorded.</p> : null}
      {events.map(e => (
        <div key={e.id} style={{ ...cardStyle, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 40, textAlign: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>#{e.sequenceNumber}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{e.eventType.replace(/_/g, ' ')}</span>
              <Badge text={e.trialPhase.replace(/_/g, ' ')} color="#475569" />
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{e.eventDescription.slice(0, 200)}</p>
            {e.speaker && <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>Speaker: {e.speaker}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTimelinePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Dynamic Theory & Timeline Updates</h3>
      {timeline.length === 0 ? <p style={{ color: '#64748b' }}>No timeline updates.</p> : null}
      {timeline.map(t => (
        <div key={t.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.updateType.replace(/_/g, ' ')}</span>
            <Badge text={t.updateType} color={t.updateType === 'conflict_detected' ? '#ef4444' : t.updateType === 'gap_detected' ? '#f59e0b' : '#3b82f6'} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{t.eventDescription.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderSnapshotsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Litigation State Snapshots (Immutable)</h3>
      {snapshots.length === 0 ? <p style={{ color: '#64748b' }}>No snapshots captured.</p> : null}
      {snapshots.map(s => {
        let contradictionSummary = { total: 0, critical: 0 };
        try { contradictionSummary = JSON.parse(s.contradictionState); } catch { /* ignore */ }
        return (
          <div key={s.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Phase: {s.litigationPhase.replace(/_/g, ' ')}</span>
              <Badge text={s.snapshotType.replace(/_/g, ' ')} color="#7c3aed" />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
              <span>Contradictions: {contradictionSummary.total}</span>
              <span style={{ color: '#ef4444' }}>Critical: {contradictionSummary.critical}</span>
            </div>
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Captured: {new Date(s.createdAt).toLocaleString()}</p>
          </div>
        );
      })}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'contradictions': return renderContradictionsPane();
      case 'burden': return renderBurdenPane();
      case 'credibility': return renderCredibilityPane();
      case 'objections': return renderObjectionsPane();
      case 'appellate': return renderAppellatePane();
      case 'events': return renderEventsPane();
      case 'timeline': return renderTimelinePane();
      case 'snapshots': return renderSnapshotsPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Live Litigation Intelligence Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Analyzes uploaded/live-authorized litigation materials — not a surveillance system
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
            color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 14,
          }}
        >
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Live Analysis' : 'Run Live Litigation Analysis'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        {PANES.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePane(p.key)}
            style={{
              padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
              background: activePane === p.key ? '#7c3aed' : 'transparent',
              color: activePane === p.key ? '#fff' : '#94a3b8',
              fontWeight: activePane === p.key ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap',
              border: 'none', transition: 'all 0.15s',
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {renderActivePane()}
      </div>
    </div>
  );
};

export default LiveLitigationCockpit;
