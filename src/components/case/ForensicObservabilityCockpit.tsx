// ============================================================================
// Phase L.1 — Forensic Observability Cockpit
// 8-pane transparent observability dashboard.
// No hidden surveillance — no covert telemetry.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ObsProps {
  caseId: string;
}

interface TraceEntry { id: string; traceType: string; traceOrigin: string; traceTarget: string; durationMs: number; traceStatus: string; }
interface SyncEntry { id: string; sourceLayer: string; targetLayer: string; syncStatus: string; hashesMatch: boolean; recordsSynced: number; }
interface IncidentEntry { id: string; incidentType: string; incidentSeverity: string; timelineSteps: number; stepsReconstructed: number; rootCauseIdentified: boolean; }
interface IntegrityEntry { id: string; eventType: string; eventSeverity: string; affectedComponent: string; resolved: boolean; }
interface AnomalyEntry { id: string; anomalyType: string; detectionRule: string; anomalySeverity: string; detected: boolean; baselineValue: number; observedValue: number; }
interface ManifestEntry { id: string; manifestScope: string; manifestComplete: boolean; entriesCount: number; entriesVerified: number; manifestHash: string; }
interface ReplayEntry { id: string; replayScope: string; hashesMatch: boolean; eventsReplayed: number; replayDurationMs: number; }
interface CertEntry { id: string; certificationScope: string; certificationStatus: string; certificationRate: number; checksTotal: number; checksPassed: number; }

type PaneName = 'traces' | 'telemetry' | 'incidents' | 'integrity' | 'anomalies' | 'manifests' | 'replay' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'traces', label: 'Operational Traces' },
  { key: 'telemetry', label: 'Telemetry Synchronization' },
  { key: 'incidents', label: 'Incident Reconstruction' },
  { key: 'integrity', label: 'Integrity Monitoring' },
  { key: 'anomalies', label: 'Anomaly Detection' },
  { key: 'manifests', label: 'Audit Telemetry' },
  { key: 'replay', label: 'Replay Verification' },
  { key: 'certification', label: 'Observability Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'success' || s === 'synchronized' || s === 'completed' || s === 'certified' || s === 'healthy' || s === true ? '#22c55e' :
  s === 'partial' || s === 'pending' || s === 'conditional' || s === 'degraded' || s === 'running' || s === 'warning' ? '#f59e0b' :
  s === 'failure' || s === 'failed' || s === 'desynchronized' || s === 'not_certified' || s === 'down' || s === 'critical' || s === false ? '#ef4444' : '#64748b';

export const ForensicObservabilityCockpit: React.FC<ObsProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('traces');
  const [loading, setLoading] = useState(false);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [syncs, setSyncs] = useState<SyncEntry[]>([]);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [integrityEvts, setIntegrityEvts] = useState<IntegrityEntry[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEntry[]>([]);
  const [manifests, setManifests] = useState<ManifestEntry[]>([]);
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, sy, inc, intg, an, mn, rp, ct] = await Promise.all([
        fetch(`/api/observability/traces/${caseId}`).then(r => r.json()).catch(() => ({ traces: [] })),
        fetch(`/api/observability/telemetry/${caseId}`).then(r => r.json()).catch(() => ({ syncs: [] })),
        fetch(`/api/observability/incidents/${caseId}`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`/api/observability/integrity/${caseId}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`/api/observability/anomalies/${caseId}`).then(r => r.json()).catch(() => ({ anomalies: [] })),
        fetch(`/api/observability/manifests/${caseId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
        fetch(`/api/observability/replay/${caseId}`).then(r => r.json()).catch(() => ({ replays: [] })),
        fetch(`/api/observability/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setTraces(tr.traces || []); setSyncs(sy.syncs || []); setIncidents(inc.incidents || []);
      setIntegrityEvts(intg.events || []); setAnomalies(an.anomalies || []);
      setManifests(mn.manifests || []); setReplays(rp.replays || []); setCerts(ct.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/observability/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderTraces = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Traces</h3>
      {traces.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.traceType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`${t.traceOrigin} → ${t.traceTarget}`} color="#3b82f6" />
              <Badge text={t.traceStatus} color={sc(t.traceStatus)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Duration: {t.durationMs}ms</div>
        </div>
      ))}
    </div>
  );

  const renderTelemetry = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Telemetry Synchronization</h3>
      {syncs.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.hashesMatch)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.sourceLayer} → {s.targetLayer}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.syncStatus} color={sc(s.syncStatus)} />
              <Badge text={s.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(s.hashesMatch)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Records synced: {s.recordsSynced}</div>
        </div>
      ))}
    </div>
  );

  const renderIncidents = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Incident Reconstruction</h3>
      {incidents.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.incidentType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={i.incidentSeverity} color={sc(i.incidentSeverity)} />
              <Badge text={i.rootCauseIdentified ? 'ROOT CAUSE FOUND' : 'INVESTIGATING'} color={sc(i.rootCauseIdentified)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Steps</span><div style={{ fontWeight: 700 }}>{i.stepsReconstructed}/{i.timelineSteps}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderIntegrity = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Integrity Monitoring</h3>
      {integrityEvts.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{e.eventType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.affectedComponent} color="#3b82f6" />
              <Badge text={e.eventSeverity} color={sc(e.eventSeverity)} />
              <Badge text={e.resolved ? 'RESOLVED' : 'OPEN'} color={sc(e.resolved)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAnomalies = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Anomaly Detection</h3>
      {anomalies.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.anomalyType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={a.detectionRule.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={a.detected ? 'DETECTED' : 'NORMAL'} color={a.detected ? '#ef4444' : '#22c55e'} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Baseline</span><div style={{ fontWeight: 700 }}>{a.baselineValue}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Observed</span><div style={{ fontWeight: 700 }}>{a.observedValue}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderManifests = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Audit Telemetry</h3>
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
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Replay Verification</h3>
      {replays.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.replayScope.replace(/_/g, ' ')}</span>
            <Badge text={r.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.hashesMatch)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Events Replayed</span><div style={{ fontWeight: 700 }}>{r.eventsReplayed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Duration</span><div style={{ fontWeight: 700 }}>{r.replayDurationMs}ms</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Observability Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Checks</span><div style={{ fontWeight: 700 }}>{c.checksPassed}/{c.checksTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.certificationRate >= 95 ? '#22c55e' : '#f59e0b' }}>{c.certificationRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'traces': return renderTraces();
      case 'telemetry': return renderTelemetry();
      case 'incidents': return renderIncidents();
      case 'integrity': return renderIntegrity();
      case 'anomalies': return renderAnomalies();
      case 'manifests': return renderManifests();
      case 'replay': return renderReplay();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Forensic Observability Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Transparent forensic observability — operational traceability
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Observability Analysis'}
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

export default ForensicObservabilityCockpit;
