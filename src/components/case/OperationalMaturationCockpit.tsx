// ============================================================================
// Phase N.4 — Operational Maturation Cockpit
// 8-pane operational maturation dashboard.
// Operational refinement. No speculative architecture growth.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface MaturationProps {
  caseId: string;
}

interface ReviewEntry { id: string; reviewerId: string; reviewerRole: string; workflowReviewed: string; usabilityScore: number; accuracyScore: number; speedScore: number; overallRating: number; }
interface CycleEntry { id: string; optimizationArea: string; cycleName: string; beforeScore: number; afterScore: number; improvementPct: number; cycleStatus: string; }
interface TuningEntry { id: string; tuningDomain: string; metricBefore: number; metricAfter: number; improvementPct: number; tuningStatus: string; }
interface MaturityEntry { id: string; maturityDomain: string; maturityLevel: string; checksTotal: number; checksPassed: number; maturityScore: number; }
interface TelemetryEntry { id: string; telemetryArea: string; signalToNoiseRatio: number; coveragePercentage: number; refinementStatus: string; }
interface OnboardEntry { id: string; onboardingPhase: string; stepsTotal: number; stepsCompleted: number; rehearsalStatus: string; }
interface StabilityEntry { id: string; testDurationHours: number; requestsProcessed: number; errorsEncountered: number; uptimePercentage: number; stabilityStatus: string; }
interface CertEntry { id: string; manifestArea: string; verified: boolean; maturityLevel: string; }

type PaneName = 'reviews' | 'uiux' | 'infrastructure' | 'deployment' | 'telemetry' | 'onboarding' | 'stability' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'reviews', label: 'Attorney Reviews' },
  { key: 'uiux', label: 'UI/UX Optimization' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'deployment', label: 'Deployment Maturity' },
  { key: 'telemetry', label: 'Telemetry' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'stability', label: 'Stability' },
  { key: 'certification', label: 'Maturity Cert' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'completed' || s === 'validated' || s === 'optimized' || s === 'optimal' || s === 'excellent' || s === 'certified' || s === true ? '#22c55e' :
  s === 'mature' || s === 'refined' || s === 'measured' || s === 'stable' || s === 'good' || s === 'conditional' ? '#3b82f6' :
  s === 'developing' || s === 'defined' || s === 'managed' || s === 'acceptable' || s === 'noisy' ? '#f59e0b' :
  s === 'failed' || s === 'critical' || s === 'unstable' || s === 'initial' || s === false ? '#ef4444' : '#64748b';

export const OperationalMaturationCockpit: React.FC<MaturationProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('reviews');
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [tunings, setTunings] = useState<TuningEntry[]>([]);
  const [maturity, setMaturity] = useState<MaturityEntry[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardEntry[]>([]);
  const [stability, setStability] = useState<StabilityEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rv, cy, tu, ma, te, ob, st, ce] = await Promise.all([
        fetch(`/api/maturation/reviews/${caseId}`).then(r => r.json()).catch(() => ({ reviews: [] })),
        fetch(`/api/maturation/uiux/${caseId}`).then(r => r.json()).catch(() => ({ cycles: [] })),
        fetch(`/api/maturation/infrastructure/${caseId}`).then(r => r.json()).catch(() => ({ tunings: [] })),
        fetch(`/api/maturation/deployment/${caseId}`).then(r => r.json()).catch(() => ({ maturity: [] })),
        fetch(`/api/maturation/telemetry/${caseId}`).then(r => r.json()).catch(() => ({ telemetry: [] })),
        fetch(`/api/maturation/onboarding/${caseId}`).then(r => r.json()).catch(() => ({ rehearsals: [] })),
        fetch(`/api/maturation/stability/${caseId}`).then(r => r.json()).catch(() => ({ stability: [] })),
        fetch(`/api/maturation/manifests/${caseId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
      ]);
      setReviews(rv.reviews || []); setCycles(cy.cycles || []);
      setTunings(tu.tunings || []); setMaturity(ma.maturity || []);
      setTelemetry(te.telemetry || []); setOnboarding(ob.rehearsals || []);
      setStability(st.stability || []); setCerts(ce.manifests || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/maturation/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderReviews = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Attorney Pilot Reviews</h3>
      {reviews.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.workflowReviewed.replace(/_/g, ' ')}</span>
            <Badge text={r.reviewerRole.replace(/_/g, ' ')} color="#7c3aed" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Usability</span><div style={{ fontWeight: 700, color: r.usabilityScore >= 4.5 ? '#22c55e' : '#f59e0b' }}>{r.usabilityScore}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Accuracy</span><div style={{ fontWeight: 700, color: r.accuracyScore >= 4.5 ? '#22c55e' : '#f59e0b' }}>{r.accuracyScore}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Speed</span><div style={{ fontWeight: 700, color: r.speedScore >= 4.5 ? '#22c55e' : '#f59e0b' }}>{r.speedScore}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Overall</span><div style={{ fontWeight: 700, fontSize: 18, color: r.overallRating >= 4.5 ? '#22c55e' : '#3b82f6' }}>{r.overallRating.toFixed(1)}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderUiUx = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>UI/UX Optimization Cycles</h3>
      {cycles.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.cycleName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{c.optimizationArea.replace(/_/g, ' ')}</div>
            </div>
            <Badge text={c.cycleStatus} color={sc(c.cycleStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div><span style={{ color: '#ef4444', fontWeight: 700 }}>{c.beforeScore}</span><span style={{ color: '#64748b' }}> → </span><span style={{ color: '#22c55e', fontWeight: 700 }}>{c.afterScore}</span></div>
            <Badge text={`+${c.improvementPct.toFixed(1)}%`} color="#22c55e" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderInfra = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Infrastructure Tuning</h3>
      {tunings.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.tuningDomain.replace(/_/g, ' ')}</span>
            <Badge text={t.tuningStatus} color={sc(t.tuningStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div><span style={{ color: '#ef4444', fontWeight: 700 }}>{t.metricBefore}</span><span style={{ color: '#64748b' }}> → </span><span style={{ color: '#22c55e', fontWeight: 700 }}>{t.metricAfter}</span></div>
            <Badge text={`-${t.improvementPct.toFixed(1)}%`} color="#22c55e" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderDeployment = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deployment Maturity</h3>
      {maturity.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.maturityDomain.replace(/_/g, ' ')}</span>
            <Badge text={m.maturityLevel} color={sc(m.maturityLevel)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Checks</span><div style={{ fontWeight: 700 }}>{m.checksPassed}/{m.checksTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Score</span><div style={{ fontWeight: 700, color: m.maturityScore >= 90 ? '#22c55e' : '#f59e0b' }}>{m.maturityScore}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTelemetry = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Telemetry Refinement</h3>
      {telemetry.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.telemetryArea.replace(/_/g, ' ')}</span>
            <Badge text={t.refinementStatus} color={sc(t.refinementStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>S/N Ratio</span><div style={{ fontWeight: 700 }}>{t.signalToNoiseRatio}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Coverage</span><div style={{ fontWeight: 700, color: t.coveragePercentage >= 95 ? '#22c55e' : '#f59e0b' }}>{t.coveragePercentage}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderOnboarding = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Onboarding Rehearsals</h3>
      {onboarding.map(o => (
        <div key={o.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{o.onboardingPhase.replace(/_/g, ' ')}</span>
            <Badge text={o.rehearsalStatus} color={sc(o.rehearsalStatus)} />
          </div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Steps: </span><span style={{ fontWeight: 700 }}>{o.stepsCompleted}/{o.stepsTotal}</span></div>
          <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${(o.stepsCompleted / o.stepsTotal) * 100}%`, height: '100%', background: '#7c3aed', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderStability = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Long-Duration Stability</h3>
      {stability.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.testDurationHours}h run</span>
            <Badge text={s.stabilityStatus} color={sc(s.stabilityStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Requests</span><div style={{ fontWeight: 700 }}>{s.requestsProcessed.toLocaleString()}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Errors</span><div style={{ fontWeight: 700, color: s.errorsEncountered > 0 ? '#f59e0b' : '#22c55e' }}>{s.errorsEncountered}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Uptime</span><div style={{ fontWeight: 700, color: '#22c55e' }}>{s.uptimePercentage}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Maturity Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.verified)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.manifestArea.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.maturityLevel} color={sc(c.maturityLevel)} />
              <Badge text={c.verified ? 'VERIFIED' : 'PENDING'} color={sc(c.verified)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'reviews': return renderReviews();
      case 'uiux': return renderUiUx();
      case 'infrastructure': return renderInfra();
      case 'deployment': return renderDeployment();
      case 'telemetry': return renderTelemetry();
      case 'onboarding': return renderOnboarding();
      case 'stability': return renderStability();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Operational Maturation Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Controlled production readiness + operational maturation
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Maturing...' : 'Run Maturation Analysis'}
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

export default OperationalMaturationCockpit;
