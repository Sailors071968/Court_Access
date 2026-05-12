// ============================================================================
// Phase F.1 — Unified Intelligence Cockpit
// 8-pane global criminal-defense intelligence layer.
// Organizes lawful litigation intelligence relationships.
// NEVER becomes a surveillance or predictive-enforcement system.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface IntelligenceProps {
  caseId: string;
}

interface GraphNode {
  id: string; caseId: string; nodeType: string; sourceTable: string;
  sourceId: string; label: string;
}

interface GraphEdge {
  id: string; sourceNodeId: string; targetNodeId: string;
  edgeType: string; weight: number;
}

interface CrossCaseWitness {
  id: string; witnessName: string; totalAppearances: number;
  inconsistencyCount: number; recantationCount: number; roles: string;
}

interface ForensicPattern {
  id: string; forensicType: string; totalOccurrences: number;
  challengedCount: number; currentScientificStatus: string;
}

interface ContradictionNetwork {
  id: string; witnessName: string; contradictionType: string;
  severity: string; networkSize: number;
}

interface TheoryRecurrence {
  id: string; theoryPattern: string; description: string;
  totalOccurrences: number; successRate: number;
}

interface BradyPattern {
  id: string; patternType: string; description: string;
  totalOccurrences: number;
}

interface LECredibility {
  id: string; officerIdentifier: string; totalCaseAppearances: number;
  inconsistencyCount: number; bradyIssueCount: number;
  aggregateCredibility: string; pitchessRelevant: boolean;
}

interface ProvenanceChain {
  id: string; evidenceId: string; chainLength: number;
  integrityStatus: string; custodyTransfers: number;
}

interface TimelineCorrelation {
  id: string; correlationType: string; caseIdA: string; caseIdB: string;
  description: string; correlationStrength: number;
}

type PaneName = 'graph' | 'witnesses' | 'forensic' | 'contradictions' | 'theories' | 'brady' | 'provenance' | 'timelines';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'graph', label: 'Graph Relationships', icon: '🔗' },
  { key: 'witnesses', label: 'Recurring Witnesses', icon: '👤' },
  { key: 'forensic', label: 'Forensic Recurrence', icon: '🔬' },
  { key: 'contradictions', label: 'Contradiction Networks', icon: '⚡' },
  { key: 'theories', label: 'Theory Recurrence', icon: '📊' },
  { key: 'brady', label: 'Brady/Giglio Recurrence', icon: '⚠️' },
  { key: 'provenance', label: 'Evidence Provenance', icon: '🔒' },
  { key: 'timelines', label: 'Multi-Case Timelines', icon: '📅' },
];

const severityColor = (s: string) => s === 'critical' ? '#ef4444' : s === 'high' ? '#f59e0b' : s === 'medium' ? '#3b82f6' : '#64748b';
const statusColor = (s: string) => s === 'debunked' ? '#ef4444' : s === 'questioned' ? '#f59e0b' : s === 'validated' ? '#22c55e' : '#64748b';
const integrityColor = (s: string) => s === 'intact' ? '#22c55e' : s === 'questioned' ? '#f59e0b' : '#ef4444';
const credColor = (s: string) => s === 'aggregate_concern' ? '#ef4444' : s === 'no_pattern' ? '#22c55e' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const UnifiedIntelligenceCockpit: React.FC<IntelligenceProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('graph');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [witnesses, setWitnesses] = useState<CrossCaseWitness[]>([]);
  const [forensic, setForensic] = useState<ForensicPattern[]>([]);
  const [contradictions, setContradictions] = useState<ContradictionNetwork[]>([]);
  const [theories, setTheories] = useState<TheoryRecurrence[]>([]);
  const [brady, setBrady] = useState<BradyPattern[]>([]);
  const [provenance, setProvenance] = useState<ProvenanceChain[]>([]);
  const [timelines, setTimelines] = useState<TimelineCorrelation[]>([]);
  const [_leCredibility, setLeCredibility] = useState<LECredibility[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [noR, edR, wiR, foR, coR, thR, brR, prR, tiR, leR] = await Promise.all([
        fetch(`/api/intelligence/graph/nodes/${caseId}`).then(r => r.json()).catch(() => ({ nodes: [] })),
        fetch(`/api/intelligence/graph/edges/${caseId}`).then(r => r.json()).catch(() => ({ edges: [] })),
        fetch(`/api/intelligence/witnesses/${caseId}`).then(r => r.json()).catch(() => ({ witnesses: [] })),
        fetch(`/api/intelligence/forensic/${caseId}`).then(r => r.json()).catch(() => ({ patterns: [] })),
        fetch(`/api/intelligence/contradictions/${caseId}`).then(r => r.json()).catch(() => ({ networks: [] })),
        fetch(`/api/intelligence/theories/${caseId}`).then(r => r.json()).catch(() => ({ theories: [] })),
        fetch(`/api/intelligence/brady/${caseId}`).then(r => r.json()).catch(() => ({ patterns: [] })),
        fetch(`/api/intelligence/provenance/${caseId}`).then(r => r.json()).catch(() => ({ chains: [] })),
        fetch(`/api/intelligence/timelines/${caseId}`).then(r => r.json()).catch(() => ({ correlations: [] })),
        fetch(`/api/intelligence/le-credibility/${caseId}`).then(r => r.json()).catch(() => ({ officers: [] })),
      ]);
      setNodes(noR.nodes || []);
      setEdges(edR.edges || []);
      setWitnesses(wiR.witnesses || []);
      setForensic(foR.patterns || []);
      setContradictions(coR.networks || []);
      setTheories(thR.theories || []);
      setBrady(brR.patterns || []);
      setProvenance(prR.chains || []);
      setTimelines(tiR.correlations || []);
      setLeCredibility(leR.officers || []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/intelligence/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderGraphPane = () => {
    const nodeTypeCounts: Record<string, number> = {};
    for (const n of nodes) { nodeTypeCounts[n.nodeType] = (nodeTypeCounts[n.nodeType] || 0) + 1; }
    const edgeTypeCounts: Record<string, number> = {};
    for (const e of edges) { edgeTypeCounts[e.edgeType] = (edgeTypeCounts[e.edgeType] || 0) + 1; }

    return (
      <div>
        <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Unified Intelligence Graph</h3>
        <div style={{ ...cardStyle, display: 'flex', gap: 32 }}>
          <div><span style={{ color: '#64748b' }}>Total Nodes:</span> <strong>{nodes.length}</strong></div>
          <div><span style={{ color: '#64748b' }}>Total Edges:</span> <strong>{edges.length}</strong></div>
        </div>
        {Object.entries(nodeTypeCounts).map(([type, count]) => (
          <div key={type} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{type.replace(/_/g, ' ')}</span>
            <Badge text={`${count} nodes`} color="#3b82f6" />
          </div>
        ))}
        {Object.entries(edgeTypeCounts).map(([type, count]) => (
          <div key={type} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{type}</span>
            <Badge text={`${count} edges`} color="#7c3aed" />
          </div>
        ))}
      </div>
    );
  };

  const renderWitnessesPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Cross-Case Recurring Witnesses</h3>
      {witnesses.length === 0 ? <p style={{ color: '#64748b' }}>No cross-case witness data.</p> : null}
      {witnesses.map(w => (
        <div key={w.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{w.witnessName}</span>
            <Badge text={`${w.totalAppearances} appearances`} color="#3b82f6" />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <div style={{ color: '#f59e0b' }}>Inconsistencies: {w.inconsistencyCount}</div>
            <div style={{ color: '#ef4444' }}>Recantations: {w.recantationCount}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderForensicPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Forensic Methodology Recurrence</h3>
      {forensic.length === 0 ? <p style={{ color: '#64748b' }}>No cross-case forensic patterns.</p> : null}
      {forensic.map(f => (
        <div key={f.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{f.forensicType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={f.currentScientificStatus} color={statusColor(f.currentScientificStatus)} />
              <Badge text={`${f.totalOccurrences} cases`} color="#3b82f6" />
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: 12 }}>Challenged {f.challengedCount} times across cases</p>
        </div>
      ))}
    </div>
  );

  const renderContradictionsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Global Contradiction Networks</h3>
      {contradictions.length === 0 ? <p style={{ color: '#64748b' }}>No contradiction networks built.</p> : null}
      {contradictions.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.witnessName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.severity} color={severityColor(c.severity)} />
              <Badge text={`network: ${c.networkSize}`} color="#7c3aed" />
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{c.contradictionType.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderTheoriesPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Prosecutor Theory Recurrence (Aggregate)</h3>
      {theories.length === 0 ? <p style={{ color: '#64748b' }}>No recurring prosecutor theories detected.</p> : null}
      {theories.map(t => (
        <div key={t.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.theoryPattern.replace(/_/g, ' ')}</span>
            <Badge text={`${t.totalOccurrences} cases`} color="#3b82f6" />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{t.description}</p>
        </div>
      ))}
    </div>
  );

  const renderBradyPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Recurring Brady/Giglio Patterns</h3>
      {brady.length === 0 ? <p style={{ color: '#64748b' }}>No recurring Brady/Giglio patterns.</p> : null}
      {brady.map(b => (
        <div key={b.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{b.patternType.replace(/_/g, ' ')}</span>
            <Badge text={`${b.totalOccurrences} occurrences`} color="#ef4444" />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{b.description.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderProvenancePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidence Provenance Chains</h3>
      {provenance.length === 0 ? <p style={{ color: '#64748b' }}>No provenance chains built.</p> : null}
      {provenance.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Evidence: {p.evidenceId.slice(0, 12)}...</span>
            <Badge text={p.integrityStatus} color={integrityColor(p.integrityStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
            <div>Chain Length: <strong>{p.chainLength}</strong></div>
            <div>Transfers: <strong>{p.custodyTransfers}</strong></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTimelinesPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Multi-Case Timeline Correlations</h3>
      {timelines.length === 0 ? <p style={{ color: '#64748b' }}>No cross-case timeline correlations found.</p> : null}
      {timelines.map(t => (
        <div key={t.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.correlationType.replace(/_/g, ' ')}</span>
            <Badge text={`strength: ${(t.correlationStrength * 100).toFixed(0)}%`} color={t.correlationStrength >= 0.7 ? '#ef4444' : t.correlationStrength >= 0.4 ? '#f59e0b' : '#3b82f6'} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{t.description.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>Cases: {t.caseIdA.slice(0, 8)}... ↔ {t.caseIdB.slice(0, 8)}...</p>
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'graph': return renderGraphPane();
      case 'witnesses': return renderWitnessesPane();
      case 'forensic': return renderForensicPane();
      case 'contradictions': return renderContradictionsPane();
      case 'theories': return renderTheoriesPane();
      case 'brady': return renderBradyPane();
      case 'provenance': return renderProvenancePane();
      case 'timelines': return renderTimelinesPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Unified Intelligence Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organizes lawful litigation intelligence relationships — not a surveillance system
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
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Unified Intelligence Analysis'}
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

export default UnifiedIntelligenceCockpit;
