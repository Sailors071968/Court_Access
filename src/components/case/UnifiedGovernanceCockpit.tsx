// ============================================================================
// Phase M.1 — Unified Governance & Release Cockpit
// 8-pane transparent governance dashboard.
// No hidden overrides — no opaque centralized control.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface GovProps {
  caseId: string;
}

interface DoctrineEntry { id: string; doctrineName: string; doctrineVersion: string; doctrineStatus: string; rulesCount: number; rulesEnforced: number; }
interface ReleaseEntry { id: string; releaseVersion: string; releaseType: string; releaseStatus: string; approvalSteps: number; stepsCompleted: number; }
interface FeatureEntry { id: string; featureName: string; featureScope: string; permissionRequired: string; enablementStatus: string; }
interface PolicyEntry { id: string; policyDomain: string; policiesTotal: number; policiesHarmonized: number; conflictsDetected: number; harmonizationStatus: string; }
interface AdminEntry { id: string; actionType: string; actionPerformedBy: string; certificationStatus: string; justification: string; }
interface StewardEntry { id: string; stewardshipArea: string; stewardStatus: string; healthScore: number; issuesOpen: number; issuesResolved: number; }
interface SyncEntry { id: string; sourceGovernance: string; targetGovernance: string; syncStatus: string; hashesMatch: boolean; }
interface LineageEntry { id: string; doctrineName: string; lineageVersion: string; changeType: string; changeJustification: string; }

type PaneName = 'doctrine' | 'releases' | 'features' | 'policies' | 'admin' | 'stewardship' | 'sync' | 'lineage';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'doctrine', label: 'Operational Doctrine' },
  { key: 'releases', label: 'Release Governance' },
  { key: 'features', label: 'Feature Enablement' },
  { key: 'policies', label: 'Policy Harmonization' },
  { key: 'admin', label: 'Admin Certification' },
  { key: 'stewardship', label: 'Stewardship Tracking' },
  { key: 'sync', label: 'Governance Sync' },
  { key: 'lineage', label: 'Doctrine Lineage' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'active' || s === 'approved' || s === 'enabled' || s === 'harmonized' || s === 'certified' || s === 'synchronized' || s === 'passed' || s === 'creation' || s === true ? '#22c55e' :
  s === 'draft' || s === 'proposed' || s === 'pending_approval' || s === 'in_progress' || s === 'pending' || s === 'review_required' ? '#f59e0b' :
  s === 'archived' || s === 'rejected' || s === 'disabled' || s === 'conflicts_detected' || s === 'revoked' || s === 'desynchronized' || s === 'failed' || s === false ? '#ef4444' :
  s === 'superseded' || s === 'rolled_back' || s === 'restricted' || s === 'escalated' || s === 'amendment' || s === 'supersession' ? '#7c3aed' : '#64748b';

export const UnifiedGovernanceCockpit: React.FC<GovProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('doctrine');
  const [loading, setLoading] = useState(false);
  const [doctrines, setDoctrines] = useState<DoctrineEntry[]>([]);
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [policies, setPolicies] = useState<PolicyEntry[]>([]);
  const [adminActions, setAdminActions] = useState<AdminEntry[]>([]);
  const [stewardship, setStewardship] = useState<StewardEntry[]>([]);
  const [syncs, setSyncs] = useState<SyncEntry[]>([]);
  const [lineages, setLineages] = useState<LineageEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r, f, p, a, s, sy, l] = await Promise.all([
        fetch(`/api/governance-m1/doctrine/${caseId}`).then(r => r.json()).catch(() => ({ doctrines: [] })),
        fetch(`/api/governance-m1/releases/${caseId}`).then(r => r.json()).catch(() => ({ releases: [] })),
        fetch(`/api/governance-m1/features/${caseId}`).then(r => r.json()).catch(() => ({ features: [] })),
        fetch(`/api/governance-m1/policies/${caseId}`).then(r => r.json()).catch(() => ({ policies: [] })),
        fetch(`/api/governance-m1/admin-actions/${caseId}`).then(r => r.json()).catch(() => ({ actions: [] })),
        fetch(`/api/governance-m1/stewardship/${caseId}`).then(r => r.json()).catch(() => ({ stewardship: [] })),
        fetch(`/api/governance-m1/sync/${caseId}`).then(r => r.json()).catch(() => ({ syncs: [] })),
        fetch(`/api/governance-m1/lineage/${caseId}`).then(r => r.json()).catch(() => ({ lineages: [] })),
      ]);
      setDoctrines(d.doctrines || []); setReleases(r.releases || []); setFeatures(f.features || []);
      setPolicies(p.policies || []); setAdminActions(a.actions || []);
      setStewardship(s.stewardship || []); setSyncs(sy.syncs || []); setLineages(l.lineages || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/governance-m1/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderDoctrine = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Doctrine</h3>
      {doctrines.map(d => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.doctrineName.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`v${d.doctrineVersion}`} color="#3b82f6" />
              <Badge text={d.doctrineStatus} color={sc(d.doctrineStatus)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Rules: {d.rulesEnforced}/{d.rulesCount} enforced</div>
        </div>
      ))}
    </div>
  );

  const renderReleases = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Release Governance</h3>
      {releases.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>v{r.releaseVersion}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.releaseType} color="#7c3aed" />
              <Badge text={r.releaseStatus} color={sc(r.releaseStatus)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Approvals: {r.stepsCompleted}/{r.approvalSteps}</div>
        </div>
      ))}
    </div>
  );

  const renderFeatures = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Feature Enablement</h3>
      {features.map(f => (
        <div key={f.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{f.featureName.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={f.featureScope.replace(/_/g, ' ')} color="#3b82f6" />
              <Badge text={f.permissionRequired} color="#7c3aed" />
              <Badge text={f.enablementStatus} color={sc(f.enablementStatus)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPolicies = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Policy Harmonization</h3>
      {policies.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.policyDomain.replace(/_/g, ' ')}</span>
            <Badge text={p.harmonizationStatus.replace(/_/g, ' ')} color={sc(p.harmonizationStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Total</span><div style={{ fontWeight: 700 }}>{p.policiesTotal}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Harmonized</span><div style={{ fontWeight: 700 }}>{p.policiesHarmonized}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Conflicts</span><div style={{ fontWeight: 700, color: p.conflictsDetected > 0 ? '#ef4444' : '#22c55e' }}>{p.conflictsDetected}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAdmin = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Administrative Certification</h3>
      {adminActions.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{a.actionType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={a.actionPerformedBy} color="#3b82f6" />
              <Badge text={a.certificationStatus} color={sc(a.certificationStatus)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.justification}</div>
        </div>
      ))}
    </div>
  );

  const renderStewardship = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Stewardship Tracking</h3>
      {stewardship.map(s => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.stewardshipArea.replace(/_/g, ' ')}</span>
            <Badge text={s.stewardStatus.replace(/_/g, ' ')} color={sc(s.stewardStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Health</span><div style={{ fontWeight: 700, color: s.healthScore >= 99.5 ? '#22c55e' : '#f59e0b' }}>{s.healthScore}%</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Open</span><div style={{ fontWeight: 700 }}>{s.issuesOpen}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Resolved</span><div style={{ fontWeight: 700 }}>{s.issuesResolved}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSync = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Governance Synchronization</h3>
      {syncs.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${sc(s.hashesMatch)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{s.sourceGovernance} → {s.targetGovernance}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={s.syncStatus} color={sc(s.syncStatus)} />
              <Badge text={s.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(s.hashesMatch)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLineage = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Doctrine Lineage</h3>
      {lineages.map(l => (
        <div key={l.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{l.doctrineName.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`v${l.lineageVersion}`} color="#3b82f6" />
              <Badge text={l.changeType} color={sc(l.changeType)} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{l.changeJustification}</div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'doctrine': return renderDoctrine();
      case 'releases': return renderReleases();
      case 'features': return renderFeatures();
      case 'policies': return renderPolicies();
      case 'admin': return renderAdmin();
      case 'stewardship': return renderStewardship();
      case 'sync': return renderSync();
      case 'lineage': return renderLineage();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Unified Governance & Release Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Transparent governance — deterministic release stewardship
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Governance Analysis'}
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

export default UnifiedGovernanceCockpit;
