// ============================================================================
// Phase H.1 — Unified Attorney Command Cockpit
// 8-pane full operational defense platform.
// Augments and organizes attorney litigation operations.
// NEVER replaces licensed legal counsel.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface CommandProps {
  caseId: string;
}

interface CaseState {
  id: string; currentPhase: string; evidenceCount: number;
  contradictionCount: number; constitutionalIssueCount: number;
  discoveryIssueCount: number; preservationStatus: string; overallRiskLevel: string;
}

interface EvidenceLifecycle {
  id: string; evidenceDescription: string; currentStage: string;
  layerCount: number; constitutionalRelevance: boolean; trialRelevance: boolean;
}

interface Milestone {
  id: string; milestoneType: string; status: string;
  description: string; daysUntilDeadline: number | null;
}

interface SearchEntry {
  id: string; sourceLayer: string; sourceType: string;
  searchableText: string; speakerOrWitness: string | null; severity: string | null;
}

interface Relationship {
  id: string; sourceEvidenceId: string; targetEvidenceId: string;
  relationshipType: string; relationshipStrength: number;
}

interface AuditLog {
  id: string; actionType: string; actionTarget: string; createdAt: string;
}

interface LifecyclePhase {
  id: string; lifecyclePhase: string; phaseStatus: string; phaseOutcome: string | null;
}

interface Orchestration {
  id: string; orchestrationType: string; status: string;
  totalDuration: number; triggeredBy: string;
}

type PaneName = 'evidence' | 'trial' | 'appellate' | 'constitutional' | 'discovery' | 'sentencing' | 'litigation' | 'graph';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'evidence', label: 'Evidence Intelligence', icon: '📋' },
  { key: 'trial', label: 'Trial Intelligence', icon: '⚖️' },
  { key: 'appellate', label: 'Appellate Intelligence', icon: '📜' },
  { key: 'constitutional', label: 'Constitutional Intelligence', icon: '🏛️' },
  { key: 'discovery', label: 'Discovery Intelligence', icon: '🔍' },
  { key: 'sentencing', label: 'Sentencing Intelligence', icon: '📊' },
  { key: 'litigation', label: 'Live Litigation', icon: '⚡' },
  { key: 'graph', label: 'Unified Graph', icon: '🕸️' },
];

const riskColor = (r: string) => r === 'critical' ? '#ef4444' : r === 'high' ? '#f59e0b' : r === 'moderate' ? '#3b82f6' : '#22c55e';
const statusColor = (s: string) => s === 'completed' ? '#22c55e' : s === 'active' ? '#3b82f6' : s === 'upcoming' ? '#64748b' : '#f59e0b';
const stageColor = (s: string) => s === 'excluded' ? '#ef4444' : s === 'challenged' ? '#f59e0b' : s === 'admitted' ? '#22c55e' : '#3b82f6';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const UnifiedAttorneyCommandCockpit: React.FC<CommandProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('evidence');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [caseState, setCaseState] = useState<CaseState | null>(null);
  const [lifecycles, setLifecycles] = useState<EvidenceLifecycle[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [phases, setPhases] = useState<LifecyclePhase[]>([]);
  const [orchestrations, setOrchestrations] = useState<Orchestration[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, lc, ms, se, rl, al, ph, orch] = await Promise.all([
        fetch(`/api/command/state/${caseId}`).then(r => r.json()).catch(() => ({ state: null })),
        fetch(`/api/command/lifecycles/${caseId}`).then(r => r.json()).catch(() => ({ lifecycles: [] })),
        fetch(`/api/command/milestones/${caseId}`).then(r => r.json()).catch(() => ({ milestones: [] })),
        fetch(`/api/command/search/${caseId}`).then(r => r.json()).catch(() => ({ entries: [] })),
        fetch(`/api/command/relationships/${caseId}`).then(r => r.json()).catch(() => ({ relationships: [] })),
        fetch(`/api/command/audit/${caseId}`).then(r => r.json()).catch(() => ({ logs: [] })),
        fetch(`/api/command/lifecycle/${caseId}`).then(r => r.json()).catch(() => ({ phases: [] })),
        fetch(`/api/command/orchestrations/${caseId}`).then(r => r.json()).catch(() => ({ orchestrations: [] })),
      ]);
      setCaseState(cs.state || null);
      setLifecycles(lc.lifecycles || []);
      setMilestones(ms.milestones || []);
      setSearchEntries(se.entries || []);
      setRelationships(rl.relationships || []);
      setAuditLogs(al.logs || []);
      setPhases(ph.phases || []);
      setOrchestrations(orch.orchestrations || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/command/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderEvidencePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidence Intelligence Dashboard</h3>
      {caseState && (
        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Evidence</span><div style={{ fontSize: 24, fontWeight: 700 }}>{caseState.evidenceCount}</div></div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Contradictions</span><div style={{ fontSize: 24, fontWeight: 700 }}>{caseState.contradictionCount}</div></div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Constitutional</span><div style={{ fontSize: 24, fontWeight: 700 }}>{caseState.constitutionalIssueCount}</div></div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Discovery</span><div style={{ fontSize: 24, fontWeight: 700 }}>{caseState.discoveryIssueCount}</div></div>
        </div>
      )}
      {lifecycles.slice(0, 10).map(l => (
        <div key={l.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>{l.evidenceDescription.slice(0, 120)}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={l.currentStage} color={stageColor(l.currentStage)} />
              <Badge text={`${l.layerCount} layers`} color="#7c3aed" />
              {l.constitutionalRelevance && <Badge text="CONSTITUTIONAL" color="#ef4444" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTrialPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Trial Intelligence</h3>
      {milestones.filter(m => ['motions_in_limine','jury_selection','prosecution_case','defense_case','verdict'].includes(m.milestoneType)).map(m => (
        <div key={m.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{m.milestoneType.replace(/_/g, ' ')}</span>
            <Badge text={m.status} color={statusColor(m.status)} />
          </div>
          {m.daysUntilDeadline !== null && <p style={{ color: '#94a3b8', fontSize: 12 }}>{m.daysUntilDeadline} days until deadline</p>}
        </div>
      ))}
    </div>
  );

  const renderAppellatePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Appellate Intelligence</h3>
      {milestones.filter(m => ['notice_of_appeal','opening_brief','oral_argument','opinion'].includes(m.milestoneType)).map(m => (
        <div key={m.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{m.milestoneType.replace(/_/g, ' ')}</span>
            <Badge text={m.status} color={statusColor(m.status)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderConstitutionalPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Constitutional Intelligence</h3>
      {searchEntries.filter(s => s.sourceLayer === 'constitutional').slice(0, 10).map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>{s.searchableText.slice(0, 150)}</span>
            {s.severity && <Badge text={s.severity} color={riskColor(s.severity)} />}
          </div>
        </div>
      ))}
    </div>
  );

  const renderDiscoveryPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Discovery Intelligence</h3>
      {caseState && (
        <div style={cardStyle}>
          <span style={{ color: '#64748b' }}>Discovery Issues: </span>
          <span style={{ fontWeight: 700 }}>{caseState.discoveryIssueCount}</span>
          <span style={{ color: '#64748b', marginLeft: 16 }}>Preservation: </span>
          <Badge text={caseState.preservationStatus.replace(/_/g, ' ')} color={caseState.preservationStatus === 'all_preserved' ? '#22c55e' : '#f59e0b'} />
        </div>
      )}
    </div>
  );

  const renderSentencingPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Sentencing Intelligence</h3>
      {milestones.filter(m => m.milestoneType === 'sentencing').map(m => (
        <div key={m.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Sentencing Phase</span>
            <Badge text={m.status} color={statusColor(m.status)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderLitigationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Live Litigation Lifecycle</h3>
      {phases.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{p.lifecyclePhase.replace(/_/g, ' ')}</span>
            <Badge text={p.phaseStatus} color={statusColor(p.phaseStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderGraphPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Unified Graph Intelligence</h3>
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Relationships</span><div style={{ fontSize: 24, fontWeight: 700 }}>{relationships.length}</div></div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Search Index</span><div style={{ fontSize: 24, fontWeight: 700 }}>{searchEntries.length}</div></div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Orchestrations</span><div style={{ fontSize: 24, fontWeight: 700 }}>{orchestrations.length}</div></div>
        </div>
      </div>
      {relationships.slice(0, 10).map(r => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>{r.sourceEvidenceId.slice(0, 8)}... → {r.targetEvidenceId.slice(0, 8)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.relationshipType} color="#7c3aed" />
              <Badge text={`${(r.relationshipStrength * 100).toFixed(0)}%`} color={r.relationshipStrength > 0.7 ? '#ef4444' : '#f59e0b'} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'evidence': return renderEvidencePane();
      case 'trial': return renderTrialPane();
      case 'appellate': return renderAppellatePane();
      case 'constitutional': return renderConstitutionalPane();
      case 'discovery': return renderDiscoveryPane();
      case 'sentencing': return renderSentencingPane();
      case 'litigation': return renderLitigationPane();
      case 'graph': return renderGraphPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Unified Attorney Command Environment</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Full operational defense platform — augments attorney operations, does not replace counsel
          </p>
          {caseState && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Badge text={`Phase: ${caseState.currentPhase}`} color="#3b82f6" />
              <Badge text={`Risk: ${caseState.overallRiskLevel}`} color={riskColor(caseState.overallRiskLevel)} />
              <Badge text={caseState.preservationStatus.replace(/_/g, ' ')} color={caseState.preservationStatus === 'all_preserved' ? '#22c55e' : '#f59e0b'} />
            </div>
          )}
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
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Full Analysis' : 'Run Unified Analysis'}
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

export default UnifiedAttorneyCommandCockpit;
