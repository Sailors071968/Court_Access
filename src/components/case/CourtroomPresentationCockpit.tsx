// ============================================================================
// Phase D.7 — Courtroom Presentation Cockpit
// 8-pane courtroom narrative intelligence layer.
// Analyzes litigation clarity and evidentiary coherence.
// NEVER manipulates juries. Deterministic analysis only.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface PresentationCockpitProps {
  caseId: string;
}

interface NarrativeCoherence {
  prosecutionClarity: number; defenseClarity: number; internalConsistency: number;
  chronologicalFlow: number; witnessAlignment: number; overallCoherence: number;
  weakPoints: Array<{ area: string; score: number; explanation: string }>;
  strengthPoints: Array<{ area: string; score: number; explanation: string }>;
}

interface ContradictionSalience {
  id: string; contradictionId: string; salienceScore: number; juryImpact: string;
  presentationPriority: number; presentationNotes: string;
}

interface BurdenClarity {
  id: string; instructionNumber: number; chargeTitle: string;
  overallBurdenClarity: number; weakestElement: string | null; strongestElement: string | null;
  defenseArgument: string;
}

interface WitnessImpact {
  id: string; witnessName: string; overallCredibility: number;
  priorInconsistencies: number; contradictionCount: number; impactIfImpeached: string;
}

interface TimelineComprehension {
  totalEvents: number; clarityScore: number; gapCount: number; conflictCount: number;
  juryPresentation: string;
}

interface EvidentiaryWeight {
  prosecutionWeight: number; defenseWeight: number; netBalance: number;
  vulnerabilities: Array<{ element: string; balance: number; note: string }>;
}

interface ConfusionZone {
  id: string; confusionType: string; description: string; severity: string;
  clarificationNeeded: string;
}

interface DoubtAmplifier {
  id: string; doubtSource: string; title: string; description: string;
  amplificationScore: number; presentationOrder: number;
}

type PaneName = 'narrative' | 'salience' | 'burden' | 'witness' | 'timeline' | 'weight' | 'doubt' | 'confusion';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'narrative', label: 'Narrative Clarity', icon: '📊' },
  { key: 'salience', label: 'Contradiction Salience', icon: '💥' },
  { key: 'burden', label: 'Burden Comprehension', icon: '⚖️' },
  { key: 'witness', label: 'Witness Impact', icon: '👤' },
  { key: 'timeline', label: 'Timeline Clarity', icon: '🕐' },
  { key: 'weight', label: 'Evidentiary Weight', icon: '📏' },
  { key: 'doubt', label: 'Reasonable Doubt', icon: '❓' },
  { key: 'confusion', label: 'Juror Confusion', icon: '🔍' },
];

const scoreColor = (score: number) => {
  if (score >= 0.7) return '#22c55e';
  if (score >= 0.4) return '#f59e0b';
  return '#ef4444';
};

const ScoreBar: React.FC<{ label: string; value: number; maxLabel?: string }> = ({ label, value, maxLabel }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>
      <span>{label}</span>
      <span style={{ color: scoreColor(value) }}>{(value * 100).toFixed(0)}%{maxLabel ? ` (${maxLabel})` : ''}</span>
    </div>
    <div style={{ background: '#334155', borderRadius: 4, height: 6, overflow: 'hidden' }}>
      <div style={{ background: scoreColor(value), width: `${value * 100}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  </div>
);

const SeverityBadge: React.FC<{ level: string }> = ({ level }) => {
  const color = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#6b7280';
  return <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{level}</span>;
};

export const CourtroomPresentationCockpit: React.FC<PresentationCockpitProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('narrative');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [narrative, setNarrative] = useState<NarrativeCoherence | null>(null);
  const [salience, setSalience] = useState<ContradictionSalience[]>([]);
  const [burden, setBurden] = useState<BurdenClarity[]>([]);
  const [witnesses, setWitnesses] = useState<WitnessImpact[]>([]);
  const [timeline, setTimeline] = useState<TimelineComprehension | null>(null);
  const [weight, setWeight] = useState<EvidentiaryWeight | null>(null);
  const [doubt, setDoubt] = useState<DoubtAmplifier[]>([]);
  const [confusion, setConfusion] = useState<ConfusionZone[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [narRes, salRes, burRes, witRes, timRes, weiRes, dbtRes, conRes] = await Promise.all([
        fetch(`/api/dynamics/narrative/${caseId}`).then(r => r.json()).catch(() => null),
        fetch(`/api/dynamics/salience/${caseId}`).then(r => r.json()).catch(() => ({ scores: [] })),
        fetch(`/api/dynamics/burden/${caseId}`).then(r => r.json()).catch(() => ({ analyses: [] })),
        fetch(`/api/dynamics/witness/${caseId}`).then(r => r.json()).catch(() => ({ witnesses: [] })),
        fetch(`/api/dynamics/timeline/${caseId}`).then(r => r.json()).catch(() => null),
        fetch(`/api/dynamics/weight/${caseId}`).then(r => r.json()).catch(() => null),
        fetch(`/api/dynamics/doubt/${caseId}`).then(r => r.json()).catch(() => ({ items: [] })),
        fetch(`/api/dynamics/confusion/${caseId}`).then(r => r.json()).catch(() => ({ zones: [] })),
      ]);
      if (narRes) setNarrative(narRes);
      setSalience(salRes.scores || []);
      setBurden(burRes.analyses || []);
      setWitnesses(witRes.witnesses || []);
      if (timRes) setTimeline(timRes);
      if (weiRes) setWeight(weiRes);
      setDoubt(dbtRes.items || []);
      setConfusion(conRes.zones || []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/dynamics/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderNarrativePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 16 }}>Prosecution Narrative Coherence</h3>
      {!narrative ? <p style={{ color: '#64748b' }}>No analysis data. Run analysis first.</p> : (
        <>
          <div style={cardStyle}>
            <ScoreBar label="Overall Coherence" value={narrative.overallCoherence} />
            <ScoreBar label="Prosecution Clarity" value={narrative.prosecutionClarity} />
            <ScoreBar label="Defense Position Clarity" value={narrative.defenseClarity} />
            <ScoreBar label="Internal Consistency" value={narrative.internalConsistency} />
            <ScoreBar label="Chronological Flow" value={narrative.chronologicalFlow} />
            <ScoreBar label="Witness Alignment" value={narrative.witnessAlignment} />
          </div>
          {narrative.weakPoints.length > 0 && (
            <div style={{ ...cardStyle, borderColor: '#ef4444' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 8px' }}>Weak Points (Defense Opportunity)</h4>
              {narrative.weakPoints.map((wp, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                  <strong style={{ color: '#e2e8f0' }}>{wp.area}</strong>: <span style={{ color: '#94a3b8' }}>{wp.explanation}</span>
                </div>
              ))}
            </div>
          )}
          {narrative.strengthPoints.length > 0 && (
            <div style={{ ...cardStyle, borderColor: '#22c55e' }}>
              <h4 style={{ color: '#22c55e', margin: '0 0 8px' }}>Prosecution Strengths</h4>
              {narrative.strengthPoints.map((sp, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                  <strong style={{ color: '#e2e8f0' }}>{sp.area}</strong>: <span style={{ color: '#94a3b8' }}>{sp.explanation}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSaliencePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Contradiction Salience (Jury Impact)</h3>
      {salience.length === 0 ? <p style={{ color: '#64748b' }}>No salience scores. Run analysis first.</p> : null}
      {salience.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Priority #{s.presentationPriority}</span>
            <SeverityBadge level={s.juryImpact} />
          </div>
          <ScoreBar label="Salience Score" value={s.salienceScore} />
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '8px 0 0' }}>{s.presentationNotes}</p>
        </div>
      ))}
    </div>
  );

  const renderBurdenPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Burden Comprehension (CALCRIM-Aware)</h3>
      {burden.length === 0 ? <p style={{ color: '#64748b' }}>No burden clarity data. Run analysis first.</p> : null}
      {burden.map(b => (
        <div key={b.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>CALCRIM {b.instructionNumber} — {b.chargeTitle}</span>
            <span style={{ color: scoreColor(b.overallBurdenClarity), fontWeight: 600 }}>{(b.overallBurdenClarity * 100).toFixed(0)}%</span>
          </div>
          <ScoreBar label="Burden Clarity" value={b.overallBurdenClarity} />
          {b.weakestElement && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0' }}>Weakest: {b.weakestElement}</p>}
          {b.strongestElement && <p style={{ color: '#22c55e', fontSize: 12, margin: '4px 0' }}>Strongest: {b.strongestElement}</p>}
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>{b.defenseArgument}</p>
        </div>
      ))}
    </div>
  );

  const renderWitnessPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Witness Credibility Impact</h3>
      {witnesses.length === 0 ? <p style={{ color: '#64748b' }}>No witness data. Run analysis first.</p> : null}
      {witnesses.map(w => (
        <div key={w.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{w.witnessName}</span>
            <span style={{ color: scoreColor(w.overallCredibility), fontWeight: 600 }}>{(w.overallCredibility * 100).toFixed(0)}% credible</span>
          </div>
          <ScoreBar label="Credibility" value={w.overallCredibility} />
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Inconsistencies: {w.priorInconsistencies} | Contradictions: {w.contradictionCount}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>{w.impactIfImpeached}</p>
        </div>
      ))}
    </div>
  );

  const renderTimelinePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Timeline Comprehension</h3>
      {!timeline ? <p style={{ color: '#64748b' }}>No timeline data. Run analysis first.</p> : (
        <div style={cardStyle}>
          <ScoreBar label="Clarity Score" value={timeline.clarityScore} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>{timeline.totalEvents}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Events</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{timeline.gapCount}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Gaps</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{timeline.conflictCount}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Conflicts</div>
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 16 }}>{timeline.juryPresentation}</p>
        </div>
      )}
    </div>
  );

  const renderWeightPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidentiary Weight Balance</h3>
      {!weight ? <p style={{ color: '#64748b' }}>No weight data. Run analysis first.</p> : (
        <>
          <div style={cardStyle}>
            <ScoreBar label="Prosecution Weight" value={weight.prosecutionWeight} />
            <ScoreBar label="Defense Weight" value={weight.defenseWeight} />
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: weight.netBalance > 0 ? '#ef4444' : '#22c55e' }}>
                Net: {weight.netBalance > 0 ? 'Prosecution' : 'Defense'} advantage ({Math.abs(weight.netBalance * 100).toFixed(0)}%)
              </div>
            </div>
          </div>
          {weight.vulnerabilities.length > 0 && (
            <div style={{ ...cardStyle, borderColor: '#22c55e' }}>
              <h4 style={{ color: '#22c55e', margin: '0 0 8px' }}>Prosecution Vulnerabilities</h4>
              {weight.vulnerabilities.map((v, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
                  <strong>{v.element}</strong>: {v.note}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderDoubtPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Reasonable Doubt Amplification</h3>
      {doubt.length === 0 ? <p style={{ color: '#64748b' }}>No doubt amplifiers. Run analysis first.</p> : null}
      {doubt.map(d => (
        <div key={d.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>#{d.presentationOrder}: {d.title}</span>
            <span style={{ color: scoreColor(d.amplificationScore), fontWeight: 600 }}>{(d.amplificationScore * 100).toFixed(0)}%</span>
          </div>
          <ScoreBar label="Doubt Amplification" value={d.amplificationScore} />
          <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 4 }}>Source: {d.doubtSource.replace(/_/g, ' ')}</div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{d.description}</p>
        </div>
      ))}
    </div>
  );

  const renderConfusionPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Juror Confusion Zones</h3>
      {confusion.length === 0 ? <p style={{ color: '#64748b' }}>No confusion zones detected.</p> : null}
      {confusion.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.confusionType.replace(/_/g, ' ')}</span>
            <SeverityBadge level={c.severity} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{c.description}</p>
          <p style={{ color: '#e2e8f0', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>{c.clarificationNeeded}</p>
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'narrative': return renderNarrativePane();
      case 'salience': return renderSaliencePane();
      case 'burden': return renderBurdenPane();
      case 'witness': return renderWitnessPane();
      case 'timeline': return renderTimelinePane();
      case 'weight': return renderWeightPane();
      case 'doubt': return renderDoubtPane();
      case 'confusion': return renderConfusionPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Courtroom Presentation Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Analyzes litigation clarity and evidentiary coherence — does not manipulate juries
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: '10px 20px', background: loading ? '#475569' : '#3b82f6',
            color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 14,
          }}
        >
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Trial Dynamics Analysis'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        {PANES.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePane(p.key)}
            style={{
              padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
              background: activePane === p.key ? '#3b82f6' : 'transparent',
              color: activePane === p.key ? '#fff' : '#94a3b8',
              fontWeight: activePane === p.key ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap',
              border: 'none', transition: 'all 0.15s',
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {renderActivePane()}
      </div>
    </div>
  );
};

export default CourtroomPresentationCockpit;
