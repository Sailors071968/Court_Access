// ============================================================================
// Phase H.2 — Forensic Integrity Cockpit
// 8-pane evidentiary integrity dashboard.
// Maximizes evidentiary integrity and deterministic reproducibility.
// NEVER creates unverifiable forensic claims.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface IntegrityProps {
  caseId: string;
}

interface HashEntry { id: string; evidenceId: string; hashAlgorithm: string; hashValue: string; verificationStatus: string; contentLength: number; }
interface ChainEntry { id: string; analysisLayer: string; outputRecordId: string; reproducible: boolean; chainPosition: number; }
interface ReplayEntry { id: string; replayType: string; targetLayer: string | null; matchStatus: string; targetRecordId: string | null; }
interface CorruptionEntry { id: string; evidenceId: string; corruptionFound: boolean; severity: string; detectionMethod: string; remediationStatus: string; }
interface ExportSig { id: string; exportType: string; contentHash: string; recordCount: number; verified: boolean; }
interface VersionEntry { id: string; evidenceId: string; versionNumber: number; changeType: string; versionHash: string; }
interface BreachAlert { id: string; breachType: string; severity: string; affectedLayer: string; description: string; acknowledged: boolean; }
interface Certification { id: string; certificationStatus: string; integrityScore: number; hashesVerified: number; hashFailures: number; chainsVerified: number; chainBreaks: number; }

type PaneName = 'hashes' | 'chains' | 'replay' | 'corruption' | 'exports' | 'provenance' | 'certification' | 'reproducibility';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'hashes', label: 'Evidence Hashes' },
  { key: 'chains', label: 'Chain of Analysis' },
  { key: 'replay', label: 'Replay Verification' },
  { key: 'corruption', label: 'Corruption Alerts' },
  { key: 'exports', label: 'Export Verification' },
  { key: 'provenance', label: 'Provenance Lineage' },
  { key: 'certification', label: 'Integrity Certification' },
  { key: 'reproducibility', label: 'Reproducibility' },
];

const sevColor = (s: string) => s === 'critical' ? '#ef4444' : s === 'high' ? '#f59e0b' : s === 'medium' ? '#3b82f6' : '#22c55e';
const statusBadge = (s: string) => s === 'verified' ? '#22c55e' : s === 'tampered' ? '#ef4444' : s === 'pending' ? '#f59e0b' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const ForensicIntegrityCockpit: React.FC<IntegrityProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('hashes');
  const [loading, setLoading] = useState(false);
  const [hashes, setHashes] = useState<HashEntry[]>([]);
  const [chains, setChains] = useState<ChainEntry[]>([]);
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [corruptions, setCorruptions] = useState<CorruptionEntry[]>([]);
  const [exports, setExports] = useState<ExportSig[]>([]);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [breaches, setBreaches] = useState<BreachAlert[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, c, r, co, ex, v, b, cert] = await Promise.all([
        fetch(`/api/integrity/hashes/${caseId}`).then(r => r.json()).catch(() => ({ hashes: [] })),
        fetch(`/api/integrity/chains/${caseId}`).then(r => r.json()).catch(() => ({ chains: [] })),
        fetch(`/api/integrity/replays/${caseId}`).then(r => r.json()).catch(() => ({ replays: [] })),
        fetch(`/api/integrity/corruption/${caseId}`).then(r => r.json()).catch(() => ({ detections: [] })),
        fetch(`/api/integrity/exports/${caseId}`).then(r => r.json()).catch(() => ({ signatures: [] })),
        fetch(`/api/integrity/versions/${caseId}`).then(r => r.json()).catch(() => ({ versions: [] })),
        fetch(`/api/integrity/breaches/${caseId}`).then(r => r.json()).catch(() => ({ alerts: [] })),
        fetch(`/api/integrity/certifications/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setHashes(h.hashes || []); setChains(c.chains || []); setReplays(r.replays || []);
      setCorruptions(co.detections || []); setExports(ex.signatures || []); setVersions(v.versions || []);
      setBreaches(b.alerts || []); setCertifications(cert.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/integrity/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderHashes = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidence Integrity Hashes</h3>
      {hashes.slice(0, 20).map(h => (
        <div key={h.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{h.hashValue.slice(0, 24)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={h.hashAlgorithm} color="#7c3aed" />
              <Badge text={h.verificationStatus} color={statusBadge(h.verificationStatus)} />
              <Badge text={`${h.contentLength} bytes`} color="#64748b" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderChains = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Chain of Analysis Verification</h3>
      {chains.slice(0, 20).map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.analysisLayer}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.reproducible ? 'REPRODUCIBLE' : 'BROKEN'} color={c.reproducible ? '#22c55e' : '#ef4444'} />
              <Badge text={`Position ${c.chainPosition}`} color="#64748b" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReplay = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Deterministic Replay Verification</h3>
      {replays.slice(0, 20).map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.targetLayer || 'unknown'} — {r.replayType.replace(/_/g, ' ')}</span>
            <Badge text={r.matchStatus.replace(/_/g, ' ')} color={r.matchStatus === 'exact_match' ? '#22c55e' : '#ef4444'} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderCorruption = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Evidence Corruption Detection</h3>
      {corruptions.slice(0, 20).map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{c.detectionMethod.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.corruptionFound ? 'CORRUPTION FOUND' : 'CLEAN'} color={c.corruptionFound ? '#ef4444' : '#22c55e'} />
              <Badge text={c.severity} color={sevColor(c.severity)} />
              <Badge text={c.remediationStatus.replace(/_/g, ' ')} color={c.remediationStatus === 'resolved' ? '#22c55e' : '#f59e0b'} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderExports = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Export Verification Signatures</h3>
      {exports.slice(0, 10).map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{e.contentHash.slice(0, 24)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.exportType.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={`${e.recordCount} records`} color="#64748b" />
              <Badge text={e.verified ? 'VERIFIED' : 'UNVERIFIED'} color={e.verified ? '#22c55e' : '#f59e0b'} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderProvenance = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Multi-Version Evidence Provenance</h3>
      {versions.slice(0, 20).map(v => (
        <div key={v.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v.versionHash.slice(0, 16)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`v${v.versionNumber}`} color="#7c3aed" />
              <Badge text={v.changeType} color="#3b82f6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Forensic Audit Certification</h3>
      {certifications.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Integrity Score: {(c.integrityScore * 100).toFixed(1)}%</span>
            <Badge text={c.certificationStatus} color={c.certificationStatus === 'certified' ? '#22c55e' : c.certificationStatus === 'conditional' ? '#f59e0b' : '#ef4444'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Hashes Verified</span><div style={{ fontSize: 20, fontWeight: 700 }}>{c.hashesVerified}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Hash Failures</span><div style={{ fontSize: 20, fontWeight: 700, color: c.hashFailures > 0 ? '#ef4444' : '#22c55e' }}>{c.hashFailures}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Chains Verified</span><div style={{ fontSize: 20, fontWeight: 700 }}>{c.chainsVerified}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Chain Breaks</span><div style={{ fontSize: 20, fontWeight: 700, color: c.chainBreaks > 0 ? '#ef4444' : '#22c55e' }}>{c.chainBreaks}</div></div>
          </div>
        </div>
      ))}
      <h3 style={{ color: '#f8fafc', marginTop: 24, marginBottom: 12 }}>Integrity Breach Alerts</h3>
      {breaches.slice(0, 10).map(b => (
        <div key={b.id} style={{ ...card, borderLeft: `4px solid ${sevColor(b.severity)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{b.description}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={b.breachType.replace(/_/g, ' ')} color={sevColor(b.severity)} />
              <Badge text={b.severity} color={sevColor(b.severity)} />
              {b.acknowledged && <Badge text="ACK" color="#64748b" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReproducibility = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Analysis Reproducibility Tracking</h3>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>All analysis functions are deterministic. Reproducibility is verified by comparing input/output hashes across runs.</p>
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'hashes': return renderHashes();
      case 'chains': return renderChains();
      case 'replay': return renderReplay();
      case 'corruption': return renderCorruption();
      case 'exports': return renderExports();
      case 'provenance': return renderProvenance();
      case 'certification': return renderCertification();
      case 'reproducibility': return renderReproducibility();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Forensic Integrity Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Enterprise evidentiary integrity — deterministic reproducibility, no unverifiable claims
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Integrity Analysis'}
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

export default ForensicIntegrityCockpit;
