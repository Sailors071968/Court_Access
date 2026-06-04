// ============================================================================
// Phase E.1 — Appellate Review Cockpit
// 8-pane appellate intelligence layer.
// Organizes provable appellate issue structures. NEVER functions as appellate counsel.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface AppellateReviewProps {
  caseId: string;
}

interface PreservedObjection {
  id: string; objectionType: string; ruling: string; trialPhase: string;
  witnessOnStand: string | null; preservedForAppeal: boolean; evidenceCodeSection: string | null;
}

interface WaivedIssue {
  id: string; issueType: string; issueDescription: string; detectionMethod: string;
  potentialAppellateIssue: string; exceptionApplicable: string | null;
}

interface InstructionalErrorEntry {
  id: string; instructionNumber: number | null; errorType: string;
  errorDescription: string; prejudiceLevel: string; preservedByObjection: boolean;
}

interface MisconductEntry {
  id: string; misconductType: string; description: string; trialPhase: string;
  prejudiceLevel: string; preservedForAppeal: boolean; objectionMade: boolean;
}

interface ConstitutionalPreservation {
  id: string; amendment: string; claimType: string; preservationStatus: string;
  appellateStrength: string; standardOfReview: string;
}

interface RecordEntry {
  id: string; recordType: string; description: string; status: string;
  importance: string; settlementNeeded: boolean;
}

interface HarmlessPrejudicial {
  id: string; errorDescription: string; prejudiceLevel: string;
  chapmanAnalysis: string; strengthOfRemaining: number; errorClassification: string;
}

interface AppellateIssue {
  id: string; issueTitle: string; issueCategory: string; preservationStatus: string;
  meritStrength: string; appellateRanking: number; prejudiceAnalysis: string;
}

type PaneName = 'preserved' | 'waived' | 'instructional' | 'misconduct' | 'constitutional' | 'completeness' | 'prejudicial' | 'ranking';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'preserved', label: 'Preserved Objections', icon: '🛡️' },
  { key: 'waived', label: 'Waived Issues', icon: '⚠️' },
  { key: 'instructional', label: 'Instructional Error', icon: '📋' },
  { key: 'misconduct', label: 'Prosecutorial Misconduct', icon: '⚖️' },
  { key: 'constitutional', label: 'Constitutional', icon: '🏛️' },
  { key: 'completeness', label: 'Record Completeness', icon: '📂' },
  { key: 'prejudicial', label: 'Prejudicial Impact', icon: '💥' },
  { key: 'ranking', label: 'Issue Ranking', icon: '📊' },
];

const strengthColor = (s: string) => s === 'strong' ? '#22c55e' : s === 'moderate' ? '#f59e0b' : '#ef4444';
const statusColor = (s: string) => s === 'preserved' ? '#22c55e' : s === 'forfeited' ? '#ef4444' : '#f59e0b';
const prejudiceColor = (p: string) => p === 'structural' ? '#dc2626' : p === 'prejudicial' ? '#f59e0b' : '#6b7280';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const AppellateReviewCockpit: React.FC<AppellateReviewProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('preserved');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [preserved, setPreserved] = useState<PreservedObjection[]>([]);
  const [waived, setWaived] = useState<WaivedIssue[]>([]);
  const [instructional, setInstructional] = useState<InstructionalErrorEntry[]>([]);
  const [misconduct, setMisconduct] = useState<MisconductEntry[]>([]);
  const [constitutional, setConstitutional] = useState<ConstitutionalPreservation[]>([]);
  const [completeness, setCompleteness] = useState<RecordEntry[]>([]);
  const [prejudicial, setPrejudicial] = useState<HarmlessPrejudicial[]>([]);
  const [ranking, setRanking] = useState<AppellateIssue[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [preRes, waiRes, insRes, misRes, conRes, comRes, preERes, ranRes] = await Promise.all([
        fetch(`/api/appellate/objections/${caseId}`).then(r => r.json()).catch(() => ({ entries: [] })),
        fetch(`/api/appellate/waiver/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/appellate/instructional/${caseId}`).then(r => r.json()).catch(() => ({ errors: [] })),
        fetch(`/api/appellate/misconduct/${caseId}`).then(r => r.json()).catch(() => ({ entries: [] })),
        fetch(`/api/appellate/constitutional/${caseId}`).then(r => r.json()).catch(() => ({ claims: [] })),
        fetch(`/api/appellate/completeness/${caseId}`).then(r => r.json()).catch(() => ({ entries: [] })),
        fetch(`/api/appellate/harmless/${caseId}`).then(r => r.json()).catch(() => ({ analyses: [] })),
        fetch(`/api/appellate/index/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
      ]);
      setPreserved(preRes.entries || []);
      setWaived(waiRes.issues || []);
      setInstructional(insRes.errors || []);
      setMisconduct(misRes.entries || []);
      setConstitutional(conRes.claims || []);
      setCompleteness(comRes.entries || []);
      setPrejudicial(preERes.analyses || []);
      setRanking(ranRes.issues || []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/appellate/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderPreservedPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Preserved Objections</h3>
      {preserved.length === 0 ? <p style={{ color: '#64748b' }}>No objection history. Run analysis first.</p> : null}
      {preserved.filter(p => p.preservedForAppeal).map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.objectionType.replace(/_/g, ' ')}</span>
            <Badge text={p.ruling} color={p.ruling === 'sustained' ? '#22c55e' : '#ef4444'} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {p.evidenceCodeSection && <span style={{ marginRight: 12 }}>{p.evidenceCodeSection}</span>}
            Phase: {p.trialPhase.replace(/_/g, ' ')}
            {p.witnessOnStand && <span style={{ marginLeft: 12 }}>Witness: {p.witnessOnStand}</span>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderWaivedPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Waived / Forfeited Issues</h3>
      {waived.length === 0 ? <p style={{ color: '#64748b' }}>No waiver/forfeiture issues detected.</p> : null}
      {waived.map(w => (
        <div key={w.id} style={{ ...cardStyle, borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{w.issueType.toUpperCase()}: {w.detectionMethod.replace(/_/g, ' ')}</span>
            {w.exceptionApplicable && <Badge text={w.exceptionApplicable.replace(/_/g, ' ')} color="#7c3aed" />}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0' }}>{w.issueDescription}</p>
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>Lost: {w.potentialAppellateIssue}</p>
        </div>
      ))}
    </div>
  );

  const renderInstructionalPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Instructional Errors (CALCRIM-Aware)</h3>
      {instructional.length === 0 ? <p style={{ color: '#64748b' }}>No instructional errors detected.</p> : null}
      {instructional.map(ie => (
        <div key={ie.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>
              {ie.instructionNumber ? `CALCRIM ${ie.instructionNumber}: ` : ''}{ie.errorType.replace(/_/g, ' ')}
            </span>
            <Badge text={ie.prejudiceLevel} color={prejudiceColor(ie.prejudiceLevel)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{ie.errorDescription.slice(0, 200)}</p>
          <div style={{ fontSize: 11, color: ie.preservedByObjection ? '#22c55e' : '#ef4444', marginTop: 8 }}>
            {ie.preservedByObjection ? 'Preserved by objection' : 'NOT preserved by objection'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderMisconductPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Prosecutorial Misconduct</h3>
      {misconduct.length === 0 ? <p style={{ color: '#64748b' }}>No prosecutorial misconduct detected.</p> : null}
      {misconduct.map(m => (
        <div key={m.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.misconductType.replace(/_/g, ' ')}</span>
            <Badge text={m.prejudiceLevel} color={prejudiceColor(m.prejudiceLevel)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{m.description.slice(0, 200)}</p>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
            Phase: {m.trialPhase.replace(/_/g, ' ')} |
            Objection: {m.objectionMade ? 'Yes' : 'No'} |
            Preserved: {m.preservedForAppeal ? 'Yes' : 'No'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderConstitutionalPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Constitutional Claim Preservation</h3>
      {constitutional.length === 0 ? <p style={{ color: '#64748b' }}>No constitutional claims tracked.</p> : null}
      {constitutional.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.amendment} Amendment: {c.claimType.replace(/_/g, ' ')}</span>
            <Badge text={c.preservationStatus} color={statusColor(c.preservationStatus)} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Strength: <span style={{ color: strengthColor(c.appellateStrength) }}>{c.appellateStrength}</span> |
            Review: {c.standardOfReview.replace(/_/g, ' ')}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompletenessPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Record Completeness</h3>
      {completeness.length === 0 ? <p style={{ color: '#64748b' }}>No record analysis. Run analysis first.</p> : null}
      {completeness.map(r => (
        <div key={r.id} style={{ ...cardStyle, borderColor: r.status === 'missing' ? '#ef4444' : r.status === 'incomplete' ? '#f59e0b' : '#334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.recordType.replace(/_/g, ' ')}</span>
            <Badge text={r.status} color={r.status === 'present' ? '#22c55e' : r.status === 'missing' ? '#ef4444' : '#f59e0b'} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{r.description}</p>
          {r.settlementNeeded && <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>Settled statement may be needed</p>}
        </div>
      ))}
    </div>
  );

  const renderPrejudicialPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Harmless / Prejudicial Error Analysis</h3>
      {prejudicial.length === 0 ? <p style={{ color: '#64748b' }}>No error analyses. Run analysis first.</p> : null}
      {prejudicial.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.errorClassification}</span>
            <Badge text={p.prejudiceLevel} color={prejudiceColor(p.prejudiceLevel)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{p.errorDescription.slice(0, 200)}</p>
          <p style={{ color: '#e2e8f0', fontSize: 12, marginTop: 8 }}>{p.chapmanAnalysis}</p>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Remaining evidence strength: {(p.strengthOfRemaining * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );

  const renderRankingPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Appellate Issue Ranking</h3>
      {ranking.length === 0 ? <p style={{ color: '#64748b' }}>No appellate issues indexed. Run analysis first.</p> : null}
      {ranking.sort((a, b) => a.appellateRanking - b.appellateRanking).map(r => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>#{r.appellateRanking}: {r.issueTitle}</span>
            <Badge text={r.meritStrength} color={strengthColor(r.meritStrength)} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Category: {r.issueCategory.replace(/_/g, ' ')} |
            Preservation: <span style={{ color: statusColor(r.preservationStatus) }}>{r.preservationStatus}</span> |
            Prejudice: <span style={{ color: prejudiceColor(r.prejudiceAnalysis) }}>{r.prejudiceAnalysis}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'preserved': return renderPreservedPane();
      case 'waived': return renderWaivedPane();
      case 'instructional': return renderInstructionalPane();
      case 'misconduct': return renderMisconductPane();
      case 'constitutional': return renderConstitutionalPane();
      case 'completeness': return renderCompletenessPane();
      case 'prejudicial': return renderPrejudicialPane();
      case 'ranking': return renderRankingPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Appellate Review Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organizes provable appellate issue structures — does not function as appellate counsel
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
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Appellate Intelligence Analysis'}
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

export default AppellateReviewCockpit;
