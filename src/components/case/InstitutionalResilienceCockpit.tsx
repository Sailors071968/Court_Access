// ============================================================================
// Phase J.1 — Institutional Resilience Cockpit
// 8-pane continuity & preservation dashboard.
// Deterministic preservation — no opaque autonomous recovery.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface ResProps {
  caseId: string;
}

interface PresEntry { id: string; evidenceRecordId: string; preservationType: string; contentHash: string; storageLocation: string; integrityVerified: boolean; }
interface DisasterEntry { id: string; scenarioType: string; estimatedRecoveryTime: string; testResult: string; recoveryPriority: number; }
interface ContEntry { id: string; workflowName: string; workflowType: string; workflowStatus: string; stepsPassed: number; stepsFailed: number; }
interface ArchEntry { id: string; archiveType: string; survivabilityScore: number; checksPassed: number; checksFailed: number; storageRedundancy: number; }
interface RegionEntry { id: string; primaryRegion: string; secondaryRegion: string; datasetType: string; hashConsistent: boolean; syncLatency: number; }
interface GovEntry { id: string; recoveryEventId: string; recoveryType: string; authorizationLevel: string; dataIntegrityVerified: boolean; }
interface RetEntry { id: string; dataType: string; retentionPolicy: string; currentStatus: string; complianceVerified: boolean; }
interface CertEntry { id: string; certificationScope: string; preservationRate: number; certificationStatus: string; evidenceRecordsCount: number; preservedRecordsCount: number; }

type PaneName = 'preservation' | 'disaster' | 'continuity' | 'archival' | 'regions' | 'governance' | 'retention' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'preservation', label: 'Evidence Preservation' },
  { key: 'disaster', label: 'Disaster Recovery' },
  { key: 'continuity', label: 'Continuity Workflows' },
  { key: 'archival', label: 'Archival Survivability' },
  { key: 'regions', label: 'Multi-Region Verification' },
  { key: 'governance', label: 'Recovery Governance' },
  { key: 'retention', label: 'Retention Lifecycle' },
  { key: 'certification', label: 'Preservation Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'passed' || s === 'ready' || s === 'certified' || s === 'active' || s === true ? '#22c55e' :
  s === 'conditional' || s === 'partial' || s === 'pending' ? '#f59e0b' :
  s === 'failed' || s === 'untested' || s === false ? '#ef4444' : '#64748b';

export const InstitutionalResilienceCockpit: React.FC<ResProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('preservation');
  const [loading, setLoading] = useState(false);
  const [pres, setPres] = useState<PresEntry[]>([]);
  const [disaster, setDisaster] = useState<DisasterEntry[]>([]);
  const [cont, setCont] = useState<ContEntry[]>([]);
  const [arch, setArch] = useState<ArchEntry[]>([]);
  const [regions, setRegions] = useState<RegionEntry[]>([]);
  const [gov, setGov] = useState<GovEntry[]>([]);
  const [ret, setRet] = useState<RetEntry[]>([]);
  const [cert, setCert] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, c, a, r, g, rt, ct] = await Promise.all([
        fetch(`/api/resilience/preservation/${caseId}`).then(r => r.json()).catch(() => ({ preservations: [] })),
        fetch(`/api/resilience/disaster/${caseId}`).then(r => r.json()).catch(() => ({ plans: [] })),
        fetch(`/api/resilience/continuity/${caseId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/resilience/archival/${caseId}`).then(r => r.json()).catch(() => ({ validations: [] })),
        fetch(`/api/resilience/regions/${caseId}`).then(r => r.json()).catch(() => ({ verifications: [] })),
        fetch(`/api/resilience/governance/${caseId}`).then(r => r.json()).catch(() => ({ trackings: [] })),
        fetch(`/api/resilience/retention/${caseId}`).then(r => r.json()).catch(() => ({ retentions: [] })),
        fetch(`/api/resilience/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setPres(p.preservations || []); setDisaster(d.plans || []); setCont(c.workflows || []);
      setArch(a.validations || []); setRegions(r.verifications || []); setGov(g.trackings || []);
      setRet(rt.retentions || []); setCert(ct.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/resilience/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderPreservation = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidence Preservation</h3>
      {pres.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.contentHash.slice(0, 24)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={p.preservationType.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={p.storageLocation.replace(/_/g, ' ')} color="#3b82f6" />
              <Badge text={p.integrityVerified ? 'VERIFIED' : 'UNVERIFIED'} color={sc(p.integrityVerified)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDisaster = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Disaster Recovery Plans</h3>
      {disaster.map(d => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.scenarioType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`P${d.recoveryPriority}`} color={d.recoveryPriority === 1 ? '#ef4444' : d.recoveryPriority === 2 ? '#f59e0b' : '#22c55e'} />
              <Badge text={d.testResult} color={sc(d.testResult)} />
              <Badge text={d.estimatedRecoveryTime} color="#7c3aed" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderContinuity = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Continuity Workflows</h3>
      {cont.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.workflowName}</span>
            <Badge text={c.workflowStatus} color={sc(c.workflowStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{c.stepsPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: c.stepsFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{c.stepsFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderArchival = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Archival Survivability</h3>
      {arch.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.archiveType.replace(/_/g, ' ')}</span>
            <Badge text={`Score: ${a.survivabilityScore}%`} color={a.survivabilityScore >= 95 ? '#22c55e' : '#f59e0b'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Checks Passed</span><div style={{ color: '#22c55e', fontWeight: 700 }}>{a.checksPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ color: a.checksFailed > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{a.checksFailed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Redundancy</span><div style={{ fontWeight: 700 }}>{a.storageRedundancy}x</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRegions = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Multi-Region Verification</h3>
      {regions.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(r.hashConsistent)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.datasetType} — {r.primaryRegion} ↔ {r.secondaryRegion}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.hashConsistent ? 'CONSISTENT' : 'INCONSISTENT'} color={sc(r.hashConsistent)} />
              <Badge text={`${r.syncLatency}ms`} color="#7c3aed" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderGovernance = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Recovery Governance</h3>
      {gov.map(g => (
        <div key={g.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{g.recoveryEventId}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={g.recoveryType} color="#3b82f6" />
              <Badge text={g.authorizationLevel.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={g.dataIntegrityVerified ? 'INTEGRITY OK' : 'UNVERIFIED'} color={sc(g.dataIntegrityVerified)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRetention = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Retention Lifecycle</h3>
      {ret.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.dataType} — {r.retentionPolicy.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.currentStatus} color={sc(r.currentStatus)} />
              <Badge text={r.complianceVerified ? 'COMPLIANT' : 'UNVERIFIED'} color={sc(r.complianceVerified)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Preservation Certification</h3>
      {cert.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{c.certificationScope.replace(/_/g, ' ')}</span>
            <Badge text={c.certificationStatus} color={sc(c.certificationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Evidence</span><div style={{ fontWeight: 700 }}>{c.evidenceRecordsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Preserved</span><div style={{ fontWeight: 700 }}>{c.preservedRecordsCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: c.preservationRate >= 99 ? '#22c55e' : '#f59e0b' }}>{c.preservationRate}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'preservation': return renderPreservation();
      case 'disaster': return renderDisaster();
      case 'continuity': return renderContinuity();
      case 'archival': return renderArchival();
      case 'regions': return renderRegions();
      case 'governance': return renderGovernance();
      case 'retention': return renderRetention();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Institutional Resilience Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Long-term continuity — deterministic preservation & recovery
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Resilience Analysis'}
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

export default InstitutionalResilienceCockpit;
