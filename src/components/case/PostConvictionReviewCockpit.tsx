// ============================================================================
// Phase E.2 — Post-Conviction Review Cockpit
// 8-pane post-conviction intelligence layer.
// Organizes provable post-conviction issue structures. NEVER acts as habeas counsel.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface PostConvictionProps {
  caseId: string;
}

interface InnocenceIndicator {
  id: string; indicatorType: string; description: string; strength: string; schlupStandard: string;
}

interface NewEvidence {
  id: string; evidenceType: string; description: string; materialityAssessment: string;
  discoverySource: string; probableOutcomeChange: string; legalStandard: string;
}

interface BradyReassessment {
  id: string; reassessmentType: string; description: string; materialityAnalysis: string;
  favorabilityAnalysis: string; kylesBagleyStandard: string;
}

interface IACIssue {
  id: string; deficiencyType: string; description: string; stricklandDeficiency: string;
  meritAssessment: string; trialPhase: string;
}

interface ForensicReassessment {
  id: string; forensicType: string; currentScientificStatus: string; reliabilityScore: number;
  retestingRecommended: boolean; nasReport2009Relevant: boolean; pcatRelevant: boolean;
}

interface Recantation {
  id: string; witnessName: string; recantedTestimony: string; credibilityOfRecantation: string;
  materialityToConviction: string; recantationContext: string;
}

interface CumulativeError {
  id: string; totalErrors: number; cumulativePrejudice: number; prejudiceLevel: string;
  individuallyHarmless: number; collectivelyPrejudicial: boolean; hillAnalysis: string;
}

interface TimelineEvent {
  id: string; eventType: string; eventDate: string; description: string;
  legalSignificance: string; deadlineImplication: string | null;
}

type PaneName = 'innocence' | 'evidence' | 'brady' | 'iac' | 'forensic' | 'recantation' | 'cumulative' | 'timeline';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'innocence', label: 'Innocence Indicators', icon: '🔍' },
  { key: 'evidence', label: 'Newly Discovered Evidence', icon: '📄' },
  { key: 'brady', label: 'Brady/Giglio Reassessment', icon: '⚖️' },
  { key: 'iac', label: 'Ineffective Assistance', icon: '🛡️' },
  { key: 'forensic', label: 'Forensic Reliability', icon: '🔬' },
  { key: 'recantation', label: 'Recantations', icon: '🔄' },
  { key: 'cumulative', label: 'Cumulative Error', icon: '📊' },
  { key: 'timeline', label: 'Post-Conviction Timeline', icon: '📅' },
];

const strengthColor = (s: string) => s === 'strong' ? '#22c55e' : s === 'moderate' ? '#f59e0b' : '#ef4444';
const statusColor = (s: string) => s === 'validated' ? '#22c55e' : s === 'debunked' ? '#ef4444' : s === 'questioned' ? '#f59e0b' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const PostConvictionReviewCockpit: React.FC<PostConvictionProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('innocence');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [innocence, setInnocence] = useState<InnocenceIndicator[]>([]);
  const [evidence, setEvidence] = useState<NewEvidence[]>([]);
  const [brady, setBrady] = useState<BradyReassessment[]>([]);
  const [iac, setIac] = useState<IACIssue[]>([]);
  const [forensic, setForensic] = useState<ForensicReassessment[]>([]);
  const [recantation, setRecantation] = useState<Recantation[]>([]);
  const [cumulative, setCumulative] = useState<CumulativeError[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [innRes, evRes, brRes, iacRes, forRes, recRes, cumRes, tlRes] = await Promise.all([
        fetch(`/api/postconviction/innocence/${caseId}`).then(r => r.json()).catch(() => ({ indicators: [] })),
        fetch(`/api/postconviction/evidence/${caseId}`).then(r => r.json()).catch(() => ({ entries: [] })),
        fetch(`/api/postconviction/brady/${caseId}`).then(r => r.json()).catch(() => ({ reassessments: [] })),
        fetch(`/api/postconviction/iac/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/postconviction/forensic/${caseId}`).then(r => r.json()).catch(() => ({ reassessments: [] })),
        fetch(`/api/postconviction/recantation/${caseId}`).then(r => r.json()).catch(() => ({ recantations: [] })),
        fetch(`/api/postconviction/cumulative/${caseId}`).then(r => r.json()).catch(() => ({ analyses: [] })),
        fetch(`/api/postconviction/timeline/${caseId}`).then(r => r.json()).catch(() => ({ events: [] })),
      ]);
      setInnocence(innRes.indicators || []);
      setEvidence(evRes.entries || []);
      setBrady(brRes.reassessments || []);
      setIac(iacRes.issues || []);
      setForensic(forRes.reassessments || []);
      setRecantation(recRes.recantations || []);
      setCumulative(cumRes.analyses ? [cumRes.analyses] : cumRes.analysis ? [cumRes.analysis] : []);
      setTimeline(tlRes.events || []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/postconviction/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderInnocencePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Actual Innocence Indicators</h3>
      {innocence.length === 0 ? <p style={{ color: '#64748b' }}>No innocence indicators detected. Run analysis first.</p> : null}
      {innocence.map(i => (
        <div key={i.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.indicatorType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={i.strength} color={strengthColor(i.strength)} />
              <Badge text={i.schlupStandard} color={i.schlupStandard.includes('Meets') ? '#22c55e' : i.schlupStandard === 'Arguable' ? '#f59e0b' : '#ef4444'} />
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{i.description.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderEvidencePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Newly Discovered Evidence</h3>
      {evidence.length === 0 ? <p style={{ color: '#64748b' }}>No newly discovered evidence tracked.</p> : null}
      {evidence.map(e => (
        <div key={e.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.evidenceType.replace(/_/g, ' ')}</span>
            <Badge text={e.materialityAssessment.replace(/_/g, ' ')} color={e.materialityAssessment === 'highly_material' ? '#22c55e' : '#f59e0b'} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{e.description.slice(0, 200)}</p>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
            Source: {e.discoverySource.replace(/_/g, ' ')} | Outcome: {e.probableOutcomeChange} | Standard: {e.legalStandard}
          </div>
        </div>
      ))}
    </div>
  );

  const renderBradyPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Brady/Giglio Post-Conviction Reassessment</h3>
      {brady.length === 0 ? <p style={{ color: '#64748b' }}>No Brady/Giglio reassessments.</p> : null}
      {brady.map(b => (
        <div key={b.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{b.reassessmentType.replace(/_/g, ' ')}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{b.description.slice(0, 200)}</p>
          <p style={{ color: '#e2e8f0', fontSize: 12, marginTop: 8 }}>{b.materialityAnalysis}</p>
          <p style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{b.kylesBagleyStandard.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderIACPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Ineffective Assistance of Counsel</h3>
      {iac.length === 0 ? <p style={{ color: '#64748b' }}>No IAC issues detected.</p> : null}
      {iac.map(i => (
        <div key={i.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.deficiencyType.replace(/_/g, ' ')}</span>
            <Badge text={i.meritAssessment} color={strengthColor(i.meritAssessment)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{i.description.slice(0, 200)}</p>
          <div style={{ marginTop: 8, padding: 8, background: '#0f172a', borderRadius: 4 }}>
            <p style={{ color: '#e2e8f0', fontSize: 12, margin: '0 0 4px' }}><strong>Deficiency:</strong> {i.stricklandDeficiency.slice(0, 200)}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const renderForensicPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Forensic Reliability Reassessment</h3>
      {forensic.length === 0 ? <p style={{ color: '#64748b' }}>No forensic evidence to reassess.</p> : null}
      {forensic.map(f => (
        <div key={f.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{f.forensicType.replace(/_/g, ' ')}</span>
            <Badge text={f.currentScientificStatus} color={statusColor(f.currentScientificStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#64748b' }}>
            <span>Reliability: <strong style={{ color: f.reliabilityScore < 0.5 ? '#ef4444' : '#22c55e' }}>{(f.reliabilityScore * 100).toFixed(0)}%</strong></span>
            {f.nasReport2009Relevant && <span style={{ color: '#f59e0b' }}>NAS 2009</span>}
            {f.pcatRelevant && <span style={{ color: '#f59e0b' }}>PCAST 2016</span>}
            {f.retestingRecommended && <span style={{ color: '#ef4444', fontWeight: 600 }}>RETESTING RECOMMENDED</span>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderRecantationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Witness Recantations</h3>
      {recantation.length === 0 ? <p style={{ color: '#64748b' }}>No recantations detected.</p> : null}
      {recantation.map(r => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.witnessName}</span>
            <Badge text={r.credibilityOfRecantation} color={strengthColor(r.credibilityOfRecantation === 'high' ? 'strong' : r.credibilityOfRecantation === 'medium' ? 'moderate' : 'weak')} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{r.recantedTestimony.slice(0, 200)}</p>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
            Context: {r.recantationContext.replace(/_/g, ' ')} | Materiality: {r.materialityToConviction}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCumulativePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Cumulative Constitutional Error</h3>
      {cumulative.length === 0 ? <p style={{ color: '#64748b' }}>No cumulative error analysis. Run analysis first.</p> : null}
      {cumulative.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Cumulative Error Analysis</span>
            <Badge text={c.prejudiceLevel.replace(/_/g, ' ')} color={c.collectivelyPrejudicial ? '#ef4444' : '#f59e0b'} />
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13 }}>
            <div>Total Errors: <strong>{c.totalErrors}</strong></div>
            <div>Individually Harmless: <strong>{c.individuallyHarmless}</strong></div>
            <div>Cumulative Prejudice: <strong style={{ color: c.cumulativePrejudice > 0.5 ? '#ef4444' : '#f59e0b' }}>{(c.cumulativePrejudice * 100).toFixed(0)}%</strong></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, height: 20, borderRadius: 4, overflow: 'hidden', background: '#334155' }}>
            <div style={{ width: `${c.cumulativePrejudice * 100}%`, height: '100%', background: c.cumulativePrejudice > 0.5 ? '#ef4444' : '#f59e0b', transition: 'width 0.3s' }} />
          </div>
          <p style={{ color: '#e2e8f0', fontSize: 12, marginTop: 12 }}>{c.hillAnalysis}</p>
        </div>
      ))}
    </div>
  );

  const renderTimelinePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Post-Conviction Timeline</h3>
      {timeline.length === 0 ? <p style={{ color: '#64748b' }}>No timeline events. Run analysis first.</p> : null}
      {timeline.map(t => (
        <div key={t.id} style={{ ...cardStyle, borderLeft: '3px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.eventType.replace(/_/g, ' ')}</span>
            <span style={{ color: '#64748b', fontSize: 12 }}>{t.eventDate}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{t.description.slice(0, 200)}</p>
          <p style={{ color: '#7c3aed', fontSize: 12, marginTop: 8 }}>{t.legalSignificance}</p>
          {t.deadlineImplication && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{t.deadlineImplication}</p>}
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'innocence': return renderInnocencePane();
      case 'evidence': return renderEvidencePane();
      case 'brady': return renderBradyPane();
      case 'iac': return renderIACPane();
      case 'forensic': return renderForensicPane();
      case 'recantation': return renderRecantationPane();
      case 'cumulative': return renderCumulativePane();
      case 'timeline': return renderTimelinePane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Post-Conviction Review Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organizes provable post-conviction issue structures — does not act as habeas counsel
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
            color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 14,
          }}
        >
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Post-Conviction Intelligence Analysis'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        {PANES.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePane(p.key)}
            style={{
              padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
              background: activePane === p.key ? '#7c3aed' : 'transparent',
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

export default PostConvictionReviewCockpit;
