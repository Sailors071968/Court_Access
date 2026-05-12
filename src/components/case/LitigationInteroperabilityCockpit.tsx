// ============================================================================
// Phase I.1 — Litigation Interoperability Cockpit
// 8-pane litigation exchange dashboard.
// Prepares interoperable litigation materials.
// NEVER autonomously interacts with courts.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface InteropProps {
  caseId: string;
}

interface PackageEntry { id: string; packageType: string; exportFormat: string; totalRecords: number; contentHash: string; status: string; }
interface DocumentEntry { id: string; documentType: string; title: string; courtFormat: string; complianceStatus: string; citationCount: number; }
interface ManifestEntry { id: string; totalItems: number; recipientType: string; status: string; integrityHash: string; }
interface VerificationEntry { id: string; packageId: string; hashMatch: boolean; countMatch: boolean; verificationMethod: string; }
interface CustodyEntry { id: string; evidenceId: string; totalTransfers: number; chainComplete: boolean; gapDetected: boolean; }
interface ExportEntry { id: string; sourceLayer: string; exportFormat: string; recordCount: number; formatCompliance: string; }
interface BundleEntry { id: string; bundleType: string; totalExhibits: number; validatedExhibits: number; failedExhibits: number; sequenceValid: boolean; }
interface ArchiveEntry { id: string; archiveType: string; totalRecords: number; archiveStatus: string; compressionMethod: string; }

type PaneName = 'manifests' | 'verification' | 'exhibits' | 'custody' | 'archives' | 'interop' | 'provenance' | 'external';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'manifests', label: 'Export Manifests' },
  { key: 'verification', label: 'Package Verification' },
  { key: 'exhibits', label: 'Exhibit Bundles' },
  { key: 'custody', label: 'Chain-of-Custody' },
  { key: 'archives', label: 'Archive Integrity' },
  { key: 'interop', label: 'Interop Validation' },
  { key: 'provenance', label: 'Provenance Manifests' },
  { key: 'external', label: 'External Verification' },
];

const statusColor = (s: string) => s === 'completed' || s === 'verified' || s === 'sealed' || s === 'compliant' || s === 'finalized' ? '#22c55e' :
  s === 'generating' || s === 'draft' || s === 'needs_review' ? '#f59e0b' :
  s === 'failed' || s === 'non_compliant' || s === 'expired' ? '#ef4444' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const LitigationInteroperabilityCockpit: React.FC<InteropProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('manifests');
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [manifests, setManifests] = useState<ManifestEntry[]>([]);
  const [verifications, setVerifications] = useState<VerificationEntry[]>([]);
  const [custody, setCustody] = useState<CustodyEntry[]>([]);
  const [exports, setExports] = useState<ExportEntry[]>([]);
  const [bundles, setBundles] = useState<BundleEntry[]>([]);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, m, v, c, e, b, a] = await Promise.all([
        fetch(`/api/interop/packages/${caseId}`).then(r => r.json()).catch(() => ({ packages: [] })),
        fetch(`/api/interop/documents/${caseId}`).then(r => r.json()).catch(() => ({ documents: [] })),
        fetch(`/api/interop/manifests/${caseId}`).then(r => r.json()).catch(() => ({ manifests: [] })),
        fetch(`/api/interop/verification/${caseId}`).then(r => r.json()).catch(() => ({ verifications: [] })),
        fetch(`/api/interop/custody/${caseId}`).then(r => r.json()).catch(() => ({ chains: [] })),
        fetch(`/api/interop/formats/${caseId}`).then(r => r.json()).catch(() => ({ exports: [] })),
        fetch(`/api/interop/exhibits/${caseId}`).then(r => r.json()).catch(() => ({ bundles: [] })),
        fetch(`/api/interop/archives/${caseId}`).then(r => r.json()).catch(() => ({ archives: [] })),
      ]);
      setPackages(p.packages || []); setDocuments(d.documents || []); setManifests(m.manifests || []);
      setVerifications(v.verifications || []); setCustody(c.chains || []); setExports(e.exports || []);
      setBundles(b.bundles || []); setArchives(a.archives || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/interop/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderManifests = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Export Packages & Interchange Manifests</h3>
      {packages.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{p.packageType.replace(/_/g, ' ')} — {p.totalRecords} records</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={p.exportFormat} color="#7c3aed" />
              <Badge text={p.status} color={statusColor(p.status)} />
            </div>
          </div>
        </div>
      ))}
      <h4 style={{ color: '#94a3b8', marginTop: 16 }}>Interchange Manifests</h4>
      {manifests.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.integrityHash.slice(0, 24)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={m.recipientType} color="#7c3aed" />
              <Badge text={`${m.totalItems} items`} color="#64748b" />
              <Badge text={m.status} color={statusColor(m.status)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderVerification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Package Verification</h3>
      {verifications.map(v => (
        <div key={v.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{v.verificationMethod.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={v.hashMatch ? 'HASH MATCH' : 'HASH MISMATCH'} color={v.hashMatch ? '#22c55e' : '#ef4444'} />
              <Badge text={v.countMatch ? 'COUNT MATCH' : 'COUNT MISMATCH'} color={v.countMatch ? '#22c55e' : '#ef4444'} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderExhibits = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Exhibit Bundle Validation</h3>
      {bundles.map(b => (
        <div key={b.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{b.bundleType} bundle</span>
            <Badge text={b.sequenceValid ? 'SEQUENCE VALID' : 'SEQUENCE ERROR'} color={b.sequenceValid ? '#22c55e' : '#ef4444'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Total</span><div style={{ fontSize: 18, fontWeight: 700 }}>{b.totalExhibits}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Validated</span><div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{b.validatedExhibits}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ fontSize: 18, fontWeight: 700, color: b.failedExhibits > 0 ? '#ef4444' : '#22c55e' }}>{b.failedExhibits}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCustody = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Chain-of-Custody Exports</h3>
      {custody.map(c => (
        <div key={c.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{c.totalTransfers} transfers</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={c.chainComplete ? 'COMPLETE' : 'INCOMPLETE'} color={c.chainComplete ? '#22c55e' : '#f59e0b'} />
              {c.gapDetected && <Badge text="GAP DETECTED" color="#ef4444" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderArchives = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Litigation Archives</h3>
      {archives.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{a.archiveType.replace(/_/g, ' ')} — {a.totalRecords} records</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={a.compressionMethod} color="#7c3aed" />
              <Badge text={a.archiveStatus} color={statusColor(a.archiveStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderInterop = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Multi-Format Exports & Court Documents</h3>
      {documents.map(d => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{d.title}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={d.courtFormat.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={d.complianceStatus} color={statusColor(d.complianceStatus)} />
              <Badge text={`${d.citationCount} citations`} color="#64748b" />
            </div>
          </div>
        </div>
      ))}
      <h4 style={{ color: '#94a3b8', marginTop: 16 }}>Format Exports</h4>
      {exports.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{e.sourceLayer} — {e.recordCount} records</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.exportFormat} color="#7c3aed" />
              <Badge text={e.formatCompliance} color={statusColor(e.formatCompliance === 'valid' ? 'compliant' : e.formatCompliance)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderProvenance = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Export Provenance Manifests</h3>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>Every export has a deterministic provenance chain tracking all transformation steps from origin to final output.</p>
    </div>
  );

  const renderExternal = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>External Integrity Verification</h3>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>All export packages and exhibit bundles are verified via automated integrity checks including hash verification, record counts, format compliance, and citation preservation.</p>
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'manifests': return renderManifests();
      case 'verification': return renderVerification();
      case 'exhibits': return renderExhibits();
      case 'custody': return renderCustody();
      case 'archives': return renderArchives();
      case 'interop': return renderInterop();
      case 'provenance': return renderProvenance();
      case 'external': return renderExternal();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Litigation Interoperability Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Evidentiary interchange — no autonomous court interaction
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Generating...' : 'Generate Interoperability Package'}
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

export default LitigationInteroperabilityCockpit;
