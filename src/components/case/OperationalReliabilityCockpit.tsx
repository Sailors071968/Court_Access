// ============================================================================
// Phase N.2 — Operational Reliability Cockpit
// 8-pane golden-case validation + operational reliability dashboard.
// Operational excellence over architectural expansion.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ReliabilityProps {
  caseId: string;
}

interface CorpusEntry { id: string; caseType: string; caseName: string; expectedContradictions: number; expectedBurdenFractures: number; expectedCalcrimMappings: number; }
interface ReplayEntry { id: string; corpusEntryId: string; replayIteration: number; allHashesMatch: boolean; driftDetected: boolean; }
interface RegressionEntry { id: string; regressionLayer: string; hashesMatch: boolean; regressionDetected: boolean; }
interface LoadEntry { id: string; testArea: string; concurrentOps: number; avgLatencyMs: number; p95LatencyMs: number; errorCount: number; testStatus: string; }
interface SurvivEntry { id: string; failureScenario: string; injectionType: string; systemRecovered: boolean; dataIntact: boolean; recoveryTimeMs: number; }
interface UiEntry { id: string; focusArea: string; currentScore: number; targetScore: number; improvementApplied: boolean; }
interface GateEntry { id: string; gateName: string; gateStatus: string; }
interface ScoreEntry { id: string; scoreDomain: string; score: number; maxScore: number; scoreStatus: string; }

type PaneName = 'corpus' | 'replay' | 'regression' | 'load' | 'survivability' | 'uiux' | 'gates' | 'scores';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'corpus', label: 'Golden Corpus' },
  { key: 'replay', label: 'Replay Validation' },
  { key: 'regression', label: 'Regression Testing' },
  { key: 'load', label: 'Load / Stability' },
  { key: 'survivability', label: 'Survivability' },
  { key: 'uiux', label: 'UI/UX Refinement' },
  { key: 'gates', label: 'Release Gates' },
  { key: 'scores', label: 'Reliability Scores' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'passed' || s === 'excellent' || s === 'hardened' || s === true ? '#22c55e' :
  s === 'good' || s === 'acceptable' || s === 'partial' || s === 'degraded' ? '#f59e0b' :
  s === 'failed' || s === 'critical' || s === 'needs_improvement' || s === false ? '#ef4444' : '#64748b';

export const OperationalReliabilityCockpit: React.FC<ReliabilityProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('corpus');
  const [loading, setLoading] = useState(false);
  const [corpus, setCorpus] = useState<CorpusEntry[]>([]);
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [regressions, setRegressions] = useState<RegressionEntry[]>([]);
  const [loads, setLoads] = useState<LoadEntry[]>([]);
  const [survivs, setSurvivs] = useState<SurvivEntry[]>([]);
  const [uiux, setUiux] = useState<UiEntry[]>([]);
  const [gates, setGates] = useState<GateEntry[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, rp, rg, ld, sv, ui, gt, sc] = await Promise.all([
        fetch(`/api/reliability/corpus/${caseId}`).then(r => r.json()).catch(() => ({ corpus: [] })),
        fetch(`/api/reliability/replay/${caseId}`).then(r => r.json()).catch(() => ({ replays: [] })),
        fetch(`/api/reliability/regression/${caseId}`).then(r => r.json()).catch(() => ({ regressions: [] })),
        fetch(`/api/reliability/load-stability/${caseId}`).then(r => r.json()).catch(() => ({ loadTests: [] })),
        fetch(`/api/reliability/survivability/${caseId}`).then(r => r.json()).catch(() => ({ survivability: [] })),
        fetch(`/api/reliability/uiux/${caseId}`).then(r => r.json()).catch(() => ({ refinements: [] })),
        fetch(`/api/reliability/gates/${caseId}`).then(r => r.json()).catch(() => ({ gates: [] })),
        fetch(`/api/reliability/scores/${caseId}`).then(r => r.json()).catch(() => ({ scores: [] })),
      ]);
      setCorpus(c.corpus || []); setReplays(rp.replays || []);
      setRegressions(rg.regressions || []); setLoads(ld.loadTests || []);
      setSurvivs(sv.survivability || []); setUiux(ui.refinements || []);
      setGates(gt.gates || []); setScores(sc.scores || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/reliability/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderCorpus = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Golden-Case Validation Corpus</h3>
      {corpus.map(c => (
        <div key={c.id} style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.caseName}</div>
          <Badge text={c.caseType.replace(/_/g, ' ')} color="#7c3aed" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Contradictions</span><div style={{ fontWeight: 700, color: '#f59e0b' }}>{c.expectedContradictions}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Burden Fractures</span><div style={{ fontWeight: 700, color: '#ef4444' }}>{c.expectedBurdenFractures}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>CALCRIM Maps</span><div style={{ fontWeight: 700, color: '#22c55e' }}>{c.expectedCalcrimMappings}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReplay = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deterministic Replay Validation</h3>
      {replays.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(!r.driftDetected)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Iteration #{r.replayIteration}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.allHashesMatch ? 'ALL MATCH' : 'MISMATCH'} color={sc(r.allHashesMatch)} />
              <Badge text={r.driftDetected ? 'DRIFT' : 'STABLE'} color={sc(!r.driftDetected)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRegression = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Cross-Layer Regression Testing</h3>
      {regressions.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(!r.regressionDetected)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{r.regressionLayer.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(r.hashesMatch)} />
              <Badge text={r.regressionDetected ? 'REGRESSION' : 'STABLE'} color={sc(!r.regressionDetected)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLoad = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Load + Stability Testing</h3>
      {loads.map(l => (
        <div key={l.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{l.testArea.replace(/_/g, ' ')}</span>
            <Badge text={l.testStatus} color={sc(l.testStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Ops</span><div style={{ fontWeight: 700 }}>{l.concurrentOps}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Avg (ms)</span><div style={{ fontWeight: 700 }}>{l.avgLatencyMs}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>P95 (ms)</span><div style={{ fontWeight: 700 }}>{l.p95LatencyMs}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Errors</span><div style={{ fontWeight: 700, color: l.errorCount > 0 ? '#ef4444' : '#22c55e' }}>{l.errorCount}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSurvivability = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Survivability Testing</h3>
      {survivs.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.failureScenario.replace(/_/g, ' ')}</span>
            <Badge text={s.injectionType.replace(/_/g, ' ')} color="#7c3aed" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Recovered</span><div style={{ fontWeight: 700, color: sc(s.systemRecovered) }}>{s.systemRecovered ? 'YES' : 'NO'}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Data Intact</span><div style={{ fontWeight: 700, color: sc(s.dataIntact) }}>{s.dataIntact ? 'YES' : 'NO'}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Recovery</span><div style={{ fontWeight: 700 }}>{s.recoveryTimeMs}ms</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderUiUx = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>UI/UX Refinement Tracking</h3>
      {uiux.map(u => (
        <div key={u.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{u.focusArea.replace(/_/g, ' ')}</span>
            <Badge text={u.improvementApplied ? 'APPLIED' : 'PENDING'} color={sc(u.improvementApplied)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Current</span><div style={{ fontWeight: 700, color: u.currentScore >= u.targetScore ? '#22c55e' : '#f59e0b' }}>{u.currentScore}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Target</span><div style={{ fontWeight: 700 }}>{u.targetScore}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Gap</span><div style={{ fontWeight: 700, color: '#94a3b8' }}>{u.targetScore - u.currentScore}</div></div>
          </div>
          <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${(u.currentScore / u.targetScore) * 100}%`, height: '100%', background: u.currentScore >= u.targetScore ? '#22c55e' : '#7c3aed', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderGates = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Release Gate Certification</h3>
      {gates.map(g => (
        <div key={g.id} style={{ ...card, borderLeft: `4px solid ${sc(g.gateStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{g.gateName.replace(/_/g, ' ')}</span>
            <Badge text={g.gateStatus} color={sc(g.gateStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderScores = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Reliability Scores</h3>
      {scores.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.scoreDomain.replace(/_/g, ' ')}</span>
            <Badge text={s.scoreStatus} color={sc(s.scoreStatus)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 24, color: sc(s.scoreStatus) }}>{s.score}</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>/ {s.maxScore}</div>
          </div>
          <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${(s.score / s.maxScore) * 100}%`, height: '100%', background: sc(s.scoreStatus), borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'corpus': return renderCorpus();
      case 'replay': return renderReplay();
      case 'regression': return renderRegression();
      case 'load': return renderLoad();
      case 'survivability': return renderSurvivability();
      case 'uiux': return renderUiUx();
      case 'gates': return renderGates();
      case 'scores': return renderScores();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Operational Reliability Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Golden-case validation + operational reliability — operational excellence over expansion
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Validating...' : 'Run Reliability Analysis'}
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

export default OperationalReliabilityCockpit;
