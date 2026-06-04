// ============================================================================
// Phase G.1 — Constitutional Litigation Intelligence Cockpit
// 8-pane constitutional rights analysis layer.
// Organizes provable constitutional issue structures.
// NEVER functions as constitutional litigation counsel.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ConstitutionalProps {
  caseId: string;
}

interface FourthAmendment {
  id: string; issueType: string; description: string;
  legalStandard: string; suppressionViability: string;
  warrantPresent: boolean; fruitOfPoisonousTree: boolean;
}

interface FifthAmendment {
  id: string; issueType: string; description: string;
  mirandaAdvisement: string | null; suppressionViability: string; legalBasis: string;
}

interface SixthAmendment {
  id: string; witnessName: string; confrontationType: string;
  testimonialStatus: string; crawfordApplicable: boolean; brutonIssue: boolean;
  confrontationViability: string;
}

interface DueProcess {
  id: string; issueType: string; description: string;
  amendment: string; prejudiceLevel: string; remedyAvailable: string;
}

interface SuppressionIssue {
  id: string; evidenceDescription: string; evidenceType: string;
  constitutionalBasis: string; suppressionGround: string;
  impactIfSuppressed: string; motionFiled: boolean;
}

interface StructuralError {
  id: string; errorType: string; description: string;
  autoReversible: boolean; constitutionalBasis: string; caseAuthority: string;
}

interface SearchSeizureEvent {
  id: string; eventType: string; sequenceNumber: number;
  officerIdentifier: string | null; constitutionalIssue: boolean;
}

interface PreservationGraph {
  id: string; amendment: string; issueType: string;
  chainLength: number; currentStatus: string; riskOfForfeiture: boolean;
}

type PaneName = 'search' | 'interrogation' | 'confrontation' | 'dueprocess' | 'suppression' | 'structural' | 'preservation' | 'timeline';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'search', label: 'Search & Seizure', icon: '🔍' },
  { key: 'interrogation', label: 'Custodial Interrogation', icon: '🗣️' },
  { key: 'confrontation', label: 'Confrontation Clause', icon: '⚖️' },
  { key: 'dueprocess', label: 'Due Process', icon: '📜' },
  { key: 'suppression', label: 'Suppression Structures', icon: '🚫' },
  { key: 'structural', label: 'Structural Error', icon: '🏛️' },
  { key: 'preservation', label: 'Preservation Status', icon: '🔒' },
  { key: 'timeline', label: 'Constitutional Timelines', icon: '📅' },
];

const viabilityColor = (v: string) => v === 'strong' ? '#22c55e' : v === 'moderate' ? '#f59e0b' : v === 'weak' ? '#ef4444' : '#64748b';
const preservationColor = (s: string) => s === 'preserved' ? '#22c55e' : s === 'partially_preserved' ? '#f59e0b' : s === 'forfeited' ? '#ef4444' : '#64748b';
const impactColor = (i: string) => i === 'case_dispositive' ? '#ef4444' : i === 'significant' ? '#f59e0b' : i === 'moderate' ? '#3b82f6' : '#64748b';
const prejudiceColor = (p: string) => p === 'severe' ? '#ef4444' : p === 'significant' ? '#f59e0b' : p === 'moderate' ? '#3b82f6' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const ConstitutionalLitigationCockpit: React.FC<ConstitutionalProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('search');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [fourthAmendment, setFourthAmendment] = useState<FourthAmendment[]>([]);
  const [fifthAmendment, setFifthAmendment] = useState<FifthAmendment[]>([]);
  const [sixthAmendment, setSixthAmendment] = useState<SixthAmendment[]>([]);
  const [dueProcess, setDueProcess] = useState<DueProcess[]>([]);
  const [suppression, setSuppression] = useState<SuppressionIssue[]>([]);
  const [structural, setStructural] = useState<StructuralError[]>([]);
  const [searchSeizure, setSearchSeizure] = useState<SearchSeizureEvent[]>([]);
  const [preservation, setPreservation] = useState<PreservationGraph[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [f4, f5, f6, dp, su, st, ss, pg] = await Promise.all([
        fetch(`/api/constitutional/fourth/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/constitutional/fifth/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/constitutional/sixth/${caseId}`).then(r => r.json()).catch(() => ({ confrontations: [] })),
        fetch(`/api/constitutional/dueprocess/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/constitutional/suppression/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/constitutional/structural/${caseId}`).then(r => r.json()).catch(() => ({ errors: [] })),
        fetch(`/api/constitutional/search-seizure/${caseId}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`/api/constitutional/preservation/${caseId}`).then(r => r.json()).catch(() => ({ graphs: [] })),
      ]);
      setFourthAmendment(f4.issues || []);
      setFifthAmendment(f5.issues || []);
      setSixthAmendment(f6.confrontations || []);
      setDueProcess(dp.issues || []);
      setSuppression(su.issues || []);
      setStructural(st.errors || []);
      setSearchSeizure(ss.events || []);
      setPreservation(pg.graphs || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/constitutional/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderSearchPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Fourth Amendment — Search & Seizure Issues</h3>
      {fourthAmendment.length === 0 ? <p style={{ color: '#64748b' }}>No Fourth Amendment issues detected.</p> : null}
      {fourthAmendment.map(f => (
        <div key={f.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{f.issueType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={f.suppressionViability} color={viabilityColor(f.suppressionViability)} />
              {f.fruitOfPoisonousTree && <Badge text="FRUIT" color="#ef4444" />}
              {!f.warrantPresent && <Badge text="NO WARRANT" color="#f59e0b" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{f.description.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>Standard: {f.legalStandard.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderInterrogationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Fifth Amendment — Custodial Interrogation</h3>
      {fifthAmendment.length === 0 ? <p style={{ color: '#64748b' }}>No Fifth Amendment issues detected.</p> : null}
      {fifthAmendment.map(f => (
        <div key={f.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{f.issueType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={f.suppressionViability} color={viabilityColor(f.suppressionViability)} />
              {f.mirandaAdvisement === 'not_given' && <Badge text="NO MIRANDA" color="#ef4444" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{f.description.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>{f.legalBasis}</p>
        </div>
      ))}
    </div>
  );

  const renderConfrontationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Sixth Amendment — Confrontation Clause</h3>
      {sixthAmendment.length === 0 ? <p style={{ color: '#64748b' }}>No confrontation issues detected.</p> : null}
      {sixthAmendment.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.witnessName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.confrontationViability} color={viabilityColor(s.confrontationViability)} />
              {s.crawfordApplicable && <Badge text="CRAWFORD" color="#ef4444" />}
              {s.brutonIssue && <Badge text="BRUTON" color="#f59e0b" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{s.confrontationType.replace(/_/g, ' ')} — {s.testimonialStatus}</p>
        </div>
      ))}
    </div>
  );

  const renderDueProcessPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Due Process Integrity</h3>
      {dueProcess.length === 0 ? <p style={{ color: '#64748b' }}>No due process issues detected.</p> : null}
      {dueProcess.map(d => (
        <div key={d.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.issueType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={d.prejudiceLevel} color={prejudiceColor(d.prejudiceLevel)} />
              <Badge text={d.amendment} color="#7c3aed" />
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{d.description.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>Remedy: {d.remedyAvailable.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderSuppressionPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Suppression Issue Structures</h3>
      {suppression.length === 0 ? <p style={{ color: '#64748b' }}>No suppression issues mapped.</p> : null}
      {suppression.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.suppressionGround.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.impactIfSuppressed.replace(/_/g, ' ')} color={impactColor(s.impactIfSuppressed)} />
              <Badge text={s.constitutionalBasis} color="#7c3aed" />
              {s.motionFiled && <Badge text="MOTION FILED" color="#22c55e" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{s.evidenceDescription.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>Evidence type: {s.evidenceType}</p>
        </div>
      ))}
    </div>
  );

  const renderStructuralPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Structural Error Categorization</h3>
      {structural.length === 0 ? <p style={{ color: '#64748b' }}>No structural errors detected.</p> : null}
      {structural.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.errorType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {s.autoReversible && <Badge text="AUTO-REVERSIBLE" color="#ef4444" />}
              <Badge text={s.constitutionalBasis} color="#7c3aed" />
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{s.description.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>Authority: {s.caseAuthority}</p>
        </div>
      ))}
    </div>
  );

  const renderPreservationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Constitutional Preservation Graph</h3>
      {preservation.length === 0 ? <p style={{ color: '#64748b' }}>No preservation graphs built.</p> : null}
      {preservation.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.amendment} Amendment — {p.issueType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={p.currentStatus.replace(/_/g, ' ')} color={preservationColor(p.currentStatus)} />
              {p.riskOfForfeiture && <Badge text="AT RISK" color="#ef4444" />}
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: 12 }}>Chain length: {p.chainLength}</p>
        </div>
      ))}
    </div>
  );

  const renderTimelinePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Search & Seizure Chronology</h3>
      {searchSeizure.length === 0 ? <p style={{ color: '#64748b' }}>No search/seizure events recorded.</p> : null}
      {searchSeizure.map(e => (
        <div key={e.id} style={{ ...cardStyle, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 40, textAlign: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>#{e.sequenceNumber}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>{e.eventType.replace(/_/g, ' ')}</span>
              {e.constitutionalIssue && <Badge text="CONSTITUTIONAL ISSUE" color="#ef4444" />}
            </div>
            {e.officerIdentifier && <p style={{ color: '#64748b', fontSize: 12 }}>Officer: {e.officerIdentifier}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'search': return renderSearchPane();
      case 'interrogation': return renderInterrogationPane();
      case 'confrontation': return renderConfrontationPane();
      case 'dueprocess': return renderDueProcessPane();
      case 'suppression': return renderSuppressionPane();
      case 'structural': return renderStructuralPane();
      case 'preservation': return renderPreservationPane();
      case 'timeline': return renderTimelinePane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Constitutional Litigation Intelligence Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organizes provable constitutional issue structures — not constitutional litigation counsel
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
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Constitutional Analysis'}
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

export default ConstitutionalLitigationCockpit;
