// ============================================================================
// Phase N.1 — Production Readiness Cockpit
// 8-pane operational readiness dashboard.
// Deterministic, reproducible, auditable, transparent.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ReadinessProps {
  caseId: string;
}

interface IntegrationEntry { id: string; testSuite: string; testsTotal: number; testsPassed: number; testsFailed: number; testStatus: string; }
interface RegressionEntry { id: string; validationLayer: string; hashesMatch: boolean; regressionDetected: boolean; }
interface BenchmarkEntry { id: string; benchmarkName: string; operationsCount: number; avgLatencyMs: number; p95LatencyMs: number; throughputPerSec: number; benchmarkStatus: string; }
interface StabilityEntry { id: string; stabilityDomain: string; uptimePercentage: number; errorRate: number; recoveryTimeMs: number; stabilityStatus: string; }
interface RehearsalEntry { id: string; rehearsalType: string; stepsTotal: number; stepsCompleted: number; rehearsalStatus: string; }
interface SimulationEntry { id: string; workflowName: string; simulationSteps: number; stepsSucceeded: number; stepsFailed: number; simulationStatus: string; }
interface SecurityEntry { id: string; securityDomain: string; checksTotal: number; checksPassed: number; checksFailed: number; securityStatus: string; }
interface CertEntry { id: string; certificationScope: string; certificationRate: number; certificationStatus: string; rulesTotal: number; rulesPassed: number; }

type PaneName = 'integration' | 'regression' | 'benchmarks' | 'stability' | 'rehearsal' | 'simulations' | 'security' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'integration', label: 'Integration Testing' },
  { key: 'regression', label: 'Regression Validation' },
  { key: 'benchmarks', label: 'Performance Benchmarks' },
  { key: 'stability', label: 'Stability Verification' },
  { key: 'rehearsal', label: 'Deployment Rehearsal' },
  { key: 'simulations', label: 'Workflow Simulations' },
  { key: 'security', label: 'Security Validation' },
  { key: 'certification', label: 'Production Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'passed' || s === 'stable' || s === 'completed' || s === 'hardened' || s === 'certified' || s === true ? '#22c55e' :
  s === 'running' || s === 'partial' || s === 'degraded' || s === 'conditional' || s === 'recovering' ? '#f59e0b' :
  s === 'failed' || s === 'unstable' || s === 'vulnerable' || s === 'not_certified' || s === false ? '#ef4444' : '#64748b';

export const ProductionReadinessCockpit: React.FC<ReadinessProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('integration');
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationEntry[]>([]);
  const [regressions, setRegressions] = useState<RegressionEntry[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([]);
  const [stabilities, setStabilities] = useState<StabilityEntry[]>([]);
  const [rehearsals, setRehearsals] = useState<RehearsalEntry[]>([]);
  const [simulations, setSimulations] = useState<SimulationEntry[]>([]);
  const [securities, setSecurities] = useState<SecurityEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [i, rg, b, st, rh, sm, sc, ct] = await Promise.all([
        fetch(`/api/readiness/integration/${caseId}`).then(r => r.json()).catch(() => ({ tests: [] })),
        fetch(`/api/readiness/regression/${caseId}`).then(r => r.json()).catch(() => ({ regressions: [] })),
        fetch(`/api/readiness/benchmarks/${caseId}`).then(r => r.json()).catch(() => ({ benchmarks: [] })),
        fetch(`/api/readiness/stability/${caseId}`).then(r => r.json()).catch(() => ({ stability: [] })),
        fetch(`/api/readiness/rehearsal/${caseId}`).then(r => r.json()).catch(() => ({ rehearsals: [] })),
        fetch(`/api/readiness/simulations/${caseId}`).then(r => r.json()).catch(() => ({ simulations: [] })),
        fetch(`/api/readiness/security/${caseId}`).then(r => r.json()).catch(() => ({ security: [] })),
        fetch(`/api/readiness/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setIntegrations(i.tests || []); setRegressions(rg.regressions || []);
      setBenchmarks(b.benchmarks || []); setStabilities(st.stability || []);
      setRehearsals(rh.rehearsals || []); setSimulations(sm.simulations || []);
      setSecurities(sc.security || []); setCerts(ct.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/readiness/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderIntegration = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Integration Testing</h3>
      {integrations.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.testSuite.replace(/_/g, ' ')}</span>
            <Badge text={t.testStatus} color={sc(t.testStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Total</span><div style={{ fontWeight: 700 }}>{t.testsTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ fontWeight: 700, color: '#22c55e' }}>{t.testsPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ fontWeight: 700, color: t.testsFailed > 0 ? '#ef4444' : '#22c55e' }}>{t.testsFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRegression = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Regression Validation</h3>
      {regressions.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(!r.regressionDetected)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{r.validationLayer}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.hashesMatch)} />
              <Badge text={r.regressionDetected ? 'REGRESSION' : 'STABLE'} color={sc(!r.regressionDetected)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBenchmarks = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Performance Benchmarks</h3>
      {benchmarks.map(b => (
        <div key={b.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{b.benchmarkName.replace(/_/g, ' ')}</span>
            <Badge text={b.benchmarkStatus} color={sc(b.benchmarkStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Ops</span><div style={{ fontWeight: 700 }}>{b.operationsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Avg (ms)</span><div style={{ fontWeight: 700 }}>{b.avgLatencyMs}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>P95 (ms)</span><div style={{ fontWeight: 700 }}>{b.p95LatencyMs}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>TPS</span><div style={{ fontWeight: 700 }}>{b.throughputPerSec}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStability = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Stability Verification</h3>
      {stabilities.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.stabilityDomain.replace(/_/g, ' ')}</span>
            <Badge text={s.stabilityStatus} color={sc(s.stabilityStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Uptime</span><div style={{ fontWeight: 700, color: s.uptimePercentage >= 99.9 ? '#22c55e' : '#f59e0b' }}>{s.uptimePercentage}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Error Rate</span><div style={{ fontWeight: 700 }}>{s.errorRate}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Recovery</span><div style={{ fontWeight: 700 }}>{s.recoveryTimeMs}ms</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRehearsal = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deployment Rehearsal</h3>
      {rehearsals.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.rehearsalType.replace(/_/g, ' ')}</span>
            <Badge text={r.rehearsalStatus} color={sc(r.rehearsalStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Steps: {r.stepsCompleted}/{r.stepsTotal}</div>
        </div>
      ))}
    </div>
  );

  const renderSimulations = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Workflow Simulations</h3>
      {simulations.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.workflowName.replace(/_/g, ' ')}</span>
            <Badge text={s.simulationStatus} color={sc(s.simulationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Steps</span><div style={{ fontWeight: 700 }}>{s.simulationSteps}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Succeeded</span><div style={{ fontWeight: 700, color: '#22c55e' }}>{s.stepsSucceeded}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ fontWeight: 700, color: s.stepsFailed > 0 ? '#ef4444' : '#22c55e' }}>{s.stepsFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSecurity = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Security Validation</h3>
      {securities.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.securityDomain.replace(/_/g, ' ')}</span>
            <Badge text={s.securityStatus} color={sc(s.securityStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Checks</span><div style={{ fontWeight: 700 }}>{s.checksTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ fontWeight: 700, color: '#22c55e' }}>{s.checksPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ fontWeight: 700, color: s.checksFailed > 0 ? '#ef4444' : '#22c55e' }}>{s.checksFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rules</span><div style={{ fontWeight: 700 }}>{c.rulesPassed}/{c.rulesTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.certificationRate >= 100 ? '#22c55e' : '#f59e0b' }}>{c.certificationRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'integration': return renderIntegration();
      case 'regression': return renderRegression();
      case 'benchmarks': return renderBenchmarks();
      case 'stability': return renderStability();
      case 'rehearsal': return renderRehearsal();
      case 'simulations': return renderSimulations();
      case 'security': return renderSecurity();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Production Readiness Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Deterministic validation — controlled production enablement
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Validating...' : 'Run Production Readiness'}
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

export default ProductionReadinessCockpit;
