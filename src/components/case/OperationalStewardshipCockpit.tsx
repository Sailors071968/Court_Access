// ============================================================================
// Phase P.1 — Operational Stewardship Cockpit
// 8-pane enterprise production rollout + operational stewardship dashboard.
// Disciplined operational stewardship. Controlled enterprise enablement.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface StewardshipProps {
  customerId: string;
}

interface RolloutEntry { id: string; rolloutStage: string; stageOrder: number; stageStatus: string; governanceApproved: boolean; }
interface MonitorEntry { id: string; operationDomain: string; currentValue: number; targetValue: number; monitorStatus: string; trendDirection: string; }
interface SupportEntry { id: string; supportCategory: string; priority: string; workflowStatus: string; slaTargetMs: number; slaActualMs: number; }
interface AttorneyEntry { id: string; attorneyName: string; onboardingStep: string; stepOrder: number; stepStatus: string; }
interface IncidentEntry { id: string; incidentCategory: string; severity: string; incidentStatus: string; responseTimeMs: number; }
interface SlaEntry { id: string; slaMetric: string; targetValue: number; actualValue: number; slaMet: boolean; }
interface TelemetryEntry { id: string; workflowName: string; executionCount: number; avgDurationMs: number; errorRate: number; userSatisfaction: number; }
interface ReadinessEntry { id: string; certificationArea: string; certificationStatus: string; gatesTotal: number; gatesPassed: number; certificationRate: number; }

type PaneName = 'rollout' | 'monitoring' | 'support' | 'attorneys' | 'incidents' | 'slas' | 'telemetry' | 'readiness';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'rollout', label: 'Rollout' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'support', label: 'Support' },
  { key: 'attorneys', label: 'Attorneys' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'slas', label: 'SLAs' },
  { key: 'telemetry', label: 'Telemetry' },
  { key: 'readiness', label: 'Readiness' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'completed' || s === 'nominal' || s === 'resolved' || s === 'certified' || s === 'compliant' || s === true ? '#22c55e' :
  s === 'in_progress' || s === 'warning' || s === 'conditional' || s === 'needs_attention' || s === 'investigating' ? '#3b82f6' :
  s === 'failed' || s === 'critical' || s === 'degraded' || s === 'non_compliant' || s === false ? '#ef4444' :
  s === 'pending' || s === 'improving' || s === 'stable' ? '#f59e0b' : '#64748b';

export const OperationalStewardshipCockpit: React.FC<StewardshipProps> = ({ customerId }) => {
  const [activePane, setActivePane] = useState<PaneName>('rollout');
  const [loading, setLoading] = useState(false);
  const [rollout, setRollout] = useState<RolloutEntry[]>([]);
  const [monitors, setMonitors] = useState<MonitorEntry[]>([]);
  const [support, setSupport] = useState<SupportEntry[]>([]);
  const [attorneys, setAttorneys] = useState<AttorneyEntry[]>([]);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [slas, setSlas] = useState<SlaEntry[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [readiness, setReadiness] = useState<ReadinessEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ro, mo, su, at, inc, sl, te, re] = await Promise.all([
        fetch(`/api/production/rollout/${customerId}`).then(r => r.json()).catch(() => ({ stages: [] })),
        fetch(`/api/production/monitoring/${customerId}`).then(r => r.json()).catch(() => ({ monitors: [] })),
        fetch(`/api/production/support/${customerId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/production/attorneys/${customerId}`).then(r => r.json()).catch(() => ({ steps: [] })),
        fetch(`/api/production/incidents/${customerId}`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`/api/production/slas/${customerId}`).then(r => r.json()).catch(() => ({ slas: [] })),
        fetch(`/api/production/telemetry/${customerId}`).then(r => r.json()).catch(() => ({ telemetry: [] })),
        fetch(`/api/production/readiness/${customerId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setRollout(ro.stages || []); setMonitors(mo.monitors || []);
      setSupport(su.workflows || []); setAttorneys(at.steps || []);
      setIncidents(inc.incidents || []); setSlas(sl.slas || []);
      setTelemetry(te.telemetry || []); setReadiness(re.certifications || []);
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/production/analyze/${customerId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderRollout = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Controlled Institutional Rollout</h3>
      {rollout.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(r.stageStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{r.rolloutStage.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>Stage {r.stageOrder}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={r.governanceApproved ? 'APPROVED' : 'PENDING'} color={sc(r.governanceApproved)} />
              <Badge text={r.stageStatus} color={sc(r.stageStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMonitoring = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Operations Monitoring</h3>
      {monitors.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.operationDomain.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={m.trendDirection} color={sc(m.trendDirection)} />
              <Badge text={m.monitorStatus} color={sc(m.monitorStatus)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>Current: <strong>{m.currentValue}</strong></span>
            <span style={{ color: '#64748b' }}>Target: {m.targetValue}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSupport = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Enterprise Support Workflows</h3>
      {support.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.supportCategory.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={s.priority} color={sc(s.priority)} />
              <Badge text={s.slaActualMs <= s.slaTargetMs ? 'SLA MET' : 'SLA MISS'} color={sc(s.slaActualMs <= s.slaTargetMs)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAttorneys = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Attorney Onboarding</h3>
      {attorneys.map(a => (
        <div key={a.id} style={{ ...card, borderLeft: `4px solid ${sc(a.stepStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{a.onboardingStep.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>Step {a.stepOrder}</span>
            </div>
            <Badge text={a.stepStatus} color={sc(a.stepStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{a.attorneyName}</div>
        </div>
      ))}
    </div>
  );

  const renderIncidents = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Incident Governance</h3>
      {incidents.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.incidentCategory.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={i.severity} color={sc(i.severity)} />
              <Badge text={i.incidentStatus} color={sc(i.incidentStatus)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Response: {(i.responseTimeMs / 1000).toFixed(1)}s</div>
        </div>
      ))}
    </div>
  );

  const renderSlas = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Institutional SLA Tracking</h3>
      {slas.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.slaMet)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.slaMetric.replace(/_/g, ' ')}</span>
            <Badge text={s.slaMet ? 'SLA MET' : 'SLA MISS'} color={sc(s.slaMet)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>Actual: <strong>{s.actualValue}</strong></span>
            <span style={{ color: '#64748b' }}>Target: {s.targetValue}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTelemetry = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Real-World Workflow Telemetry</h3>
      {telemetry.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.workflowName.replace(/_/g, ' ')}</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{t.executionCount} executions</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Avg: {t.avgDurationMs}ms</span>
            <span>Error: {t.errorRate}%</span>
            <span>Satisfaction: {t.userSatisfaction}/5</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReadiness = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Enterprise Readiness Certification</h3>
      {readiness.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(r.certificationStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.certificationArea.replace(/_/g, ' ')}</span>
            <Badge text={r.certificationStatus} color={sc(r.certificationStatus)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Gates: {r.gatesPassed}/{r.gatesTotal}</span>
            <span style={{ fontWeight: 700, color: r.certificationRate >= 100 ? '#22c55e' : '#f59e0b' }}>{r.certificationRate.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'rollout': return renderRollout();
      case 'monitoring': return renderMonitoring();
      case 'support': return renderSupport();
      case 'attorneys': return renderAttorneys();
      case 'incidents': return renderIncidents();
      case 'slas': return renderSlas();
      case 'telemetry': return renderTelemetry();
      case 'readiness': return renderReadiness();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Operational Stewardship Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Controlled enterprise production rollout + operational stewardship
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Running...' : 'Run Production Analysis'}
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

export default OperationalStewardshipCockpit;
