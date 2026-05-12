// ============================================================================
// Phase N.5 — Enterprise Rollout Cockpit
// 8-pane controlled production enablement dashboard.
// Disciplined operational stewardship. No speculative subsystem growth.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface RolloutProps {
  caseId: string;
}

interface StageEntry { id: string; rolloutStage: string; targetPercentage: number; currentPercentage: number; governanceApproved: boolean; rolloutStatus: string; }
interface OnboardEntry { id: string; institutionName: string; onboardingPhase: string; stepsTotal: number; stepsCompleted: number; executionStatus: string; }
interface MonitorEntry { id: string; monitoringDomain: string; dashboardConfigured: boolean; alertsConfigured: boolean; readinessScore: number; readinessStatus: string; }
interface IncidentEntry { id: string; incidentType: string; severityLevel: string; responseTimeMs: number; resolutionStatus: string; }
interface SupportEntry { id: string; supportCategory: string; requestType: string; priorityLevel: string; slaMetric: boolean; supportStatus: string; }
interface CertEntry { id: string; certificationGate: string; gateStatus: string; }
interface RollbackEntry { id: string; rollbackTrigger: string; rollbackScope: string; rollbackSteps: number; stepsCompleted: number; rollbackStatus: string; }
interface StewardEntry { id: string; stewardshipArea: string; verified: boolean; stewardshipLevel: string; }

type PaneName = 'stages' | 'onboarding' | 'monitoring' | 'incidents' | 'support' | 'certification' | 'rollbacks' | 'stewardship';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'stages', label: 'Staged Rollout' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'incidents', label: 'Incident Response' },
  { key: 'support', label: 'Support' },
  { key: 'certification', label: 'Certification' },
  { key: 'rollbacks', label: 'Rollback Gov.' },
  { key: 'stewardship', label: 'Stewardship' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'completed' || s === 'passed' || s === 'resolved' || s === 'ready' || s === 'verified' || s === 'enabled' || s === 'exemplary' || s === true ? '#22c55e' :
  s === 'active' || s === 'conditional' || s === 'mature' || s === 'operational' || s === 'staged' || s === 'current' ? '#3b82f6' :
  s === 'pending' || s === 'partial' || s === 'due_soon' || s === 'pending_approval' || s === 'foundational' ? '#f59e0b' :
  s === 'failed' || s === 'critical' || s === 'rolled_back' || s === 'overdue' || s === false ? '#ef4444' : '#64748b';

export const EnterpriseRolloutCockpit: React.FC<RolloutProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('stages');
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<StageEntry[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardEntry[]>([]);
  const [monitoring, setMonitoring] = useState<MonitorEntry[]>([]);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [support, setSupport] = useState<SupportEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [rollbacks, setRollbacks] = useState<RollbackEntry[]>([]);
  const [stewardship, setStewardship] = useState<StewardEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [st, ob, mo, ic, su, ce, rb, sw] = await Promise.all([
        fetch(`/api/rollout/stages/${caseId}`).then(r => r.json()).catch(() => ({ stages: [] })),
        fetch(`/api/rollout/onboarding/${caseId}`).then(r => r.json()).catch(() => ({ executions: [] })),
        fetch(`/api/rollout/monitoring/${caseId}`).then(r => r.json()).catch(() => ({ monitoring: [] })),
        fetch(`/api/rollout/incidents/${caseId}`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`/api/rollout/support/${caseId}`).then(r => r.json()).catch(() => ({ support: [] })),
        fetch(`/api/rollout/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
        fetch(`/api/rollout/rollbacks/${caseId}`).then(r => r.json()).catch(() => ({ rollbacks: [] })),
        fetch(`/api/rollout/stewardship/${caseId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
      ]);
      setStages(st.stages || []); setOnboarding(ob.executions || []);
      setMonitoring(mo.monitoring || []); setIncidents(ic.incidents || []);
      setSupport(su.support || []); setCerts(ce.certifications || []);
      setRollbacks(rb.rollbacks || []); setStewardship(sw.manifests || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/rollout/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderStages = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Staged Rollout Governance</h3>
      {stages.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.rolloutStage.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.governanceApproved ? 'APPROVED' : 'PENDING'} color={sc(s.governanceApproved)} />
              <Badge text={s.rolloutStatus} color={sc(s.rolloutStatus)} />
            </div>
          </div>
          <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 4, height: 8 }}>
            <div style={{ width: `${s.currentPercentage}%`, height: '100%', background: '#7c3aed', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.currentPercentage}% / {s.targetPercentage}% target</div>
        </div>
      ))}
    </div>
  );

  const renderOnboarding = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Enterprise Onboarding</h3>
      {onboarding.map(o => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{o.onboardingPhase.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{o.institutionName}</div>
            </div>
            <Badge text={o.executionStatus} color={sc(o.executionStatus)} />
          </div>
          <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${(o.stepsCompleted / o.stepsTotal) * 100}%`, height: '100%', background: '#7c3aed', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{o.stepsCompleted}/{o.stepsTotal} steps</div>
        </div>
      ))}
    </div>
  );

  const renderMonitoring = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Monitoring</h3>
      {monitoring.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.monitoringDomain.replace(/_/g, ' ')}</span>
            <Badge text={m.readinessStatus} color={sc(m.readinessStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div><Badge text={m.dashboardConfigured ? 'Dashboard' : 'No Dashboard'} color={sc(m.dashboardConfigured)} /></div>
            <div><Badge text={m.alertsConfigured ? 'Alerts' : 'No Alerts'} color={sc(m.alertsConfigured)} /></div>
            <div style={{ marginLeft: 'auto', fontWeight: 700, color: m.readinessScore >= 95 ? '#22c55e' : '#f59e0b' }}>{m.readinessScore}%</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderIncidents = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Incident Response</h3>
      {incidents.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.incidentType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={i.severityLevel} color={sc(i.severityLevel)} />
              <Badge text={i.resolutionStatus} color={sc(i.resolutionStatus)} />
            </div>
          </div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Response: </span><span style={{ fontWeight: 700 }}>{(i.responseTimeMs / 1000).toFixed(1)}s</span></div>
        </div>
      ))}
    </div>
  );

  const renderSupport = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Support Workflows</h3>
      {support.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{s.requestType.replace(/_/g, ' ')}</span>
              <div style={{ fontSize: 12, color: '#64748b' }}>{s.supportCategory}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.priorityLevel} color={sc(s.priorityLevel)} />
              <Badge text={s.slaMetric ? 'SLA MET' : 'SLA MISS'} color={sc(s.slaMetric)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Rollout Certification Gates</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.gateStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.certificationGate.replace(/_/g, ' ')}</span>
            <Badge text={c.gateStatus} color={sc(c.gateStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderRollbacks = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Rollback Governance</h3>
      {rollbacks.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.rollbackTrigger.replace(/_/g, ' ')}</span>
            <Badge text={r.rollbackStatus} color={sc(r.rollbackStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Scope: </span><span>{r.rollbackScope.replace(/_/g, ' ')}</span></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Steps: </span><span style={{ fontWeight: 700 }}>{r.stepsCompleted}/{r.rollbackSteps}</span></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStewardship = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Stewardship</h3>
      {stewardship.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.verified)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{s.stewardshipArea.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.stewardshipLevel} color={sc(s.stewardshipLevel)} />
              <Badge text={s.verified ? 'VERIFIED' : 'PENDING'} color={sc(s.verified)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'stages': return renderStages();
      case 'onboarding': return renderOnboarding();
      case 'monitoring': return renderMonitoring();
      case 'incidents': return renderIncidents();
      case 'support': return renderSupport();
      case 'certification': return renderCertification();
      case 'rollbacks': return renderRollbacks();
      case 'stewardship': return renderStewardship();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Enterprise Rollout Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Controlled production enablement + enterprise rollout governance
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Deploying...' : 'Run Rollout Analysis'}
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

export default EnterpriseRolloutCockpit;
