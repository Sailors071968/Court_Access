// ============================================================================
// Phase P.2 — Customer Success Cockpit
// 8-pane enterprise scale operations + customer success governance dashboard.
// Disciplined scaling. Institutional reliability. Customer success governance.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface CockpitProps {
  customerId: string;
}

interface AutoscaleEntry { id: string; scalingResource: string; currentCapacity: number; targetCapacity: number; scalingTrigger: string; scalingStatus: string; }
interface SuccessEntry { id: string; operationType: string; customerName: string; healthScore: number; operationStatus: string; }
interface ElasticityEntry { id: string; elasticityScenario: string; baselineCapacity: number; peakCapacity: number; scaleUpTimeMs: number; elasticityStatus: string; }
interface TenantEntry { id: string; survivabilityMetric: string; metricScore: number; survivabilityStatus: string; tenantCount: number; concurrentUsers: number; }
interface CapacityEntry { id: string; planningDomain: string; currentUsage: number; projectedUsage: number; headroomPercent: number; planningStatus: string; }
interface DeployEntry { id: string; institutionName: string; onboardingPhase: string; phaseOrder: number; phaseStatus: string; seatCount: number; }
interface CostEntry { id: string; costCategory: string; monthlyBudget: number; monthlyActual: number; variancePercent: number; costStatus: string; }
interface ScaleCertEntry { id: string; certificationDomain: string; maxTestedLoad: number; targetLoad: number; scalingFactor: number; certificationStatus: string; }

type PaneName = 'autoscaling' | 'success' | 'elasticity' | 'multitenant' | 'capacity' | 'deployment' | 'costs' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'autoscaling', label: 'Autoscaling' },
  { key: 'success', label: 'Success' },
  { key: 'elasticity', label: 'Elasticity' },
  { key: 'multitenant', label: 'Multi-Tenant' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'costs', label: 'Costs' },
  { key: 'certification', label: 'Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'completed' || s === 'passed' || s === 'verified' || s === 'certified' || s === 'sufficient' || s === 'on_track' || s === 'under_budget' || s === 'on_budget' || s === 'validated' || s === true ? '#22c55e' :
  s === 'scaling_up' || s === 'scaling_down' || s === 'in_progress' || s === 'approaching_limit' || s === 'conditional' || s === 'at_risk' || s === 'degraded' ? '#f59e0b' :
  s === 'failed' || s === 'critical' || s === 'exceeded' || s === 'overdue' || s === 'over_budget' || s === false ? '#ef4444' :
  s === 'idle' || s === 'nominal' || s === 'stable' ? '#3b82f6' : '#64748b';

export const CustomerSuccessCockpit: React.FC<CockpitProps> = ({ customerId }) => {
  const [activePane, setActivePane] = useState<PaneName>('autoscaling');
  const [loading, setLoading] = useState(false);
  const [autoscale, setAutoscale] = useState<AutoscaleEntry[]>([]);
  const [success, setSuccess] = useState<SuccessEntry[]>([]);
  const [elasticity, setElasticity] = useState<ElasticityEntry[]>([]);
  const [tenants, setTenants] = useState<TenantEntry[]>([]);
  const [capacity, setCapacity] = useState<CapacityEntry[]>([]);
  const [deploys, setDeploys] = useState<DeployEntry[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [certs, setCerts] = useState<ScaleCertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [au, su, el, te, ca, de, co, ce] = await Promise.all([
        fetch(`/api/scale/autoscaling/${customerId}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`/api/scale/success/${customerId}`).then(r => r.json()).catch(() => ({ operations: [] })),
        fetch(`/api/scale/elasticity/${customerId}`).then(r => r.json()).catch(() => ({ tests: [] })),
        fetch(`/api/scale/multitenant/${customerId}`).then(r => r.json()).catch(() => ({ metrics: [] })),
        fetch(`/api/scale/capacity/${customerId}`).then(r => r.json()).catch(() => ({ plans: [] })),
        fetch(`/api/scale/deployment/${customerId}`).then(r => r.json()).catch(() => ({ phases: [] })),
        fetch(`/api/scale/costs/${customerId}`).then(r => r.json()).catch(() => ({ categories: [] })),
        fetch(`/api/scale/certification/${customerId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setAutoscale(au.events || []); setSuccess(su.operations || []);
      setElasticity(el.tests || []); setTenants(te.metrics || []);
      setCapacity(ca.plans || []); setDeploys(de.phases || []);
      setCosts(co.categories || []); setCerts(ce.certifications || []);
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/scale/analyze/${customerId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderAutoscaling = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Enterprise Autoscaling Governance</h3>
      {autoscale.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.scalingResource.replace(/_/g, ' ')}</span>
            <Badge text={a.scalingStatus} color={sc(a.scalingStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>Current: <strong>{a.currentCapacity}</strong></span>
            <span>Target: <strong>{a.targetCapacity}</strong></span>
            <span style={{ color: '#64748b' }}>Trigger: {a.scalingTrigger.replace(/_/g, ' ')}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSuccess = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Customer Success Operations</h3>
      {success.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.operationStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.operationType.replace(/_/g, ' ')}</span>
            <Badge text={s.operationStatus} color={sc(s.operationStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>{s.customerName}</span>
            <span style={{ fontWeight: 700, color: s.healthScore >= 90 ? '#22c55e' : s.healthScore >= 80 ? '#f59e0b' : '#ef4444' }}>Health: {s.healthScore}%</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderElasticity = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Infrastructure Elasticity</h3>
      {elasticity.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.elasticityScenario.replace(/_/g, ' ')}</span>
            <Badge text={e.elasticityStatus} color={sc(e.elasticityStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Baseline: {e.baselineCapacity}</span>
            <span>Peak: {e.peakCapacity}</span>
            <span>Scale-up: {(e.scaleUpTimeMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMultiTenant = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Multi-Tenant Survivability</h3>
      {tenants.map(t => (
        <div key={t.id} style={{ ...card, borderLeft: `4px solid ${sc(t.survivabilityStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.survivabilityMetric.replace(/_/g, ' ')}</span>
            <Badge text={t.survivabilityStatus} color={sc(t.survivabilityStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Score: <strong style={{ color: '#f8fafc' }}>{t.metricScore}%</strong></span>
            <span>{t.tenantCount} tenants</span>
            <span>{t.concurrentUsers} users</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCapacity = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Capacity Planning</h3>
      {capacity.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.planningDomain}</span>
            <Badge text={c.planningStatus} color={sc(c.planningStatus)} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ background: '#334155', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${c.currentUsage}%`, height: '100%', background: c.headroomPercent > 30 ? '#22c55e' : c.headroomPercent > 15 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Current: {c.currentUsage}%</span>
            <span>Projected: {c.projectedUsage}%</span>
            <span>Headroom: {c.headroomPercent}%</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDeployment = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Large Deployment Onboarding</h3>
      {deploys.map(d => (
        <div key={d.id} style={{ ...card, borderLeft: `4px solid ${sc(d.phaseStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{d.onboardingPhase.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>Phase {d.phaseOrder}</span>
            </div>
            <Badge text={d.phaseStatus} color={sc(d.phaseStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{d.institutionName} — {d.seatCount} seats</div>
        </div>
      ))}
    </div>
  );

  const renderCosts = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Cost Governance</h3>
      {costs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.costCategory}</span>
            <Badge text={c.costStatus} color={sc(c.costStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>Budget: <strong>${c.monthlyBudget.toLocaleString()}</strong></span>
            <span>Actual: <strong>${c.monthlyActual.toLocaleString()}</strong></span>
            <span style={{ color: c.variancePercent <= 0 ? '#22c55e' : '#ef4444' }}>
              {c.variancePercent > 0 ? '+' : ''}{c.variancePercent.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Scale Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.certificationStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationDomain.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Max tested: {c.maxTestedLoad.toLocaleString()}</span>
            <span>Target: {c.targetLoad.toLocaleString()}</span>
            <span style={{ fontWeight: 700, color: '#f8fafc' }}>{c.scalingFactor.toFixed(1)}x factor</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'autoscaling': return renderAutoscaling();
      case 'success': return renderSuccess();
      case 'elasticity': return renderElasticity();
      case 'multitenant': return renderMultiTenant();
      case 'capacity': return renderCapacity();
      case 'deployment': return renderDeployment();
      case 'costs': return renderCosts();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Customer Success Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Enterprise scale operations + customer success governance
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Running...' : 'Run Scale Analysis'}
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

export default CustomerSuccessCockpit;
