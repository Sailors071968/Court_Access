// ============================================================================
// Phase M.2 — Ecosystem Orchestration Cockpit
// 8-pane transparent orchestration dashboard.
// No hidden control systems — no opaque ecosystem mutation.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface OrchProps {
  caseId: string;
}

interface OrchEntry { id: string; orchestrationScope: string; subsystemsTotal: number; subsystemsOrchestrated: number; orchestrationStatus: string; }
interface CoordEntry { id: string; sourceSubsystem: string; targetSubsystem: string; coordinationStatus: string; lifecyclePhase: string; }
interface ConvEntry { id: string; convergenceDomain: string; layersTotal: number; layersConverged: number; convergenceRate: number; convergenceStatus: string; }
interface StateEntry { id: string; componentName: string; componentState: string; stateConsistent: boolean; }
interface ManifestEntry { id: string; manifestScope: string; entriesCount: number; entriesVerified: number; manifestComplete: boolean; manifestHash: string; }
interface ReplayEntry { id: string; replayScope: string; hashesMatch: boolean; stepsReplayed: number; replayDurationMs: number; }
interface CertEntry { id: string; certificationScope: string; certificationStatus: string; convergenceRate: number; rulesTotal: number; rulesPassed: number; }
interface LineageEntry { id: string; lineageSource: string; lineageTarget: string; sourceVersion: string; targetVersion: string; syncStatus: string; }

type PaneName = 'orchestration' | 'coordination' | 'convergence' | 'harmonization' | 'manifests' | 'replay' | 'certification' | 'lineage';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'orchestration', label: 'Orchestration Engine' },
  { key: 'coordination', label: 'Subsystem Coordination' },
  { key: 'convergence', label: 'Convergence Sync' },
  { key: 'harmonization', label: 'Ecosystem Harmonization' },
  { key: 'manifests', label: 'Orchestration Manifests' },
  { key: 'replay', label: 'Replay Coordination' },
  { key: 'certification', label: 'Convergence Certification' },
  { key: 'lineage', label: 'Ecosystem Lineage' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'converged' || s === 'coordinated' || s === 'healthy' || s === 'certified' || s === 'complete' || s === 'synchronized' || s === 'passed' || s === true ? '#22c55e' :
  s === 'running' || s === 'pending' || s === 'partial' || s === 'near_complete' || s === 'conditional' || s === 'recovering' ? '#f59e0b' :
  s === 'failed' || s === 'stalled' || s === 'uncoordinated' || s === 'divergent' || s === 'offline' || s === 'not_certified' || s === 'incomplete' || s === 'desynchronized' || s === false ? '#ef4444' : '#64748b';

export const EcosystemOrchestrationCockpit: React.FC<OrchProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('orchestration');
  const [loading, setLoading] = useState(false);
  const [orchs, setOrchs] = useState<OrchEntry[]>([]);
  const [coords, setCoords] = useState<CoordEntry[]>([]);
  const [convs, setConvs] = useState<ConvEntry[]>([]);
  const [states, setStates] = useState<StateEntry[]>([]);
  const [manifests, setManifests] = useState<ManifestEntry[]>([]);
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [lineages, setLineages] = useState<LineageEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c, cv, st, m, r, ct, l] = await Promise.all([
        fetch(`/api/orchestration/ecosystem/${caseId}`).then(r => r.json()).catch(() => ({ orchestrations: [] })),
        fetch(`/api/orchestration/lifecycles/${caseId}`).then(r => r.json()).catch(() => ({ coordinations: [] })),
        fetch(`/api/orchestration/convergence/${caseId}`).then(r => r.json()).catch(() => ({ convergences: [] })),
        fetch(`/api/orchestration/state/${caseId}`).then(r => r.json()).catch(() => ({ states: [] })),
        fetch(`/api/orchestration/manifests/${caseId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
        fetch(`/api/orchestration/replay/${caseId}`).then(r => r.json()).catch(() => ({ replays: [] })),
        fetch(`/api/orchestration/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
        fetch(`/api/orchestration/lineage/${caseId}`).then(r => r.json()).catch(() => ({ lineages: [] })),
      ]);
      setOrchs(o.orchestrations || []); setCoords(c.coordinations || []); setConvs(cv.convergences || []);
      setStates(st.states || []); setManifests(m.manifests || []);
      setReplays(r.replays || []); setCerts(ct.certifications || []); setLineages(l.lineages || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/orchestration/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderOrch = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Orchestration Engine</h3>
      {orchs.map(o => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{o.orchestrationScope.replace(/_/g, ' ')}</span>
            <Badge text={o.orchestrationStatus} color={sc(o.orchestrationStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Subsystems: {o.subsystemsOrchestrated}/{o.subsystemsTotal}</div>
        </div>
      ))}
    </div>
  );

  const renderCoord = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Subsystem Coordination</h3>
      {coords.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.coordinationStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.sourceSubsystem} → {c.targetSubsystem}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.lifecyclePhase} color="#3b82f6" />
              <Badge text={c.coordinationStatus} color={sc(c.coordinationStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderConv = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Convergence Synchronization</h3>
      {convs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.convergenceDomain}</span>
            <Badge text={c.convergenceStatus} color={sc(c.convergenceStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Layers</span><div style={{ fontWeight: 700 }}>{c.layersConverged}/{c.layersTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.convergenceRate >= 100 ? '#22c55e' : '#f59e0b' }}>{c.convergenceRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderState = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Ecosystem Harmonization</h3>
      {states.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{s.componentName.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.componentState} color={sc(s.componentState)} />
              <Badge text={s.stateConsistent ? 'CONSISTENT' : 'INCONSISTENT'} color={sc(s.stateConsistent)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderManifests = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Orchestration Manifests</h3>
      {manifests.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.manifestScope.replace(/_/g, ' ')}</span>
            <Badge text={m.manifestComplete ? 'COMPLETE' : 'INCOMPLETE'} color={sc(m.manifestComplete)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Entries</span><div style={{ fontWeight: 700 }}>{m.entriesVerified}/{m.entriesCount}</div></div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>{m.manifestHash.slice(0, 24)}...</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReplay = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Replay Coordination</h3>
      {replays.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.replayScope.replace(/_/g, ' ')}</span>
            <Badge text={r.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.hashesMatch)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Steps</span><div style={{ fontWeight: 700 }}>{r.stepsReplayed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Duration</span><div style={{ fontWeight: 700 }}>{r.replayDurationMs}ms</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCert = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Convergence Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rules</span><div style={{ fontWeight: 700 }}>{c.rulesPassed}/{c.rulesTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.convergenceRate >= 100 ? '#22c55e' : '#f59e0b' }}>{c.convergenceRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLineage = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Ecosystem Lineage</h3>
      {lineages.map(l => (
        <div key={l.id} style={{ ...card, borderLeft: `4px solid ${sc(l.syncStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{l.lineageSource} → {l.lineageTarget}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`v${l.sourceVersion} → v${l.targetVersion}`} color="#3b82f6" />
              <Badge text={l.syncStatus} color={sc(l.syncStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'orchestration': return renderOrch();
      case 'coordination': return renderCoord();
      case 'convergence': return renderConv();
      case 'harmonization': return renderState();
      case 'manifests': return renderManifests();
      case 'replay': return renderReplay();
      case 'certification': return renderCert();
      case 'lineage': return renderLineage();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Ecosystem Orchestration Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Transparent orchestration — deterministic platform convergence
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Orchestrating...' : 'Run Ecosystem Orchestration'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        {PANES.map(p => (
          <button key={p.key} onClick={() => setActivePane(p.key)} style={{
            padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
            background: activePane === p.key ? '#7c3aed' : 'transparent',
            color: activePane === p.key ? '#fff' : '#94a3b8',
            fontWeight: activePane === p.key ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap', border: 'none',
          }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 24 }}>{renderActive()}</div>
    </div>
  );
};

export default EcosystemOrchestrationCockpit;
