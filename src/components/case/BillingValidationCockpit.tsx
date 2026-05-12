// ============================================================================
// Phase O.2 — Billing Validation Cockpit
// 8-pane Stripe activation + controlled billing validation dashboard.
// No live Stripe without full rehearsal.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ValidationProps {
  customerId: string;
}

interface ActivationEntry { id: string; activationStep: string; stepOrder: number; stepStatus: string; }
interface KeyEntry { id: string; keyType: string; rotationReason: string; rotationStatus: string; }
interface HardeningEntry { id: string; hardeningCheck: string; checkStatus: string; hardeningScore: number; }
interface RehearsalEntry { id: string; rehearsalWorkflow: string; rehearsalOrder: number; rehearsalStatus: string; outputMatch: boolean; }
interface InstitutionalEntry { id: string; institutionName: string; onboardingPhase: string; phaseStatus: string; }
interface SurvivabilityEntry { id: string; testScenario: string; recoveryTimeMs: number; survivabilityStatus: string; }
interface TransitionEntry { id: string; fromState: string; toState: string; transitionTrigger: string; transitionValid: boolean; replayVerified: boolean; }
interface CertEntry { id: string; certificationArea: string; certified: boolean; gatesTotal: number; gatesPassed: number; certificationRate: number; }

type PaneName = 'activation' | 'keys' | 'hardening' | 'rehearsals' | 'institutional' | 'survivability' | 'transitions' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'activation', label: 'Activation' },
  { key: 'keys', label: 'Key Rotation' },
  { key: 'hardening', label: 'Hardening' },
  { key: 'rehearsals', label: 'Rehearsals' },
  { key: 'institutional', label: 'Institutional' },
  { key: 'survivability', label: 'Survivability' },
  { key: 'transitions', label: 'Transitions' },
  { key: 'certification', label: 'Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'completed' || s === 'passed' || s === 'verified' || s === 'blocked' || s === true ? '#22c55e' :
  s === 'pending' || s === 'in_progress' || s === 'warning' ? '#3b82f6' :
  s === 'failed' || s === 'leaked' || s === false ? '#ef4444' : '#64748b';

export const BillingValidationCockpit: React.FC<ValidationProps> = ({ customerId }) => {
  const [activePane, setActivePane] = useState<PaneName>('rehearsals');
  const [loading, setLoading] = useState(false);
  const [activation, setActivation] = useState<ActivationEntry[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [hardening, setHardening] = useState<HardeningEntry[]>([]);
  const [rehearsals, setRehearsals] = useState<RehearsalEntry[]>([]);
  const [institutional, setInstitutional] = useState<InstitutionalEntry[]>([]);
  const [survivability, setSurvivability] = useState<SurvivabilityEntry[]>([]);
  const [transitions, setTransitions] = useState<TransitionEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ac, ky, hd, rh, inst, sv, tr, ce] = await Promise.all([
        fetch(`/api/activation/workflow/${customerId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/activation/keys/${customerId}`).then(r => r.json()).catch(() => ({ rotations: [] })),
        fetch(`/api/activation/hardening/${customerId}`).then(r => r.json()).catch(() => ({ checks: [] })),
        fetch(`/api/activation/rehearsals/${customerId}`).then(r => r.json()).catch(() => ({ rehearsals: [] })),
        fetch(`/api/activation/institutional/${customerId}`).then(r => r.json()).catch(() => ({ phases: [] })),
        fetch(`/api/activation/survivability/${customerId}`).then(r => r.json()).catch(() => ({ tests: [] })),
        fetch(`/api/activation/transitions/${customerId}`).then(r => r.json()).catch(() => ({ transitions: [] })),
        fetch(`/api/activation/certification/${customerId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setActivation(ac.workflows || []); setKeys(ky.rotations || []);
      setHardening(hd.checks || []); setRehearsals(rh.rehearsals || []);
      setInstitutional(inst.phases || []); setSurvivability(sv.tests || []);
      setTransitions(tr.transitions || []); setCerts(ce.certifications || []);
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/activation/analyze/${customerId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };
  const bar = (pct: number, color: string): React.CSSProperties => ({
    height: 6, borderRadius: 3, background: '#334155', marginTop: 8, position: 'relative' as const, overflow: 'hidden',
  });

  const renderActivation = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Stripe Activation Workflow</h3>
      {activation.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{a.activationStep.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>Step {a.stepOrder}</span>
            </div>
            <Badge text={a.stepStatus} color={sc(a.stepStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderKeys = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Key Rotation</h3>
      {keys.map(k => (
        <div key={k.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{k.keyType.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{k.rotationReason.replace(/_/g, ' ')}</span>
            </div>
            <Badge text={k.rotationStatus} color={sc(k.rotationStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderHardening = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Webhook Endpoint Hardening</h3>
      {hardening.map(h => (
        <div key={h.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{h.hardeningCheck.replace(/_/g, ' ')}</span>
            <Badge text={h.checkStatus} color={sc(h.checkStatus)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...bar(h.hardeningScore, '#7c3aed'), flex: 1 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${h.hardeningScore}%`, background: '#7c3aed', borderRadius: 3 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{h.hardeningScore}%</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRehearsals = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Live Billing Rehearsals (15 Mandatory)</h3>
      {rehearsals.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(r.rehearsalStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{r.rehearsalWorkflow.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>#{r.rehearsalOrder}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={r.outputMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.outputMatch)} />
              <Badge text={r.rehearsalStatus} color={sc(r.rehearsalStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderInstitutional = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Institutional Subscription Onboarding</h3>
      {institutional.map(i => (
        <div key={i.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{i.onboardingPhase.replace(/_/g, ' ')}</span>
              <div style={{ fontSize: 12, color: '#64748b' }}>{i.institutionName}</div>
            </div>
            <Badge text={i.phaseStatus} color={sc(i.phaseStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderSurvivability = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Financial Survivability</h3>
      {survivability.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.testScenario.replace(/_/g, ' ')}</span>
            <Badge text={s.survivabilityStatus} color={sc(s.survivabilityStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Recovery: {(s.recoveryTimeMs / 1000).toFixed(1)}s</div>
        </div>
      ))}
    </div>
  );

  const renderTransitions = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Billing State Transitions</h3>
      {transitions.map(t => (
        <div key={t.id} style={{ ...card, borderLeft: `4px solid ${sc(t.transitionValid)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{t.fromState} → {t.toState}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge text={t.replayVerified ? 'REPLAY OK' : 'NO REPLAY'} color={sc(t.replayVerified)} />
              <Badge text={t.transitionValid ? 'VALID' : 'INVALID'} color={sc(t.transitionValid)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Trigger: {t.transitionTrigger.replace(/_/g, ' ')}</div>
        </div>
      ))}
    </div>
  );

  const renderCerts = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Production Billing Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.certified)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationArea.replace(/_/g, ' ')}</span>
            <Badge text={c.certified ? 'CERTIFIED' : 'PENDING'} color={sc(c.certified)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Gates: {c.gatesPassed}/{c.gatesTotal}</span>
            <span style={{ fontWeight: 700, color: c.certificationRate >= 95 ? '#22c55e' : '#f59e0b' }}>{c.certificationRate.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'activation': return renderActivation();
      case 'keys': return renderKeys();
      case 'hardening': return renderHardening();
      case 'rehearsals': return renderRehearsals();
      case 'institutional': return renderInstitutional();
      case 'survivability': return renderSurvivability();
      case 'transitions': return renderTransitions();
      case 'certification': return renderCerts();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Billing Validation Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Stripe production activation + controlled billing validation
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Running...' : 'Run Full Rehearsal'}
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

export default BillingValidationCockpit;
