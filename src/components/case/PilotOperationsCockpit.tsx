// ============================================================================
// Phase N.3 — Pilot Operations Cockpit
// 8-pane real-world operational validation dashboard.
// Controlled operationalization. No speculative expansion.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface PilotProps {
  caseId: string;
}

interface ReplayEntry { id: string; historicalCaseRef: string; caseType: string; replayStatus: string; outputMatchBaseline: boolean; contradictionsFound: number; burdensFound: number; }
interface TelemetryEntry { id: string; sessionId: string; workflowName: string; actionCount: number; sessionDurationMs: number; frictionEvents: number; completionRate: number; }
interface FrictionEntry { id: string; workflowStep: string; frictionType: string; severityLevel: string; resolved: boolean; }
interface ExportEntry { id: string; exportType: string; hashesMatch: boolean; exportSize: number; validationStatus: string; }
interface DrillEntry { id: string; drillType: string; drillStatus: string; recoveryTimeMs: number; dataIntegrityVerified: boolean; servicesContinued: boolean; }
interface RollbackEntry { id: string; rollbackScope: string; rollbackSteps: number; stepsCompleted: number; rollbackStatus: string; dataPreserved: boolean; }
interface IssueEntry { id: string; issueType: string; issueSeverity: string; issueStatus: string; affectedWorkflow: string; }
interface CertEntry { id: string; certificationArea: string; certified: boolean; certifiedBy: string | null; }

type PaneName = 'replay' | 'telemetry' | 'friction' | 'exports' | 'drills' | 'rollbacks' | 'issues' | 'certification';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'replay', label: 'Historical Replay' },
  { key: 'telemetry', label: 'Attorney Telemetry' },
  { key: 'friction', label: 'Usability Friction' },
  { key: 'exports', label: 'Export Verification' },
  { key: 'drills', label: 'Survivability Drills' },
  { key: 'rollbacks', label: 'Rollback Rehearsals' },
  { key: 'issues', label: 'Issue Triage' },
  { key: 'certification', label: 'Pilot Certification' },
];

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

const sc = (s: string | boolean) =>
  s === 'passed' || s === 'completed' || s === 'resolved' || s === 'valid' || s === true ? '#22c55e' :
  s === 'investigating' || s === 'partial' || s === 'medium' ? '#f59e0b' :
  s === 'failed' || s === 'critical' || s === false ? '#ef4444' : '#64748b';

export const PilotOperationsCockpit: React.FC<PilotProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('replay');
  const [loading, setLoading] = useState(false);
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [friction, setFriction] = useState<FrictionEntry[]>([]);
  const [exports, setExports] = useState<ExportEntry[]>([]);
  const [drills, setDrills] = useState<DrillEntry[]>([]);
  const [rollbacks, setRollbacks] = useState<RollbackEntry[]>([]);
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [certs, setCerts] = useState<CertEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rp, tl, fr, ex, dr, rb, is_, ce] = await Promise.all([
        fetch(`/api/pilot/replay/${caseId}`).then(r => r.json()).catch(() => ({ replays: [] })),
        fetch(`/api/pilot/telemetry/${caseId}`).then(r => r.json()).catch(() => ({ telemetry: [] })),
        fetch(`/api/pilot/friction/${caseId}`).then(r => r.json()).catch(() => ({ friction: [] })),
        fetch(`/api/pilot/exports/${caseId}`).then(r => r.json()).catch(() => ({ exports: [] })),
        fetch(`/api/pilot/drills/${caseId}`).then(r => r.json()).catch(() => ({ drills: [] })),
        fetch(`/api/pilot/rollbacks/${caseId}`).then(r => r.json()).catch(() => ({ rollbacks: [] })),
        fetch(`/api/pilot/issues/${caseId}`).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(`/api/pilot/certification/${caseId}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      ]);
      setReplays(rp.replays || []); setTelemetry(tl.telemetry || []);
      setFriction(fr.friction || []); setExports(ex.exports || []);
      setDrills(dr.drills || []); setRollbacks(rb.rollbacks || []);
      setIssues(is_.issues || []); setCerts(ce.certifications || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/pilot/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderReplay = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Historical-Case Replay Pilots</h3>
      {replays.map(r => (
        <div key={r.id} style={{ ...card, borderLeft: `4px solid ${sc(r.outputMatchBaseline)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.historicalCaseRef}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={r.caseType.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={r.replayStatus} color={sc(r.replayStatus)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Contradictions</span><div style={{ fontWeight: 700, color: '#f59e0b' }}>{r.contradictionsFound}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Burdens</span><div style={{ fontWeight: 700, color: '#ef4444' }}>{r.burdensFound}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Baseline Match</span><div style={{ fontWeight: 700, color: sc(r.outputMatchBaseline) }}>{r.outputMatchBaseline ? 'YES' : 'NO'}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTelemetry = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Attorney Workflow Telemetry</h3>
      {telemetry.map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{t.workflowName.replace(/_/g, ' ')}</span>
            <Badge text={`${Math.round(t.completionRate * 100)}% complete`} color={t.completionRate >= 0.95 ? '#22c55e' : '#f59e0b'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Actions</span><div style={{ fontWeight: 700 }}>{t.actionCount}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Duration</span><div style={{ fontWeight: 700 }}>{Math.round(t.sessionDurationMs / 1000)}s</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Friction</span><div style={{ fontWeight: 700, color: t.frictionEvents > 0 ? '#f59e0b' : '#22c55e' }}>{t.frictionEvents}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Rate</span><div style={{ fontWeight: 700, color: t.completionRate >= 0.95 ? '#22c55e' : '#f59e0b' }}>{Math.round(t.completionRate * 100)}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFriction = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Usability Friction Tracking</h3>
      {friction.map(f => (
        <div key={f.id} style={{ ...card, borderLeft: `4px solid ${sc(f.severityLevel === 'critical' ? false : f.severityLevel === 'high' ? false : true)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{f.workflowStep.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={f.frictionType.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={f.severityLevel} color={sc(f.severityLevel)} />
              <Badge text={f.resolved ? 'RESOLVED' : 'OPEN'} color={sc(f.resolved)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderExports = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Export Verification</h3>
      {exports.map(e => (
        <div key={e.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{e.exportType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={e.hashesMatch ? 'MATCH' : 'MISMATCH'} color={sc(e.hashesMatch)} />
              <Badge text={e.validationStatus} color={sc(e.validationStatus)} />
            </div>
          </div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Size: </span><span style={{ fontWeight: 700 }}>{(e.exportSize / 1024 / 1024).toFixed(2)} MB</span></div>
        </div>
      ))}
    </div>
  );

  const renderDrills = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Survivability Drills</h3>
      {drills.map(d => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{d.drillType.replace(/_/g, ' ')}</span>
            <Badge text={d.drillStatus} color={sc(d.drillStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Recovery</span><div style={{ fontWeight: 700 }}>{d.recoveryTimeMs}ms</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Integrity</span><div style={{ fontWeight: 700, color: sc(d.dataIntegrityVerified) }}>{d.dataIntegrityVerified ? 'YES' : 'NO'}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Continued</span><div style={{ fontWeight: 700, color: sc(d.servicesContinued) }}>{d.servicesContinued ? 'YES' : 'NO'}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRollbacks = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Rollback Rehearsals</h3>
      {rollbacks.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{r.rollbackScope.replace(/_/g, ' ')}</span>
            <Badge text={r.rollbackStatus} color={sc(r.rollbackStatus)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Steps</span><div style={{ fontWeight: 700 }}>{r.stepsCompleted}/{r.rollbackSteps}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Data Preserved</span><div style={{ fontWeight: 700, color: sc(r.dataPreserved) }}>{r.dataPreserved ? 'YES' : 'NO'}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderIssues = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Issue Triage</h3>
      {issues.map(i => (
        <div key={i.id} style={{ ...card, borderLeft: `4px solid ${sc(i.issueStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{i.issueType}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={i.issueSeverity} color={sc(i.issueSeverity)} />
              <Badge text={i.issueStatus} color={sc(i.issueStatus)} />
            </div>
          </div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Workflow: </span><span>{i.affectedWorkflow}</span></div>
        </div>
      ))}
    </div>
  );

  const renderCertification = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Pilot Certification</h3>
      {certs.map(c => (
        <div key={c.id} style={{ ...card, borderLeft: `4px solid ${sc(c.certified)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>{c.certificationArea.replace(/_/g, ' ')}</span>
            <Badge text={c.certified ? 'CERTIFIED' : 'PENDING'} color={sc(c.certified)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'replay': return renderReplay();
      case 'telemetry': return renderTelemetry();
      case 'friction': return renderFriction();
      case 'exports': return renderExports();
      case 'drills': return renderDrills();
      case 'rollbacks': return renderRollbacks();
      case 'issues': return renderIssues();
      case 'certification': return renderCertification();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Pilot Operations Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Controlled pilot deployment + real-world operational validation
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Running Pilots...' : 'Run Pilot Analysis'}
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

export default PilotOperationsCockpit;
