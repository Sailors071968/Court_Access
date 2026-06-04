// ============================================================================
// Phase D.6 — Evidentiary Objection Cockpit
// 8-pane courtroom objection intelligence layer.
// Identifies and organizes provable evidentiary and procedural issues.
// NEVER acts as litigation counsel.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ObjectionCockpitProps {
  caseId: string;
}

interface PaneData {
  hearsay: HearsayIssue[];
  foundation: FoundationDefect[];
  authentication: AuthChallenge[];
  relevance: EvidentiaryObjection[];
  prejudice: EvidentiaryObjection[];
  impeachment: EvidentiaryObjection[];
  constitutional: ConstitutionalIssue[];
  discovery: DiscoveryViolation[];
  bradyGiglio: BradyGiglioIssue[];
  suppression: SuppressionIssue[];
  chainOfCustody: CustodyIssue[];
}

interface HearsayIssue {
  id: string; declarant: string; hearsayLevel: string; statementText: string;
  page: number | null; lineStart: number | null; exceptionClaimed: string | null;
  objectionBasis: string; strength: string;
}

interface FoundationDefect {
  id: string; defectType: string; evidenceCodeSection: string; affectedText: string;
  page: number | null; speaker: string | null; explanation: string; strength: string;
}

interface AuthChallenge {
  id: string; documentId: string | null; challengeType: string; evidenceCodeSection: string;
  documentDescription: string; explanation: string; strength: string;
}

interface EvidentiaryObjection {
  id: string; objectionType: string; evidenceCodeSection: string; title: string;
  citedText: string; citedPage: number | null; citedSpeaker: string | null; strength: string; status: string;
}

interface ConstitutionalIssue {
  id: string; amendmentBasis: string; issueType: string; title: string;
  description: string; suppressionPotential: string; strength: string;
}

interface DiscoveryViolation {
  id: string; violationType: string; description: string; remedySought: string;
  strength: string;
}

interface BradyGiglioIssue {
  id: string; issueType: string; title: string; description: string;
  materialityAnalysis: string; strength: string;
}

interface SuppressionIssue {
  id: string; suppressionBasis: string; evidenceToSuppress: string;
  legalBasis: string; impactAnalysis: string; strength: string;
}

interface CustodyIssue {
  id: string; evidenceItem: string; issueType: string; explanation: string;
  strength: string;
}

type PaneName = 'hearsay' | 'foundation' | 'authentication' | 'relevance' | 'prejudice' | 'impeachment' | 'constitutional' | 'discovery';

const PANES: Array<{ key: PaneName; label: string; icon: string }> = [
  { key: 'hearsay', label: 'Hearsay', icon: '🗣' },
  { key: 'foundation', label: 'Foundation', icon: '🧱' },
  { key: 'authentication', label: 'Authentication', icon: '🔐' },
  { key: 'relevance', label: 'Relevance', icon: '🎯' },
  { key: 'prejudice', label: 'EC 352', icon: '⚖️' },
  { key: 'impeachment', label: 'Impeachment', icon: '⚡' },
  { key: 'constitutional', label: 'Constitutional', icon: '📜' },
  { key: 'discovery', label: 'Discovery', icon: '📂' },
];

const strengthColor = (s: string) => {
  if (s === 'strong') return '#ef4444';
  if (s === 'moderate') return '#f59e0b';
  return '#6b7280';
};

const strengthBadge = (s: string) => (
  <span style={{
    background: strengthColor(s), color: '#fff', padding: '2px 8px',
    borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  }}>{s}</span>
);

export const EvidentiaryObjectionCockpit: React.FC<ObjectionCockpitProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('hearsay');
  const [data, setData] = useState<PaneData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisRun, setAnalysisRun] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hearsayRes, foundationRes, authRes, objRes, constRes, discRes, bradyRes, suppRes, custRes] = await Promise.all([
        fetch(`/api/objections/hearsay/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/objections/foundation/${caseId}`).then(r => r.json()).catch(() => ({ defects: [] })),
        fetch(`/api/objections/authentication/${caseId}`).then(r => r.json()).catch(() => ({ challenges: [] })),
        fetch(`/api/objections/general/${caseId}`).then(r => r.json()).catch(() => ({ objections: [] })),
        fetch(`/api/objections/constitutional/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/objections/discovery/${caseId}`).then(r => r.json()).catch(() => ({ violations: [] })),
        fetch(`/api/objections/brady/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/objections/suppression/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/objections/custody/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
      ]);

      const allObjections = objRes.objections || [];
      setData({
        hearsay: hearsayRes.issues || [],
        foundation: foundationRes.defects || [],
        authentication: authRes.challenges || [],
        relevance: allObjections.filter((o: EvidentiaryObjection) => o.objectionType === 'relevance'),
        prejudice: allObjections.filter((o: EvidentiaryObjection) => o.objectionType === 'prejudice_352'),
        impeachment: allObjections.filter((o: EvidentiaryObjection) => ['impeachment', 'leading'].includes(o.objectionType)),
        constitutional: constRes.issues || [],
        discovery: discRes.violations || [],
        bradyGiglio: bradyRes.issues || [],
        suppression: suppRes.issues || [],
        chainOfCustody: custRes.issues || [],
      });
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/objections/analyze/${caseId}`, { method: 'POST' });
      setAnalysisRun(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex', gap: 4, padding: '8px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
    overflowX: 'auto',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', cursor: 'pointer', borderRadius: 6,
    background: active ? '#3b82f6' : 'transparent',
    color: active ? '#fff' : '#94a3b8',
    fontWeight: active ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap',
    border: 'none', transition: 'all 0.15s',
  });

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155',
  };

  const renderHearsayPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Hearsay Issues (EC § 1200)</h3>
      {(!data?.hearsay || data.hearsay.length === 0) ? <p style={{ color: '#64748b' }}>No hearsay issues detected.</p> : null}
      {data?.hearsay.map(h => (
        <div key={h.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{h.declarant} — {h.hearsayLevel} hearsay</span>
            {strengthBadge(h.strength)}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0' }}>"{h.statementText.slice(0, 300)}"</p>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Citation: p. {h.page ?? '?'}, ln. {h.lineStart ?? '?'} | Basis: {h.objectionBasis}
          </div>
          {h.exceptionClaimed && (
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
              Exception Claimed: {h.exceptionClaimed}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderFoundationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Foundation Defects</h3>
      {(!data?.foundation || data.foundation.length === 0) ? <p style={{ color: '#64748b' }}>No foundation defects detected.</p> : null}
      {data?.foundation.map(f => (
        <div key={f.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{f.defectType.replace(/_/g, ' ')} ({f.evidenceCodeSection})</span>
            {strengthBadge(f.strength)}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>"{f.affectedText.slice(0, 250)}"</p>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {f.speaker && `Speaker: ${f.speaker} | `}Citation: p. {f.page ?? '?'}
          </div>
          <p style={{ fontSize: 12, color: '#e2e8f0', marginTop: 8 }}>{f.explanation}</p>
        </div>
      ))}
    </div>
  );

  const renderAuthenticationPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Authentication Challenges (EC § 1400–1402)</h3>
      {(!data?.authentication || data.authentication.length === 0) ? <p style={{ color: '#64748b' }}>No authentication issues detected.</p> : null}
      {data?.authentication.map(a => (
        <div key={a.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.challengeType.replace(/_/g, ' ')} ({a.evidenceCodeSection})</span>
            {strengthBadge(a.strength)}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Document: {a.documentDescription}</p>
          <p style={{ fontSize: 12, color: '#e2e8f0', marginTop: 8 }}>{a.explanation}</p>
        </div>
      ))}
    </div>
  );

  const renderObjectionsPane = (items: EvidentiaryObjection[], title: string) => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>{title}</h3>
      {items.length === 0 ? <p style={{ color: '#64748b' }}>No issues detected.</p> : null}
      {items.map(o => (
        <div key={o.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{o.title} ({o.evidenceCodeSection})</span>
            {strengthBadge(o.strength)}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>"{o.citedText.slice(0, 250)}"</p>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {o.citedSpeaker && `Speaker: ${o.citedSpeaker} | `}Citation: p. {o.citedPage ?? '?'} | Status: {o.status}
          </div>
        </div>
      ))}
    </div>
  );

  const renderConstitutionalPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Constitutional Issues</h3>
      {(!data?.constitutional || data.constitutional.length === 0) ? <p style={{ color: '#64748b' }}>No constitutional issues detected.</p> : null}
      {data?.constitutional.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.title}</span>
            {strengthBadge(c.strength)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
              {c.amendmentBasis} Amendment
            </span>
            <span style={{ background: c.suppressionPotential === 'high' ? '#ef4444' : '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
              Suppression: {c.suppressionPotential}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{c.description}</p>
        </div>
      ))}

      {data?.suppression && data.suppression.length > 0 && (
        <>
          <h3 style={{ color: '#f8fafc', margin: '24px 0 12px' }}>Suppression Issues</h3>
          {data.suppression.map(s => (
            <div key={s.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{s.suppressionBasis.replace(/_/g, ' ')}</span>
                {strengthBadge(s.strength)}
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Target: {s.evidenceToSuppress}</p>
              <p style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>{s.legalBasis}</p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.impactAnalysis}</p>
            </div>
          ))}
        </>
      )}

      {data?.bradyGiglio && data.bradyGiglio.length > 0 && (
        <>
          <h3 style={{ color: '#f8fafc', margin: '24px 0 12px' }}>Brady/Giglio Issues</h3>
          {data.bradyGiglio.map(b => (
            <div key={b.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{b.title}</span>
                {strengthBadge(b.strength)}
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>{b.description}</p>
              <p style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>{b.materialityAnalysis}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderDiscoveryPane = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Discovery Violations (PC § 1054)</h3>
      {(!data?.discovery || data.discovery.length === 0) ? <p style={{ color: '#64748b' }}>No discovery violations detected.</p> : null}
      {data?.discovery.map(d => (
        <div key={d.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.violationType.replace(/_/g, ' ')}</span>
            {strengthBadge(d.strength)}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>{d.description}</p>
          <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
            Remedy Sought: {d.remedySought}
          </div>
        </div>
      ))}

      {data?.chainOfCustody && data.chainOfCustody.length > 0 && (
        <>
          <h3 style={{ color: '#f8fafc', margin: '24px 0 12px' }}>Chain of Custody Issues</h3>
          {data.chainOfCustody.map(c => (
            <div key={c.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{c.issueType.replace(/_/g, ' ')}</span>
                {strengthBadge(c.strength)}
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>{c.evidenceItem}</p>
              <p style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>{c.explanation}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderActivePane = () => {
    if (!data) return <p style={{ color: '#64748b', padding: 24 }}>Loading...</p>;
    switch (activePane) {
      case 'hearsay': return renderHearsayPane();
      case 'foundation': return renderFoundationPane();
      case 'authentication': return renderAuthenticationPane();
      case 'relevance': return renderObjectionsPane(data.relevance, 'Relevance Objections');
      case 'prejudice': return renderObjectionsPane(data.prejudice, 'EC § 352 — Undue Prejudice');
      case 'impeachment': return renderObjectionsPane(data.impeachment, 'Impeachment Objections');
      case 'constitutional': return renderConstitutionalPane();
      case 'discovery': return renderDiscoveryPane();
      default: return null;
    }
  };

  const totalIssues = data ? (
    data.hearsay.length + data.foundation.length + data.authentication.length +
    data.relevance.length + data.prejudice.length + data.impeachment.length +
    data.constitutional.length + data.discovery.length +
    (data.bradyGiglio?.length || 0) + (data.suppression?.length || 0) + (data.chainOfCustody?.length || 0)
  ) : 0;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Evidentiary Objection Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {totalIssues} issues identified | Identifies provable evidentiary/procedural issues — does not act as counsel
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
          {loading ? 'Analyzing...' : analysisRun ? 'Re-run Analysis' : 'Run Objection Analysis'}
        </button>
      </div>

      <div style={tabBarStyle}>
        {PANES.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePane(p.key)}
            style={tabStyle(activePane === p.key)}
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

export default EvidentiaryObjectionCockpit;
