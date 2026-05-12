// ============================================================================
// Phase K.2 — Expert Defensibility Cockpit
// 8-pane independent scrutiny dashboard.
// No manufactured authority — no fake endorsements.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface DefProps {
  caseId: string;
}

interface ReviewEntry { id: string; expertId: string; expertSpecialty: string; reviewScope: string; reviewStatus: string; reviewResult: string; findingsCount: number; }
interface SimEntry { id: string; challengeType: string; challengeTarget: string; simulationResult: string; strengthScore: number; vulnerabilitiesFound: number; }
interface ScoreEntry { id: string; scoringScope: string; defensibilityScore: number; defensibilityStatus: string; rulesPassed: number; rulesFailed: number; }
interface ReproEntry { id: string; hashesMatch: boolean; methodologyVerified: boolean; dataIntegrityVerified: boolean; }
interface TraceEntry { id: string; traceScope: string; reconstructionStatus: string; stepsReconstructed: number; stepsVerified: number; gapsFound: number; }
interface ChalEntry { id: string; challengeSource: string; challengeBasis: string; challengeOutcome: string; }
interface ManifestEntry { id: string; manifestScope: string; manifestComplete: boolean; entriesCount: number; entriesVerified: number; manifestHash: string; }
interface CertEntry { id: string; certificationScope: string; certificationStatus: string; certificationRate: number; reviewsCompleted: number; reviewsPassed: number; }

type PaneName = 'reviews' | 'simulations' | 'scoring' | 'reproducibility' | 'traces' | 'challenges' | 'manifests' | 'certifications';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'reviews', label: 'Expert Review Workflows' },
  { key: 'simulations', label: 'Adversarial Simulations' },
  { key: 'scoring', label: 'Defensibility Scoring' },
  { key: 'reproducibility', label: 'Reproducibility Review' },
  { key: 'traces', label: 'Audit Trace Reconstruction' },
  { key: 'challenges', label: 'Evidentiary Challenges' },
  { key: 'manifests', label: 'Validation Manifests' },
  { key: 'certifications', label: 'Review Certifications' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'validated' || s === 'withstood' || s === 'defensible' || s === 'certified' || s === 'complete' || s === 'overruled' || s === 'full_agreement' || s === true ? '#22c55e' :
  s === 'conditional' || s === 'concerns_raised' || s === 'vulnerable' || s === 'partial' || s === 'pending' || s === 'partial_agreement' ? '#f59e0b' :
  s === 'rejected' || s === 'failed' || s === 'indefensible' || s === 'not_certified' || s === 'sustained' || s === 'disagreement' || s === false ? '#ef4444' : '#64748b';

export const ExpertDefensibilityCockpit: React.FC<DefProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('reviews');
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [sims, setSims] = useState<SimEntry[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [repros, setRepros] = useState<ReproEntry[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [chals, setChals] = useState<ChalEntry[]>([]);
  const [manifests, setManifests] = useState<ManifestEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rv, sm, sc2, rp, tr, ch, mn, ct] = await Promise.all([
        fetch(`/api/defensibility/reviews/${caseId}`).then(r => r.json()).catch(() => ({ reviews: [] })),
        fetch(`/api/defensibility/simulations/${caseId}`).then(r => r.json()).catch(() => ({ simulations: [] })),
        fetch(`/api/defensibility/scoring/${caseId}`).then(r => r.json()).catch(() => ({ scores: [] })),
        fetch(`/api/defensibility/reproducibility/${caseId}`).then(r => r.json()).catch(() => ({ reviews: [] })),
        fetch(`/api/defensibility/traces/${caseId}`).then(r => r.json()).catch(() => ({ traces: [] })),
        fetch(`/api/defensibility/challenges/${caseId}`).then(r => r.json()).catch(() => ({ challenges: [] })),
        fetch(`/api/defensibility/manifests/${caseId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
        fetch(`/api/defensibility/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setReviews(rv.reviews || []); setSims(sm.simulations || []); setScores(sc2.scores || []);
      setRepros(rp.reviews || []); setTraces(tr.traces || []); setChals(ch.challenges || []);
      setManifests(mn.manifests || []); setCerts(ct.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/defensibility/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderReviews = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Expert Review Workflows</h3>
      {reviews.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.expertSpecialty.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.reviewScope.replace(/_/g, ' ')} color="#3b82f6" />
              <Badge text={r.reviewResult} color={sc(r.reviewResult)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Expert: {r.expertId} | Findings: {r.findingsCount}</div>
        </div>
      ))}
    </div>
  );

  const renderSimulations = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Adversarial Simulations</h3>
      {sims.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.simulationResult)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.challengeType} → {s.challengeTarget}</span>
            <Badge text={s.simulationResult} color={sc(s.simulationResult)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Strength</span><div style={{ fontWeight: 700, color: s.strengthScore >= 90 ? '#22c55e' : '#f59e0b' }}>{s.strengthScore}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Vulnerabilities</span><div style={{ fontWeight: 700, color: s.vulnerabilitiesFound > 0 ? '#ef4444' : '#22c55e' }}>{s.vulnerabilitiesFound}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderScoring = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Defensibility Scoring</h3>
      {scores.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.scoringScope.replace(/_/g, ' ')}</span>
            <Badge text={s.defensibilityStatus} color={sc(s.defensibilityStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Score</span><div style={{ fontSize: 18, fontWeight: 700, color: s.defensibilityScore >= 95 ? '#22c55e' : '#f59e0b' }}>{s.defensibilityScore}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rules Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{s.rulesPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: s.rulesFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{s.rulesFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReproducibility = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Reproducibility Review</h3>
      {repros.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Hash Match</span><div><Badge text={r.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.hashesMatch)} /></div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Methodology</span><div><Badge text={r.methodologyVerified ? 'VERIFIED' : 'UNVERIFIED'} color={sc(r.methodologyVerified)} /></div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Data Integrity</span><div><Badge text={r.dataIntegrityVerified ? 'VERIFIED' : 'UNVERIFIED'} color={sc(r.dataIntegrityVerified)} /></div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTraces = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Audit Trace Reconstruction</h3>
      {traces.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.traceScope.replace(/_/g, ' ')}</span>
            <Badge text={t.reconstructionStatus} color={sc(t.reconstructionStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Reconstructed</span><div style={{ fontWeight: 700 }}>{t.stepsReconstructed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Verified</span><div style={{ fontWeight: 700 }}>{t.stepsVerified}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Gaps</span><div style={{ fontWeight: 700, color: t.gapsFound > 0 ? '#ef4444' : '#22c55e' }}>{t.gapsFound}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderChallenges = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidentiary Challenges</h3>
      {chals.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.challengeBasis}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.challengeSource} color="#3b82f6" />
              <Badge text={c.challengeOutcome} color={sc(c.challengeOutcome)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderManifests = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Validation Manifests</h3>
      {manifests.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.manifestScope.replace(/_/g, ' ')}</span>
            <Badge text={m.manifestComplete ? 'COMPLETE' : 'INCOMPLETE'} color={sc(m.manifestComplete)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Entries</span><div style={{ fontWeight: 700 }}>{m.entriesVerified}/{m.entriesCount}</div></div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>{m.manifestHash.slice(0, 24)}...</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertifications = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Review Certifications</h3>
      {certs.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Reviews</span><div style={{ fontWeight: 700 }}>{c.reviewsPassed}/{c.reviewsCompleted}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.certificationRate >= 95 ? '#22c55e' : '#f59e0b' }}>{c.certificationRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'reviews': return renderReviews();
      case 'simulations': return renderSimulations();
      case 'scoring': return renderScoring();
      case 'reproducibility': return renderReproducibility();
      case 'traces': return renderTraces();
      case 'challenges': return renderChallenges();
      case 'manifests': return renderManifests();
      case 'certifications': return renderCertifications();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Expert Defensibility Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Independent scrutiny — reproducible expert review
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Defensibility Analysis'}
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

export default ExpertDefensibilityCockpit;
