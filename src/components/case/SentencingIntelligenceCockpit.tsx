// ============================================================================
// Phase E.3 — Sentencing Intelligence Cockpit
// 8-pane sentencing intelligence layer.
// Organizes sentencing-related legal structures. NEVER functions as sentencing counsel.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface SentencingProps {
  caseId: string;
}

interface Exposure {
  id: string; chargeDescription: string; penalCodeSection: string; offenseCategory: string;
  baseTerm: string; totalExposureMonthsLow: number; totalExposureMonthsHigh: number;
  lifePossible: boolean; lwopPossible: boolean;
}

interface Enhancement {
  id: string; enhancementType: string; penalCodeSection: string; description: string;
  additionalYears: number; mandatory: boolean; strikeable: boolean;
}

interface StrikePrior {
  id: string; priorType: string; priorDescription: string; penalCodeSection: string;
  qualifiesAsStrike: boolean; secondStrikeDoubling: boolean; thirdStrike25ToLife: boolean;
  romeroMotionViable: boolean;
}

interface MitigationFactor {
  id: string; factorType: string; description: string; legalBasis: string; strength: string;
}

interface AggravationFactor {
  id: string; factorType: string; description: string; legalBasis: string; strength: string;
}

interface ProbationElig {
  id: string; chargeDescription: string; eligibleForProbation: boolean;
  statutoryBar: string | null; maxProbationYears: number;
}

interface CustodyCredit {
  id: string; actualDays: number; conductCredits: number; creditRate: string;
  totalCredits: number; creditLimitation: string | null;
}

interface PleaConsequence {
  id: string; chargeDescription: string; sentencingExposure: string;
  immigrationConsequence: string | null; firearmRestriction: boolean;
  sexRegistration: boolean; strikeConsequence: boolean; probationLikelihood: string | null;
}

type PaneName = 'exposure' | 'enhancements' | 'strikes' | 'mitigation' | 'aggravation' | 'probation' | 'credits' | 'plea';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'exposure', label: 'Sentencing Exposure', icon: '⚖️' },
  { key: 'enhancements', label: 'Enhancements', icon: '📈' },
  { key: 'strikes', label: 'Strikes/Priors', icon: '⚾' },
  { key: 'mitigation', label: 'Mitigation', icon: '🛡️' },
  { key: 'aggravation', label: 'Aggravation', icon: '🔥' },
  { key: 'probation', label: 'Probation Eligibility', icon: '📋' },
  { key: 'credits', label: 'Custody Credits', icon: '🔢' },
  { key: 'plea', label: 'Plea Consequences', icon: '📝' },
];

const strengthColor = (s: string) => s === 'strong' ? '#22c55e' : s === 'moderate' ? '#f59e0b' : '#ef4444';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const SentencingIntelligenceCockpit: React.FC<SentencingProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('exposure');
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [exposure, setExposure] = useState<Exposure[]>([]);
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [strikes, setStrikes] = useState<StrikePrior[]>([]);
  const [mitigation, setMitigation] = useState<MitigationFactor[]>([]);
  const [aggravation, setAggravation] = useState<AggravationFactor[]>([]);
  const [probation, setProbation] = useState<ProbationElig[]>([]);
  const [credits, setCredits] = useState<CustodyCredit[]>([]);
  const [plea, setPlea] = useState<PleaConsequence[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expR, enhR, strR, mitR, aggR, proR, creR, pleR] = await Promise.all([
        fetch(`/api/sentencing/exposure/${caseId}`).then(r => r.json()).catch(() => ({ exposures: [] })),
        fetch(`/api/sentencing/enhancements/${caseId}`).then(r => r.json()).catch(() => ({ enhancements: [] })),
        fetch(`/api/sentencing/strikes/${caseId}`).then(r => r.json()).catch(() => ({ priors: [] })),
        fetch(`/api/sentencing/mitigation/${caseId}`).then(r => r.json()).catch(() => ({ factors: [] })),
        fetch(`/api/sentencing/aggravation/${caseId}`).then(r => r.json()).catch(() => ({ factors: [] })),
        fetch(`/api/sentencing/probation/${caseId}`).then(r => r.json()).catch(() => ({ eligibilities: [] })),
        fetch(`/api/sentencing/credits/${caseId}`).then(r => r.json()).catch(() => ({ credits: [] })),
        fetch(`/api/sentencing/plea/${caseId}`).then(r => r.json()).catch(() => ({ consequences: [] })),
      ]);
      setExposure(expR.exposures || []);
      setEnhancements(enhR.enhancements || []);
      setStrikes(strR.priors || []);
      setMitigation(mitR.factors || []);
      setAggravation(aggR.factors || []);
      setProbation(proR.eligibilities || []);
      setCredits(creR.creditAnalysis ? [creR.creditAnalysis] : []);
      setPlea(pleR.consequences || []);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/sentencing/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderExposurePane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Sentencing Exposure Analysis</h3>
      {exposure.length === 0 ? <p style={{ color: '#64748b' }}>No sentencing exposure calculated. Run analysis first.</p> : null}
      {exposure.map(e => (
        <div key={e.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.penalCodeSection}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.offenseCategory} color={e.offenseCategory === 'felony' ? '#ef4444' : e.offenseCategory === 'wobbler' ? '#f59e0b' : '#22c55e'} />
              {e.lifePossible && <Badge text="LIFE" color="#991b1b" />}
              {e.lwopPossible && <Badge text="LWOP" color="#450a0a" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{e.chargeDescription.slice(0, 150)}</p>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13 }}>
            <div>Base: <strong>{e.baseTerm}</strong></div>
            <div>Total Exposure: <strong style={{ color: '#ef4444' }}>{e.totalExposureMonthsLow}–{e.totalExposureMonthsHigh} months</strong></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEnhancementsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Enhancement Stacking</h3>
      {enhancements.length === 0 ? <p style={{ color: '#64748b' }}>No enhancements detected.</p> : null}
      {enhancements.map(e => (
        <div key={e.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.enhancementType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {e.mandatory && <Badge text="MANDATORY" color="#991b1b" />}
              {e.strikeable && <Badge text="STRIKEABLE" color="#ef4444" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{e.penalCodeSection} — +{e.additionalYears} years</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>{e.description.slice(0, 150)}</p>
        </div>
      ))}
    </div>
  );

  const renderStrikesPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Strike/Prior Analysis</h3>
      {strikes.length === 0 ? <p style={{ color: '#64748b' }}>No strike priors detected.</p> : null}
      {strikes.map(s => (
        <div key={s.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.priorType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {s.qualifiesAsStrike && <Badge text="STRIKE" color="#ef4444" />}
              {s.thirdStrike25ToLife && <Badge text="25-LIFE" color="#991b1b" />}
              {s.romeroMotionViable && <Badge text="ROMERO VIABLE" color="#22c55e" />}
            </div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{s.penalCodeSection}</p>
          {s.secondStrikeDoubling && <p style={{ color: '#f59e0b', fontSize: 12 }}>Second strike — doubles base term</p>}
        </div>
      ))}
    </div>
  );

  const renderMitigationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Mitigation Factors</h3>
      {mitigation.length === 0 ? <p style={{ color: '#64748b' }}>No mitigation factors identified.</p> : null}
      {mitigation.map(m => (
        <div key={m.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{m.factorType.replace(/_/g, ' ')}</span>
            <Badge text={m.strength} color={strengthColor(m.strength)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{m.description.slice(0, 200)}</p>
          <p style={{ color: '#7c3aed', fontSize: 12, marginTop: 8 }}>{m.legalBasis}</p>
        </div>
      ))}
    </div>
  );

  const renderAggravationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Aggravation Factors</h3>
      {aggravation.length === 0 ? <p style={{ color: '#64748b' }}>No aggravation factors identified.</p> : null}
      {aggravation.map(a => (
        <div key={a.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.factorType.replace(/_/g, ' ')}</span>
            <Badge text={a.strength} color={strengthColor(a.strength)} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{a.description.slice(0, 200)}</p>
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{a.legalBasis}</p>
        </div>
      ))}
    </div>
  );

  const renderProbationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Probation Eligibility</h3>
      {probation.length === 0 ? <p style={{ color: '#64748b' }}>No probation eligibility data.</p> : null}
      {probation.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.chargeDescription.slice(0, 80)}</span>
            <Badge text={p.eligibleForProbation ? 'ELIGIBLE' : 'INELIGIBLE'} color={p.eligibleForProbation ? '#22c55e' : '#ef4444'} />
          </div>
          {p.statutoryBar && <p style={{ color: '#ef4444', fontSize: 12 }}>Bar: {p.statutoryBar}</p>}
          {p.eligibleForProbation && <p style={{ color: '#22c55e', fontSize: 12 }}>Max: {p.maxProbationYears} years</p>}
        </div>
      ))}
    </div>
  );

  const renderCreditsPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Custody Credits</h3>
      {credits.length === 0 ? <p style={{ color: '#64748b' }}>No custody credit data. Run analysis first.</p> : null}
      {credits.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 16, fontSize: 14 }}>
            <div>Actual Days: <strong>{c.actualDays}</strong></div>
            <div>Conduct Credits: <strong>{c.conductCredits}</strong></div>
            <div>Total: <strong style={{ color: '#22c55e' }}>{c.totalCredits}</strong></div>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Rate: {c.creditRate.replace(/_/g, ' ')}</p>
          {c.creditLimitation && <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 8 }}>{c.creditLimitation}</p>}
        </div>
      ))}
    </div>
  );

  const renderPleaPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Plea Consequence Structures</h3>
      {plea.length === 0 ? <p style={{ color: '#64748b' }}>No plea consequences modeled.</p> : null}
      {plea.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.chargeDescription.slice(0, 100)}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Exposure: {p.sentencingExposure}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {p.strikeConsequence && <Badge text="STRIKE" color="#ef4444" />}
            {p.firearmRestriction && <Badge text="FIREARM BAN" color="#f59e0b" />}
            {p.sexRegistration && <Badge text="PC 290" color="#991b1b" />}
          </div>
          {p.immigrationConsequence && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{p.immigrationConsequence}</p>}
          {p.probationLikelihood && <p style={{ color: '#64748b', fontSize: 12 }}>Probation: {p.probationLikelihood}</p>}
        </div>
      ))}
    </div>
  );

  const renderActivePane = () => {
    switch (activePane) {
      case 'exposure': return renderExposurePane();
      case 'enhancements': return renderEnhancementsPane();
      case 'strikes': return renderStrikesPane();
      case 'mitigation': return renderMitigationPane();
      case 'aggravation': return renderAggravationPane();
      case 'probation': return renderProbationPane();
      case 'credits': return renderCreditsPane();
      case 'plea': return renderPleaPane();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Sentencing Intelligence Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organizes sentencing-related legal structures — does not function as sentencing counsel
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: '10px 20px', background: loading ? '#475569' : '#dc2626',
            color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 14,
          }}
        >
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Sentencing Intelligence Analysis'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        {PANES.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePane(p.key)}
            style={{
              padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
              background: activePane === p.key ? '#dc2626' : 'transparent',
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

export default SentencingIntelligenceCockpit;
