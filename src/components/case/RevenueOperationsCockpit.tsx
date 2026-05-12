// ============================================================================
// Phase O.3 — Revenue Operations Cockpit
// 8-pane LIVE billing enablement + revenue operations dashboard.
// Controlled LIVE billing. Disciplined revenue governance.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface RevenueProps {
  customerId: string;
}

interface GateEntry { id: string; activationGate: string; gateOrder: number; gateStatus: string; governanceApproved: boolean; }
interface MonitorEntry { id: string; monitorDomain: string; currentValue: number; monitorStatus: string; }
interface WorkflowEntry { id: string; workflowType: string; workflowStatus: string; immutable: boolean; }
interface IncidentEntry { id: string; incidentType: string; severity: string; responseTimeMs: number; resolvedAt: string | null; }
interface WebhookEntry { id: string; observabilityMetric: string; metricValue: number; metricUnit: string; observabilityStatus: string; }
interface CertEntry { id: string; certificationDomain: string; revenueAmount: number; discrepancyAmount: number; certificationStatus: string; }
interface RollbackEntry { id: string; rollbackTrigger: string; rollbackScope: string; rollbackSteps: number; stepsCompleted: number; rollbackStatus: string; }
interface StewardEntry { id: string; stewardshipArea: string; stewardshipLevel: string; stewardshipScore: number; }

type PaneName = 'activation' | 'monitoring' | 'revenue' | 'incidents' | 'webhooks' | 'certification' | 'rollbacks' | 'stewardship';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'activation', label: 'LIVE Activation' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'revenue', label: 'Revenue Ops' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'certification', label: 'Certification' },
  { key: 'rollbacks', label: 'Rollbacks' },
  { key: 'stewardship', label: 'Stewardship' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'passed' || s === 'healthy' || s === 'completed' || s === 'verified' || s === 'exemplary' || s === 'resolved' || s === true ? '#22c55e' :
  s === 'pending' || s === 'warning' || s === 'mature' || s === 'conditional' || s === 'investigating' ? '#3b82f6' :
  s === 'failed' || s === 'critical' || s === 'degraded' || s === false ? '#ef4444' :
  s === 'operational' || s === 'developing' ? '#f59e0b' : '#64748b';

const fmtDollars = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export const RevenueOperationsCockpit: React.FC<RevenueProps> = ({ customerId }) => {
  const [activePane, setActivePane] = useState<PaneName>('activation');
  const [loading, setLoading] = useState(false);
  const [gates, setGates] = useState<GateEntry[]>([]);
  const [monitors, setMonitors] = useState<MonitorEntry[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowEntry[]>([]);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [rollbacks, setRollbacks] = useState<RollbackEntry[]>([]);
  const [stewards, setStewards] = useState<StewardEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ga, mo, wf, inc, wh, ce, rb, st] = await Promise.all([
        fetch(`/api/livebilling/activation/${customerId}`).then(r => r.json()).catch(() => ({ gates: [] })),
        fetch(`/api/livebilling/monitoring/${customerId}`).then(r => r.json()).catch(() => ({ monitors: [] })),
        fetch(`/api/livebilling/revenue/${customerId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/livebilling/incidents/${customerId}`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`/api/livebilling/webhooks/${customerId}`).then(r => r.json()).catch(() => ({ metrics: [] })),
        fetch(`/api/livebilling/certification/${customerId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
        fetch(`/api/livebilling/rollbacks/${customerId}`).then(r => r.json()).catch(() => ({ rollbacks: [] })),
        fetch(`/api/livebilling/stewardship/${customerId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
      ]);
      setGates(ga.gates || []); setMonitors(mo.monitors || []);
      setWorkflows(wf.workflows || []); setIncidents(inc.incidents || []);
      setWebhooks(wh.metrics || []); setCerts(ce.certifications || []);
      setRollbacks(rb.rollbacks || []); setStewards(st.manifests || []);
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/livebilling/analyze/${customerId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderActivation = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>LIVE Stripe Activation Governance</h3>
      {gates.map(g => (
        <div key={g.id} style={{ ...card, borderLeft: `4px solid ${sc(g.gateStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{g.activationGate.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>Gate {g.gateOrder}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={g.governanceApproved ? 'APPROVED' : 'PENDING'} color={sc(g.governanceApproved)} />
              <Badge text={g.gateStatus} color={sc(g.gateStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMonitoring = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Billing Monitoring</h3>
      {monitors.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.monitorDomain.replace(/_/g, ' ')}</span>
            <Badge text={m.monitorStatus} color={sc(m.monitorStatus)} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 24, color: sc(m.monitorStatus) }}>{m.currentValue}</div>
        </div>
      ))}
    </div>
  );

  const renderRevenue = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Revenue Operations Workflows</h3>
      {workflows.map(w => (
        <div key={w.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{w.workflowType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={w.immutable ? 'IMMUTABLE' : 'MUTABLE'} color={sc(w.immutable)} />
              <Badge text={w.workflowStatus} color={sc(w.workflowStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderIncidents = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Billing Incident Response</h3>
      {incidents.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.incidentType.replace(/_/g, ' ')}</span>
            <Badge text={i.severity} color={sc(i.severity)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Response: {(i.responseTimeMs / 1000).toFixed(1)}s</span>
            <span>{i.resolvedAt ? 'RESOLVED' : 'OPEN'}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderWebhooks = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>LIVE Webhook Observability</h3>
      {webhooks.map(w => (
        <div key={w.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{w.observabilityMetric.replace(/_/g, ' ')}</span>
            <Badge text={w.observabilityStatus} color={sc(w.observabilityStatus)} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>
            {w.metricValue}{w.metricUnit === 'percent' ? '%' : w.metricUnit === 'ms' ? 'ms' : w.metricUnit === 'per_second' ? '/s' : ''}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCerts = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Revenue Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.certificationStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationDomain.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Revenue: {fmtDollars(c.revenueAmount * 100)}</span>
            <span>Discrepancy: {fmtDollars(c.discrepancyAmount * 100)}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRollbacks = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Financial Rollback Governance</h3>
      {rollbacks.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{r.rollbackTrigger.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{r.rollbackScope.replace(/_/g, ' ')}</span>
            </div>
            <Badge text={r.rollbackStatus} color={sc(r.rollbackStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Steps: {r.stepsCompleted}/{r.rollbackSteps}</div>
        </div>
      ))}
    </div>
  );

  const renderStewardship = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Revenue Stewardship</h3>
      {stewards.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.stewardshipLevel)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.stewardshipArea.replace(/_/g, ' ')}</span>
            <Badge text={s.stewardshipLevel} color={sc(s.stewardshipLevel)} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: s.stewardshipScore >= 95 ? '#22c55e' : '#f59e0b' }}>{s.stewardshipScore}%</div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'activation': return renderActivation();
      case 'monitoring': return renderMonitoring();
      case 'revenue': return renderRevenue();
      case 'incidents': return renderIncidents();
      case 'webhooks': return renderWebhooks();
      case 'certification': return renderCerts();
      case 'rollbacks': return renderRollbacks();
      case 'stewardship': return renderStewardship();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Revenue Operations Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Controlled LIVE billing enablement + revenue operations governance
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Running...' : 'Run LIVE Analysis'}
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

export default RevenueOperationsCockpit;
