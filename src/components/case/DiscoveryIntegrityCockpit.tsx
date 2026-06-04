// ============================================================================
// Phase G.2 — Discovery Integrity Intelligence Cockpit
// 8-pane prosecutorial disclosure analysis layer.
// Organizes provable disclosure and discovery structures.
// NEVER accuses prosecutors of misconduct.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface DiscoveryProps {
  caseId: string;
}

interface DisclosureTracker {
  id: string; disclosureType: string; itemDescription: string;
  disclosedBy: string; isLate: boolean; daysPastDue: number; completeness: string;
}

interface BradyFramework {
  id: string; evidenceItem: string; materialityType: string;
  materialityLevel: string; suppressionFound: boolean; prejudiceAnalysis: string; legalBasis: string;
}

interface GiglioDisclosure {
  id: string; witnessName: string; disclosureType: string;
  disclosed: boolean; disclosureTimeliness: string; impeachmentValue: string;
  napiueApplicable: boolean;
}

interface LateDisclosure {
  id: string; itemDescription: string; daysLate: number;
  prejudiceToDefense: string; defenseRemedy: string; motionFiled: boolean;
}

interface MissingEvidence {
  id: string; evidenceDescription: string; evidenceCategory: string;
  explanationGiven: string | null; materialityAssessment: string; arizonaVYoungblood: boolean;
}

interface WitnessBenefit {
  id: string; witnessName: string; benefitType: string;
  disclosed: boolean; disclosureTimeliness: string; impeachmentRelevance: string;
}

interface PreservationGraph {
  id: string; disclosureType: string; currentStatus: string;
  outstandingItems: number; riskOfSpoliation: boolean; chainLength: number;
}

interface ViolationEscalation {
  id: string; violationType: string; severity: string;
  escalationLevel: string; currentPhase: string; remedySought: string;
}

type PaneName = 'timeline' | 'brady' | 'giglio' | 'missing' | 'late' | 'benefits' | 'preservation' | 'escalation';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'timeline', label: 'Disclosure Timelines', icon: '📅' },
  { key: 'brady', label: 'Brady Materiality', icon: '⚖️' },
  { key: 'giglio', label: 'Giglio Impeachment', icon: '🔍' },
  { key: 'missing', label: 'Missing Disclosures', icon: '❌' },
  { key: 'late', label: 'Late Productions', icon: '⏰' },
  { key: 'benefits', label: 'Witness Benefits', icon: '💰' },
  { key: 'preservation', label: 'Preservation Integrity', icon: '🔒' },
  { key: 'escalation', label: 'Discovery Escalation', icon: '📈' },
];

const materialityColor = (m: string) => m === 'highly_material' ? '#ef4444' : m === 'material' ? '#f59e0b' : m === 'potentially_material' ? '#3b82f6' : '#64748b';
const severityColor = (s: string) => s === 'critical' ? '#ef4444' : s === 'severe' ? '#ef4444' : s === 'high' ? '#f59e0b' : s === 'significant' ? '#f59e0b' : s === 'medium' ? '#3b82f6' : '#64748b';
const prejudiceColor = (p: string) => p === 'severe' ? '#ef4444' : p === 'significant' ? '#f59e0b' : p === 'moderate' ? '#3b82f6' : '#64748b';
const statusColor = (s: string) => s === 'preserved' ? '#22c55e' : s === 'at_risk' ? '#f59e0b' : s === 'forfeited' ? '#ef4444' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const DiscoveryIntegrityCockpit: React.FC<DiscoveryProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('timeline');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [disclosures, setDisclosures] = useState<DisclosureTracker[]>([]);
  const [brady, setBrady] = useState<BradyFramework[]>([]);
  const [giglio, setGiglio] = useState<GiglioDisclosure[]>([]);
  const [late, setLate] = useState<LateDisclosure[]>([]);
  const [missing, setMissing] = useState<MissingEvidence[]>([]);
  const [benefits, setBenefits] = useState<WitnessBenefit[]>([]);
  const [preservation, setPreservation] = useState<PreservationGraph[]>([]);
  const [escalation, setEscalation] = useState<ViolationEscalation[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dl, br, gi, lt, mi, bn, pr, es] = await Promise.all([
        fetch(`/api/discovery/disclosures/${caseId}`).then(r => r.json()).catch(() => ({ disclosures: [] })),
        fetch(`/api/discovery/brady/${caseId}`).then(r => r.json()).catch(() => ({ frameworks: [] })),
        fetch(`/api/discovery/giglio/${caseId}`).then(r => r.json()).catch(() => ({ disclosures: [] })),
        fetch(`/api/discovery/late/${caseId}`).then(r => r.json()).catch(() => ({ lateDisclosures: [] })),
        fetch(`/api/discovery/missing/${caseId}`).then(r => r.json()).catch(() => ({ missingItems: [] })),
        fetch(`/api/discovery/benefits/${caseId}`).then(r => r.json()).catch(() => ({ benefits: [] })),
        fetch(`/api/discovery/preservation/${caseId}`).then(r => r.json()).catch(() => ({ graphs: [] })),
        fetch(`/api/discovery/escalation/${caseId}`).then(r => r.json()).catch(() => ({ escalations: [] })),
      ]);
      setDisclosures(dl.disclosures || []);
      setBrady(br.frameworks || []);
      setGiglio(gi.disclosures || []);
      setLate(lt.lateDisclosures || []);
      setMissing(mi.missingItems || []);
      setBenefits(bn.benefits || []);
      setPreservation(pr.graphs || []);
      setEscalation(es.escalations || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/discovery/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderTimelinePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Disclosure Timeline</h3>
      {disclosures.length === 0 ? <p style={{ color: '#64748b' }}>No disclosures tracked.</p> : null}
      {disclosures.map(d => (
        <div key={d.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.disclosureType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={d.completeness} color={d.completeness === 'complete' ? '#22c55e' : d.completeness === 'partial' ? '#f59e0b' : '#ef4444'} />
              {d.isLate && <Badge text={`${d.daysPastDue}d LATE`} color="#ef4444" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{d.itemDescription.slice(0, 200)}</p>
        </div>
      ))}
    </div>
  );

  const renderBradyPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Brady Materiality Framework</h3>
      {brady.length === 0 ? <p style={{ color: '#64748b' }}>No Brady materiality analysis.</p> : null}
      {brady.map(b => (
        <div key={b.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{b.materialityType}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={b.materialityLevel.replace(/_/g, ' ')} color={materialityColor(b.materialityLevel)} />
              {b.suppressionFound && <Badge text="SUPPRESSION" color="#ef4444" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{b.evidenceItem.slice(0, 200)}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>{b.legalBasis} — {b.prejudiceAnalysis.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderGiglioPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Giglio Impeachment Evidence</h3>
      {giglio.length === 0 ? <p style={{ color: '#64748b' }}>No Giglio disclosures tracked.</p> : null}
      {giglio.map(g => (
        <div key={g.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{g.witnessName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={g.impeachmentValue} color={g.impeachmentValue === 'high' ? '#ef4444' : g.impeachmentValue === 'medium' ? '#f59e0b' : '#64748b'} />
              {!g.disclosed && <Badge text="NOT DISCLOSED" color="#ef4444" />}
              {g.napiueApplicable && <Badge text="NAPUE" color="#7c3aed" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{g.disclosureType.replace(/_/g, ' ')} — {g.disclosureTimeliness.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderMissingPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Missing Disclosures</h3>
      {missing.length === 0 ? <p style={{ color: '#64748b' }}>No missing evidence detected.</p> : null}
      {missing.map(m => (
        <div key={m.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.evidenceCategory}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={m.materialityAssessment.replace(/_/g, ' ')} color={materialityColor(m.materialityAssessment)} />
              {m.arizonaVYoungblood && <Badge text="YOUNGBLOOD" color="#ef4444" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{m.evidenceDescription.slice(0, 200)}</p>
          {m.explanationGiven && <p style={{ color: '#64748b', fontSize: 12 }}>Explanation: {m.explanationGiven}</p>}
        </div>
      ))}
    </div>
  );

  const renderLatePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Late Productions</h3>
      {late.length === 0 ? <p style={{ color: '#64748b' }}>No late productions detected.</p> : null}
      {late.map(l => (
        <div key={l.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{l.itemDescription.slice(0, 100)}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`${l.daysLate}d LATE`} color="#ef4444" />
              <Badge text={l.prejudiceToDefense} color={prejudiceColor(l.prejudiceToDefense)} />
              {l.motionFiled && <Badge text="MOTION FILED" color="#22c55e" />}
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: 12 }}>Remedy: {l.defenseRemedy.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderBenefitsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Witness Benefits</h3>
      {benefits.length === 0 ? <p style={{ color: '#64748b' }}>No witness benefits tracked.</p> : null}
      {benefits.map(b => (
        <div key={b.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{b.witnessName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={b.benefitType.replace(/_/g, ' ')} color="#f59e0b" />
              {!b.disclosed && <Badge text="UNDISCLOSED" color="#ef4444" />}
              <Badge text={b.impeachmentRelevance} color={b.impeachmentRelevance === 'high' ? '#ef4444' : '#f59e0b'} />
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: 12 }}>Timeliness: {b.disclosureTimeliness.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  );

  const renderPreservationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Disclosure Preservation Integrity</h3>
      {preservation.length === 0 ? <p style={{ color: '#64748b' }}>No preservation graphs built.</p> : null}
      {preservation.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.disclosureType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={p.currentStatus.replace(/_/g, ' ')} color={statusColor(p.currentStatus)} />
              {p.riskOfSpoliation && <Badge text="SPOLIATION RISK" color="#ef4444" />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
            <span>Chain: {p.chainLength}</span>
            <span>Outstanding: {p.outstandingItems}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEscalationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Discovery Escalation Tracking</h3>
      {escalation.length === 0 ? <p style={{ color: '#64748b' }}>No escalations tracked.</p> : null}
      {escalation.map(e => (
        <div key={e.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.violationType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.severity} color={severityColor(e.severity)} />
              <Badge text={e.escalationLevel.replace(/_/g, ' ')} color="#7c3aed" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
            <span>Phase: {e.currentPhase.replace(/_/g, ' ')}</span>
            <span>Remedy: {e.remedySought.replace(/_/g, ' ')}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'timeline': return renderTimelinePane();
      case 'brady': return renderBradyPane();
      case 'giglio': return renderGiglioPane();
      case 'missing': return renderMissingPane();
      case 'late': return renderLatePane();
      case 'benefits': return renderBenefitsPane();
      case 'preservation': return renderPreservationPane();
      case 'escalation': return renderEscalationPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Discovery Integrity Intelligence Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organizes provable disclosure and discovery structures — does not accuse prosecutors of misconduct
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
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Discovery Analysis'}
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

export default DiscoveryIntegrityCockpit;
