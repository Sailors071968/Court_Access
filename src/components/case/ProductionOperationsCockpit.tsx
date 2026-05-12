// ============================================================================
// Phase I.3 — Production Operations Cockpit
// 8-pane production assurance dashboard.
// Reproducible deployment — no opaque autonomous deployment behavior.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ProdProps {
  caseId: string;
}

interface CertEntry { id: string; deploymentId: string; environment: string; certificationStatus: string; stepsPassed: number; stepsFailed: number; releaseVersion: string; }
interface EnvEntry { id: string; environment: string; configHash: string; hashMatch: boolean; componentsPassed: number; componentsFailed: number; driftDetected: boolean; }
interface ReproEntry { id: string; releaseVersion: string; buildHash: string; reproducible: boolean; reproductionAttempts: number; }
interface RollbackEntry { id: string; deploymentId: string; rollbackType: string; rollbackVerified: boolean; estimatedDowntime: string; }
interface RuntimeEntry { id: string; configKey: string; configCategory: string; isMatch: boolean; isSensitive: boolean; }
interface ReadinessEntry { id: string; releaseVersion: string; overallScore: number; readinessStatus: string; checksPassed: number; checksFailed: number; }
interface SuiteEntry { id: string; suiteName: string; suiteType: string; testsPassed: number; testsFailed: number; executionDuration: number; }
interface DepEntry { id: string; packageName: string; packageVersion: string; hashMatch: boolean; dependencyType: string; vulnerabilitiesKnown: number; }

type PaneName = 'certification' | 'environment' | 'reproducibility' | 'rollback' | 'runtime' | 'dependencies' | 'lineage' | 'operational';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'certification', label: 'Deployment Certification' },
  { key: 'environment', label: 'Environment Integrity' },
  { key: 'reproducibility', label: 'Release Reproducibility' },
  { key: 'rollback', label: 'Rollback Readiness' },
  { key: 'runtime', label: 'Runtime Validation' },
  { key: 'dependencies', label: 'Dependency Integrity' },
  { key: 'lineage', label: 'Deployment Lineage' },
  { key: 'operational', label: 'Operational Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const statusColor = (s: string | boolean) =>
  s === 'certified' || s === 'ready' || s === 'passed' || s === true ? '#22c55e' :
  s === 'conditional' || s === 'in_progress' || s === 'pending' ? '#f59e0b' :
  s === 'failed' || s === 'not_ready' || s === false ? '#ef4444' : '#64748b';

export const ProductionOperationsCockpit: React.FC<ProdProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('certification');
  const [loading, setLoading] = useState(false);
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [envs, setEnvs] = useState<EnvEntry[]>([]);
  const [repros, setRepros] = useState<ReproEntry[]>([]);
  const [rollbacks, setRollbacks] = useState<RollbackEntry[]>([]);
  const [runtime, setRuntime] = useState<RuntimeEntry[]>([]);
  const [readiness, setReadiness] = useState<ReadinessEntry[]>([]);
  const [suites, setSuites] = useState<SuiteEntry[]>([]);
  const [deps, setDeps] = useState<DepEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e, rp, rb, rt, rd, s, d] = await Promise.all([
        fetch(`/api/production/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
        fetch(`/api/production/environment/${caseId}`).then(r => r.json()).catch(() => ({ verifications: [] })),
        fetch(`/api/production/reproducibility/${caseId}`).then(r => r.json()).catch(() => ({ validations: [] })),
        fetch(`/api/production/rollback/${caseId}`).then(r => r.json()).catch(() => ({ records: [] })),
        fetch(`/api/production/runtime/${caseId}`).then(r => r.json()).catch(() => ({ configs: [] })),
        fetch(`/api/production/readiness/${caseId}`).then(r => r.json()).catch(() => ({ scores: [] })),
        fetch(`/api/production/validation-suites/${caseId}`).then(r => r.json()).catch(() => ({ suites: [] })),
        fetch(`/api/production/dependencies/${caseId}`).then(r => r.json()).catch(() => ({ dependencies: [] })),
      ]);
      setCerts(c.certifications || []); setEnvs(e.verifications || []); setRepros(rp.validations || []);
      setRollbacks(rb.records || []); setRuntime(rt.configs || []); setReadiness(rd.scores || []);
      setSuites(s.suites || []); setDeps(d.dependencies || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/production/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deployment Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.deploymentId} — v{c.releaseVersion}</span>
            <Badge text={c.certificationStatus} color={statusColor(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Environment</span><div>{c.environment}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{c.stepsPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: c.stepsFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{c.stepsFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEnvironment = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Environment Integrity</h3>
      {envs.map(e => (
        <div key={e.id} style={{ ...card, borderLeft: `4px solid ${statusColor(e.hashMatch)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.environment}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.hashMatch ? 'HASH MATCH' : 'HASH MISMATCH'} color={statusColor(e.hashMatch)} />
              <Badge text={e.driftDetected ? 'DRIFT DETECTED' : 'NO DRIFT'} color={e.driftDetected ? '#ef4444' : '#22c55e'} />
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{e.configHash.slice(0, 32)}...</div>
        </div>
      ))}
    </div>
  );

  const renderReproducibility = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Release Reproducibility</h3>
      {repros.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>v{r.releaseVersion}</span>
            <Badge text={r.reproducible ? 'REPRODUCIBLE' : 'NOT REPRODUCIBLE'} color={statusColor(r.reproducible)} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Build: {r.buildHash.slice(0, 24)}...</div>
        </div>
      ))}
    </div>
  );

  const renderRollback = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Rollback Readiness</h3>
      {rollbacks.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.deploymentId} — {r.rollbackType}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.rollbackVerified ? 'VERIFIED' : 'UNVERIFIED'} color={statusColor(r.rollbackVerified)} />
              <Badge text={r.estimatedDowntime} color="#7c3aed" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRuntime = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Runtime Configuration</h3>
      {runtime.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.configKey} <Badge text={r.configCategory} color="#7c3aed" /></span>
            <div style={{ display: 'flex', gap: 8 }}>
              {r.isSensitive && <Badge text="SENSITIVE" color="#f59e0b" />}
              <Badge text={r.isMatch ? 'MATCH' : 'MISMATCH'} color={statusColor(r.isMatch)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDependencies = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Dependency Integrity</h3>
      {deps.map(d => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{d.packageName}@{d.packageVersion}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={d.dependencyType} color="#3b82f6" />
              <Badge text={d.hashMatch ? 'VERIFIED' : 'MISMATCH'} color={statusColor(d.hashMatch)} />
              {d.vulnerabilitiesKnown > 0 && <Badge text={`${d.vulnerabilitiesKnown} VULNS`} color="#ef4444" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLineage = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deployment Lineage</h3>
      {readiness.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>v{r.releaseVersion}</span>
            <Badge text={r.readinessStatus} color={statusColor(r.readinessStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Score</span><div style={{ fontSize: 18, fontWeight: 700, color: r.overallScore >= 95 ? '#22c55e' : '#f59e0b' }}>{r.overallScore}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{r.checksPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: r.checksFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{r.checksFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderOperational = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Certification</h3>
      {suites.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.suiteName}</span>
            <Badge text={s.suiteType.replace(/_/g, ' ')} color="#7c3aed" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{s.testsPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: s.testsFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{s.testsFailed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Duration</span><div>{s.executionDuration}ms</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'certification': return renderCertification();
      case 'environment': return renderEnvironment();
      case 'reproducibility': return renderReproducibility();
      case 'rollback': return renderRollback();
      case 'runtime': return renderRuntime();
      case 'dependencies': return renderDependencies();
      case 'lineage': return renderLineage();
      case 'operational': return renderOperational();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Production Operations Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Reproducible deployment — deterministic operational validation
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Production Analysis'}
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

export default ProductionOperationsCockpit;
