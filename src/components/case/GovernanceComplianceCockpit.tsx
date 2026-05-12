// ============================================================================
// Phase I.2 — Governance & Compliance Cockpit
// 8-pane institutional trust dashboard.
// Transparent, auditable governance — no opaque control systems.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface GovProps {
  caseId: string;
}

interface PolicyEntry { id: string; policyName: string; policyType: string; enforcementLevel: string; scope: string; isActive: boolean; }
interface AuditEntry { id: string; userId: string; userRole: string; action: string; resource: string; resourceType: string; }
interface WorkflowEntry { id: string; workflowType: string; workflowStatus: string; checksPassed: number; checksFailed: number; }
interface SafeguardEntry { id: string; safeguardName: string; safeguardType: string; enforcementResult: string; triggerContext: string; }
interface AccountEntry { id: string; actorId: string; actorRole: string; operationType: string; outcomeStatus: string; impactLevel: string; }
interface ReportEntry { id: string; reportType: string; complianceScore: number; totalActions: number; totalViolations: number; }
interface ExceptionEntry { id: string; exceptionType: string; requestedBy: string; exceptionStatus: string; justification: string; }
interface VersionEntry { id: string; policyId: string; versionNumber: number; changeType: string; contentHash: string; }

type PaneName = 'policies' | 'audits' | 'compliance' | 'safeguards' | 'accountability' | 'oversight' | 'exceptions' | 'versioning';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'policies', label: 'Governance Policies' },
  { key: 'audits', label: 'Permission Audits' },
  { key: 'compliance', label: 'Compliance Workflows' },
  { key: 'safeguards', label: 'Safeguard Enforcement' },
  { key: 'accountability', label: 'Accountability Logs' },
  { key: 'oversight', label: 'Oversight Reporting' },
  { key: 'exceptions', label: 'Exception Tracking' },
  { key: 'versioning', label: 'Policy Versioning' },
];

const statusColor = (s: string) => s === 'enforced' || s === 'passed' || s === 'certified' || s === 'success' || s === 'approved' ? '#22c55e' :
  s === 'pending' || s === 'in_progress' || s === 'requested' || s === 'conditional' ? '#f59e0b' :
  s === 'violation_detected' || s === 'failed' || s === 'denied' || s === 'revoked' ? '#ef4444' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const GovernanceComplianceCockpit: React.FC<GovProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('policies');
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<PolicyEntry[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowEntry[]>([]);
  const [safeguards, setSafeguards] = useState<SafeguardEntry[]>([]);
  const [accountability, setAccountability] = useState<AccountEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionEntry[]>([]);
  const [versions, setVersions] = useState<VersionEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, w, s, ac, r, e, v] = await Promise.all([
        fetch(`/api/governance/policies/${caseId}`).then(r => r.json()).catch(() => ({ policies: [] })),
        fetch(`/api/governance/audits/${caseId}`).then(r => r.json()).catch(() => ({ audits: [] })),
        fetch(`/api/governance/compliance/${caseId}`).then(r => r.json()).catch(() => ({ workflows: [] })),
        fetch(`/api/governance/safeguards/${caseId}`).then(r => r.json()).catch(() => ({ safeguards: [] })),
        fetch(`/api/governance/accountability/${caseId}`).then(r => r.json()).catch(() => ({ logs: [] })),
        fetch(`/api/governance/oversight/${caseId}`).then(r => r.json()).catch(() => ({ reports: [] })),
        fetch(`/api/governance/exceptions/${caseId}`).then(r => r.json()).catch(() => ({ exceptions: [] })),
        fetch(`/api/governance/versions/${caseId}`).then(r => r.json()).catch(() => ({ versions: [] })),
      ]);
      setPolicies(p.policies || []); setAudits(a.audits || []); setWorkflows(w.workflows || []);
      setSafeguards(s.safeguards || []); setAccountability(ac.logs || []); setReports(r.reports || []);
      setExceptions(e.exceptions || []); setVersions(v.versions || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/governance/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderPolicies = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Governance Policies</h3>
      {policies.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{p.policyName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={p.enforcementLevel} color={p.enforcementLevel === 'mandatory' ? '#ef4444' : '#f59e0b'} />
              <Badge text={p.scope.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={p.isActive ? 'ACTIVE' : 'INACTIVE'} color={p.isActive ? '#22c55e' : '#64748b'} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAudits = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Permission Audit Trail</h3>
      {audits.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{a.resource} ({a.resourceType})</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={a.userRole} color="#7c3aed" />
              <Badge text={a.action.replace(/_/g, ' ')} color={statusColor(a.action === 'access_denied' ? 'failed' : 'success')} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompliance = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Compliance Verification Workflows</h3>
      {workflows.map(w => (
        <div key={w.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{w.workflowType.replace(/_/g, ' ')}</span>
            <Badge text={w.workflowStatus} color={statusColor(w.workflowStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Passed</span><div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{w.checksPassed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ fontSize: 18, fontWeight: 700, color: w.checksFailed > 0 ? '#ef4444' : '#22c55e' }}>{w.checksFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSafeguards = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Ethical Safeguard Enforcement</h3>
      {safeguards.map(s => (
        <div key={s.id} style={{ ...card, borderLeft: `4px solid ${statusColor(s.enforcementResult)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{s.safeguardName}</span>
            <Badge text={s.enforcementResult.replace(/_/g, ' ')} color={statusColor(s.enforcementResult)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderAccountability = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Accountability</h3>
      {accountability.map(a => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{a.operationType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={a.actorRole} color="#7c3aed" />
              <Badge text={a.outcomeStatus} color={statusColor(a.outcomeStatus)} />
              <Badge text={a.impactLevel} color={a.impactLevel === 'high' ? '#ef4444' : a.impactLevel === 'medium' ? '#f59e0b' : '#22c55e'} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderOversight = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Institutional Oversight Reports</h3>
      {reports.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.reportType.replace(/_/g, ' ')}</span>
            <Badge text={`Score: ${r.complianceScore.toFixed(1)}%`} color={r.complianceScore >= 99 ? '#22c55e' : r.complianceScore >= 90 ? '#f59e0b' : '#ef4444'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Actions</span><div style={{ fontSize: 18, fontWeight: 700 }}>{r.totalActions}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Violations</span><div style={{ fontSize: 18, fontWeight: 700, color: r.totalViolations > 0 ? '#ef4444' : '#22c55e' }}>{r.totalViolations}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderExceptions = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Compliance Exception Tracking</h3>
      {exceptions.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{e.exceptionType.replace(/_/g, ' ')} — {e.justification.slice(0, 60)}</span>
            <Badge text={e.exceptionStatus} color={statusColor(e.exceptionStatus)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderVersioning = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Policy Versioning</h3>
      {versions.map(v => (
        <div key={v.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v.contentHash.slice(0, 24)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`v${v.versionNumber}`} color="#7c3aed" />
              <Badge text={v.changeType} color="#3b82f6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'policies': return renderPolicies();
      case 'audits': return renderAudits();
      case 'compliance': return renderCompliance();
      case 'safeguards': return renderSafeguards();
      case 'accountability': return renderAccountability();
      case 'oversight': return renderOversight();
      case 'exceptions': return renderExceptions();
      case 'versioning': return renderVersioning();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Governance & Compliance Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Institutional trust — transparent, auditable governance
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

export default GovernanceComplianceCockpit;
