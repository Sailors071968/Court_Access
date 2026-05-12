// ============================================================================
// Phase J.2 — Evidentiary Trust Cockpit
// 8-pane trust assurance dashboard.
// Deterministic verifiability — no unverifiable trust claims.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface TrustProps {
  caseId: string;
}

interface ProofEntry { id: string; proofType: string; proofResult: string; verificationMethod: string; inputHash: string; outputHash: string; }
interface AttestEntry { id: string; attestationTarget: string; attestationResult: string; contentHash: string; attestedBy: string; }
interface ReproEntry { id: string; layerName: string; hashesMatch: boolean; executionDuration: number; }
interface ChainEntry { id: string; chainLength: number; chainComplete: boolean; chainHash: string; }
interface AuditEntry { id: string; auditType: string; auditResult: string; findingsCount: number; criticalFindings: number; evidenceReviewed: number; }
interface CheckEntry { id: string; checkpointName: string; checkpointType: string; checkpointStatus: string; validationsPassed: number; validationsFailed: number; }
interface TrustCertEntry { id: string; certificationScope: string; certificationStatus: string; trustScore: number; rulesPassed: number; rulesFailed: number; }
interface DefEntry { id: string; defensibilityScope: string; certificationStatus: string; defensibilityRate: number; evidenceRecordsCount: number; verifiedRecordsCount: number; }

type PaneName = 'proofs' | 'attestations' | 'reproducibility' | 'chains' | 'audits' | 'checkpoints' | 'certifications' | 'defensibility';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'proofs', label: 'Verification Proofs' },
  { key: 'attestations', label: 'Integrity Attestations' },
  { key: 'reproducibility', label: 'Reproducibility Proofs' },
  { key: 'chains', label: 'Verification Manifests' },
  { key: 'audits', label: 'Audit Verification' },
  { key: 'checkpoints', label: 'Validation Checkpoints' },
  { key: 'certifications', label: 'Trust Certifications' },
  { key: 'defensibility', label: 'Defensibility Tracking' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'verified' || s === 'attested' || s === 'passed' || s === 'certified' || s === 'defensible' || s === true ? '#22c55e' :
  s === 'conditional' || s === 'pending' || s === 'inconclusive' ? '#f59e0b' :
  s === 'failed' || s === 'disputed' || s === 'not_defensible' || s === false ? '#ef4444' : '#64748b';

export const EvidentiaryTrustCockpit: React.FC<TrustProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('proofs');
  const [loading, setLoading] = useState(false);
  const [proofs, setProofs] = useState<ProofEntry[]>([]);
  const [attests, setAttests] = useState<AttestEntry[]>([]);
  const [repros, setRepros] = useState<ReproEntry[]>([]);
  const [chains, setChains] = useState<ChainEntry[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [checks, setChecks] = useState<CheckEntry[]>([]);
  const [certs, setCerts] = useState<TrustCertEntry[]>([]);
  const [defs, setDefs] = useState<DefEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, r, ch, au, ck, ct, d] = await Promise.all([
        fetch(`/api/trust/proofs/${caseId}`).then(r => r.json()).catch(() => ({ proofs: [] })),
        fetch(`/api/trust/attestations/${caseId}`).then(r => r.json()).catch(() => ({ attestations: [] })),
        fetch(`/api/trust/reproducibility/${caseId}`).then(r => r.json()).catch(() => ({ proofs: [] })),
        fetch(`/api/trust/chains/${caseId}`).then(r => r.json()).catch(() => ({ chains: [] })),
        fetch(`/api/trust/audits/${caseId}`).then(r => r.json()).catch(() => ({ audits: [] })),
        fetch(`/api/trust/checkpoints/${caseId}`).then(r => r.json()).catch(() => ({ checkpoints: [] })),
        fetch(`/api/trust/certifications/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
        fetch(`/api/trust/defensibility/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setProofs(p.proofs || []); setAttests(a.attestations || []); setRepros(r.proofs || []);
      setChains(ch.chains || []); setAudits(au.audits || []); setChecks(ck.checkpoints || []);
      setCerts(ct.certifications || []); setDefs(d.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/trust/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderProofs = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Verification Proofs</h3>
      {proofs.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.proofType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={p.verificationMethod.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={p.proofResult} color={sc(p.proofResult)} />
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
            IN: {p.inputHash.slice(0, 20)}... → OUT: {p.outputHash.slice(0, 20)}...
          </div>
        </div>
      ))}
    </div>
  );

  const renderAttestations = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Integrity Attestations</h3>
      {attests.map(a => (
        <div key={a.id} style={{ ...card, borderLeft: `4px solid ${sc(a.attestationResult)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{a.attestationTarget}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={a.attestedBy} color="#3b82f6" />
              <Badge text={a.attestationResult} color={sc(a.attestationResult)} />
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{a.contentHash.slice(0, 32)}...</div>
        </div>
      ))}
    </div>
  );

  const renderReproducibility = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Reproducibility Proofs</h3>
      {repros.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{r.layerName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.hashesMatch)} />
              <Badge text={`${r.executionDuration}ms`} color="#7c3aed" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderChains = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Verification Chain Manifests</h3>
      {chains.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Chain Length: {c.chainLength}</span>
            <Badge text={c.chainComplete ? 'COMPLETE' : 'INCOMPLETE'} color={sc(c.chainComplete)} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{c.chainHash.slice(0, 32)}...</div>
        </div>
      ))}
    </div>
  );

  const renderAudits = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Audit Verification</h3>
      {audits.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.auditType.replace(/_/g, ' ')}</span>
            <Badge text={a.auditResult} color={sc(a.auditResult)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Evidence Reviewed</span><div style={{ fontWeight: 700 }}>{a.evidenceReviewed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Findings</span><div style={{ fontWeight: 700 }}>{a.findingsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Critical</span><div style={{ color: a.criticalFindings > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{a.criticalFindings}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCheckpoints = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Validation Checkpoints</h3>
      {checks.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.checkpointName}</span>
            <Badge text={c.checkpointStatus} color={sc(c.checkpointStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{c.validationsPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: c.validationsFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{c.validationsFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertifications = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Trust Certifications</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Trust Score</span><div style={{ fontSize: 18, fontWeight: 700, color: c.trustScore >= 95 ? '#22c55e' : '#f59e0b' }}>{c.trustScore}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rules Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{c.rulesPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: c.rulesFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{c.rulesFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDefensibility = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Defensibility Tracking</h3>
      {defs.map(d => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.defensibilityScope}</span>
            <Badge text={d.certificationStatus} color={sc(d.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Evidence</span><div style={{ fontWeight: 700 }}>{d.evidenceRecordsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Verified</span><div style={{ fontWeight: 700 }}>{d.verifiedRecordsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: d.defensibilityRate >= 95 ? '#22c55e' : '#f59e0b' }}>{d.defensibilityRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'proofs': return renderProofs();
      case 'attestations': return renderAttestations();
      case 'reproducibility': return renderReproducibility();
      case 'chains': return renderChains();
      case 'audits': return renderAudits();
      case 'checkpoints': return renderCheckpoints();
      case 'certifications': return renderCertifications();
      case 'defensibility': return renderDefensibility();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Evidentiary Trust Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Formal verification — deterministic defensibility assurance
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Trust Analysis'}
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

export default EvidentiaryTrustCockpit;
