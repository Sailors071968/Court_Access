// ============================================================================
// Phase K.1 — Institutional Deployment Cockpit
// 8-pane controlled adoption dashboard.
// Transparent operational governance — no opaque multi-tenant systems.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface DeployProps {
  organizationId: string;
}

interface OnboardEntry { id: string; organizationName: string; onboardingStatus: string; stepsCompleted: number; totalSteps: number; currentStep: string; }
interface IsolationEntry { id: string; tenantName: string; isolationLevel: string; isolationVerified: boolean; dataPartitionHash: string; }
interface GovEntry { id: string; controlType: string; controlScope: string; enforced: boolean; }
interface RolloutEntry { id: string; rolloutPhase: string; rolloutPercentage: number; rolloutStatus: string; usersEnabled: number; totalUsers: number; }
interface EnableEntry { id: string; featureName: string; enablementStatus: string; permissionScope: string; }
interface AuditEntry { id: string; auditPhase: string; auditScope: string; auditResult: string; findingsCount: number; criticalFindings: number; }
interface EnvEntry { id: string; environmentName: string; isolatedFromOthers: boolean; driftDetected: boolean; environmentHash: string; }
interface CertEntry { id: string; certificationScope: string; certificationStatus: string; certificationRate: number; evidenceRecordsCount: number; verifiedRecordsCount: number; }

type PaneName = 'onboarding' | 'isolation' | 'governance' | 'rollout' | 'enablement' | 'audit' | 'environments' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'onboarding', label: 'Onboarding Workflows' },
  { key: 'isolation', label: 'Tenant Isolation' },
  { key: 'governance', label: 'Deployment Governance' },
  { key: 'rollout', label: 'Rollout Readiness' },
  { key: 'enablement', label: 'Enablement Controls' },
  { key: 'audit', label: 'Audit Onboarding' },
  { key: 'environments', label: 'Environment Segregation' },
  { key: 'certification', label: 'Institutional Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'completed' || s === 'certified' || s === 'ready' || s === 'passed' || s === 'enabled' || s === 'active' || s === true ? '#22c55e' :
  s === 'conditional' || s === 'in_progress' || s === 'initiated' || s === 'paused' || s === 'pending_approval' || s === 'restricted' ? '#f59e0b' :
  s === 'failed' || s === 'suspended' || s === 'not_certified' || s === 'not_ready' || s === 'disabled' || s === false ? '#ef4444' : '#64748b';

export const InstitutionalDeploymentCockpit: React.FC<DeployProps> = ({ organizationId }) => {
  const [activePane, setActivePane] = useState<PaneName>('onboarding');
  const [loading, setLoading] = useState(false);
  const [onboard, setOnboard] = useState<OnboardEntry[]>([]);
  const [isolations, setIsolations] = useState<IsolationEntry[]>([]);
  const [govs, setGovs] = useState<GovEntry[]>([]);
  const [rollouts, setRollouts] = useState<RolloutEntry[]>([]);
  const [enables, setEnables] = useState<EnableEntry[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [envs, setEnvs] = useState<EnvEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [o, i, g, r, en, au, ev, c] = await Promise.all([
        fetch(`/api/deployment/onboarding/${organizationId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/deployment/isolation/${organizationId}`).then(r => r.json()).catch(() => ({ isolations: [] })),
        fetch(`/api/deployment/governance/${organizationId}`).then(r => r.json()).catch(() => ({ controls: [] })),
        fetch(`/api/deployment/rollout/${organizationId}`).then(r => r.json()).catch(() => ({ rollouts: [] })),
        fetch(`/api/deployment/enablement/${organizationId}`).then(r => r.json()).catch(() => ({ controls: [] })),
        fetch(`/api/deployment/audit/${organizationId}`).then(r => r.json()).catch(() => ({ audits: [] })),
        fetch(`/api/deployment/environments/${organizationId}`).then(r => r.json()).catch(() => ({ environments: [] })),
        fetch(`/api/deployment/certification/${organizationId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setOnboard(o.workflows || []); setIsolations(i.isolations || []); setGovs(g.controls || []);
      setRollouts(r.rollouts || []); setEnables(en.controls || []); setAudits(au.audits || []);
      setEnvs(ev.environments || []); setCerts(c.certifications || []);
    } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/deployment/analyze/${organizationId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderOnboarding = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Onboarding Workflows</h3>
      {onboard.map(o => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{o.organizationName}</span>
            <Badge text={o.onboardingStatus} color={sc(o.onboardingStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Progress</span><div style={{ fontWeight: 700 }}>{o.stepsCompleted}/{o.totalSteps}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Current Step</span><div style={{ fontSize: 13 }}>{o.currentStep.replace(/_/g, ' ')}</div></div>
            <div style={{ background: '#334155', borderRadius: 4, height: 8, marginTop: 16 }}>
              <div style={{ background: '#7c3aed', borderRadius: 4, height: 8, width: `${(o.stepsCompleted / o.totalSteps) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderIsolation = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Tenant Isolation</h3>
      {isolations.map(i => (
        <div key={i.id} style={{ ...card, borderLeft: `4px solid ${sc(i.isolationVerified)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.tenantName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={i.isolationLevel} color="#7c3aed" />
              <Badge text={i.isolationVerified ? 'VERIFIED' : 'UNVERIFIED'} color={sc(i.isolationVerified)} />
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{i.dataPartitionHash.slice(0, 32)}...</div>
        </div>
      ))}
    </div>
  );

  const renderGovernance = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deployment Governance</h3>
      {govs.map(g => (
        <div key={g.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{g.controlType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={g.controlScope} color="#3b82f6" />
              <Badge text={g.enforced ? 'ENFORCED' : 'DISABLED'} color={sc(g.enforced)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRollout = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Rollout Readiness</h3>
      {rollouts.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Phase: {r.rolloutPhase}</span>
            <Badge text={r.rolloutStatus} color={sc(r.rolloutStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Users</span><div style={{ fontWeight: 700 }}>{r.usersEnabled}/{r.totalUsers}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rollout %</span><div style={{ fontWeight: 700, color: '#7c3aed' }}>{r.rolloutPercentage}%</div></div>
            <div style={{ background: '#334155', borderRadius: 4, height: 8, marginTop: 16 }}>
              <div style={{ background: '#7c3aed', borderRadius: 4, height: 8, width: `${r.rolloutPercentage}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEnablement = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Enablement Controls</h3>
      {enables.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{e.featureName.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.permissionScope.replace(/_/g, ' ')} color="#3b82f6" />
              <Badge text={e.enablementStatus} color={sc(e.enablementStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAudit = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Audit Onboarding</h3>
      {audits.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.auditPhase.replace(/_/g, ' ')} — {a.auditScope.replace(/_/g, ' ')}</span>
            <Badge text={a.auditResult} color={sc(a.auditResult)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Findings</span><div style={{ fontWeight: 700 }}>{a.findingsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Critical</span><div style={{ color: a.criticalFindings > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{a.criticalFindings}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEnvironments = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Environment Segregation</h3>
      {envs.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.environmentName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.isolatedFromOthers ? 'ISOLATED' : 'SHARED'} color={sc(e.isolatedFromOthers)} />
              <Badge text={e.driftDetected ? 'DRIFT DETECTED' : 'NO DRIFT'} color={e.driftDetected ? '#ef4444' : '#22c55e'} />
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{e.environmentHash.slice(0, 32)}...</div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Institutional Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Evidence</span><div style={{ fontWeight: 700 }}>{c.evidenceRecordsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Verified</span><div style={{ fontWeight: 700 }}>{c.verifiedRecordsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.certificationRate >= 95 ? '#22c55e' : '#f59e0b' }}>{c.certificationRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'onboarding': return renderOnboarding();
      case 'isolation': return renderIsolation();
      case 'governance': return renderGovernance();
      case 'rollout': return renderRollout();
      case 'enablement': return renderEnablement();
      case 'audit': return renderAudit();
      case 'environments': return renderEnvironments();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Institutional Deployment Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Controlled adoption — transparent operational governance
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Deployment Analysis'}
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

export default InstitutionalDeploymentCockpit;
