// ============================================================================
// Phase H.3 — Enterprise Operations Cockpit
// 8-pane distributed reliability dashboard.
// Scales deterministically and recovers reproducibly.
// NEVER sacrifices evidentiary integrity for throughput.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface OpsProps {
  caseId: string;
}

interface JobEntry { id: string; jobType: string; workerNode: string; status: string; priority: number; executionDuration: number | null; }
interface QueueEntry { id: string; queueName: string; integrityStatus: string; queueDepth: number; totalProcessed: number; totalFailed: number; }
interface CheckpointEntry { id: string; componentName: string; checkpointType: string; stateHash: string; restoredCount: number; }
interface ReplayEntry { id: string; replayScope: string; workerNode: string; hashConsistent: boolean; recordsReplayed: number; }
interface BatchEntry { id: string; batchNumber: number; totalStatements: number; processedStatements: number; batchStatus: string; processingRate: number; }
interface TelemetryEntry { id: string; componentName: string; metricType: string; metricValue: number; healthStatus: string; exceededThreshold: boolean; }
interface IsolationEntry { id: string; originComponent: string; failureType: string; cascadeDepth: number; isolationStatus: string; isolationMethod: string; }
interface MetricEntry { id: string; metricName: string; metricValue: number; metricUnit: string; targetMet: boolean; trendDirection: string; }

type PaneName = 'workers' | 'queues' | 'checkpoints' | 'replay' | 'batching' | 'telemetry' | 'isolation' | 'survivability';

const PANES: Array<{ key: PaneName; label: string }> = [
  { key: 'workers', label: 'Distributed Workers' },
  { key: 'queues', label: 'Queue Integrity' },
  { key: 'checkpoints', label: 'Recovery Checkpoints' },
  { key: 'replay', label: 'Replay Consistency' },
  { key: 'batching', label: 'Ingestion Survivability' },
  { key: 'telemetry', label: 'Operational Telemetry' },
  { key: 'isolation', label: 'Failure Isolation' },
  { key: 'survivability', label: 'System Reproducibility' },
];

const statusColor = (s: string) => s === 'completed' || s === 'healthy' || s === 'certified' || s === 'contained' || s === 'synchronized' ? '#22c55e' :
  s === 'running' || s === 'processing' || s === 'warning' || s === 'degraded' ? '#f59e0b' :
  s === 'failed' || s === 'corrupted' || s === 'critical' || s === 'propagating' ? '#ef4444' : '#64748b';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{text}</span>
);

export const EnterpriseOperationsCockpit: React.FC<OpsProps> = ({ caseId }) => {
  const [activePane, setActivePane] = useState<PaneName>('workers');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [queues, setQueues] = useState<QueueEntry[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointEntry[]>([]);
  const [replays, setReplays] = useState<ReplayEntry[]>([]);
  const [batches, setBatches] = useState<BatchEntry[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [isolations, setIsolations] = useState<IsolationEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [j, q, cp, r, b, t, iso, m] = await Promise.all([
        fetch(`/api/scalability/jobs/${caseId}`).then(r => r.json()).catch(() => ({ jobs: [] })),
        fetch(`/api/scalability/queues/${caseId}`).then(r => r.json()).catch(() => ({ queues: [] })),
        fetch(`/api/scalability/checkpoints/${caseId}`).then(r => r.json()).catch(() => ({ checkpoints: [] })),
        fetch(`/api/scalability/replays/${caseId}`).then(r => r.json()).catch(() => ({ replays: [] })),
        fetch(`/api/scalability/batches/${caseId}`).then(r => r.json()).catch(() => ({ batches: [] })),
        fetch(`/api/scalability/telemetry/${caseId}`).then(r => r.json()).catch(() => ({ telemetry: [] })),
        fetch(`/api/scalability/isolations/${caseId}`).then(r => r.json()).catch(() => ({ isolations: [] })),
        fetch(`/api/scalability/metrics/${caseId}`).then(r => r.json()).catch(() => ({ metrics: [] })),
      ]);
      setJobs(j.jobs || []); setQueues(q.queues || []); setCheckpoints(cp.checkpoints || []);
      setReplays(r.replays || []); setBatches(b.batches || []); setTelemetry(t.telemetry || []);
      setIsolations(iso.isolations || []); setMetrics(m.metrics || []);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`/api/scalability/analyze/${caseId}`, { method: 'POST' });
      await fetchData();
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #334155' };

  const renderWorkers = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Distributed Job Orchestration</h3>
      {jobs.slice(0, 20).map(j => (
        <div key={j.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{j.jobType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={j.status} color={statusColor(j.status)} />
              <Badge text={`P${j.priority}`} color="#7c3aed" />
              {j.executionDuration && <Badge text={`${j.executionDuration}ms`} color="#64748b" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderQueues = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Queue Integrity Verification</h3>
      {queues.map(q => (
        <div key={q.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{q.queueName.replace(/_/g, ' ')}</span>
            <Badge text={q.integrityStatus} color={statusColor(q.integrityStatus)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Depth</span><div style={{ fontSize: 18, fontWeight: 700 }}>{q.queueDepth}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Processed</span><div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{q.totalProcessed}</div></div>
            <div><span style={{ color: '#64748b', fontSize: 12 }}>Failed</span><div style={{ fontSize: 18, fontWeight: 700, color: q.totalFailed > 0 ? '#ef4444' : '#22c55e' }}>{q.totalFailed}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCheckpoints = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Recovery Checkpoints</h3>
      {checkpoints.map(cp => (
        <div key={cp.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{cp.stateHash.slice(0, 24)}...</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={cp.componentName.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={cp.checkpointType} color="#3b82f6" />
              {cp.restoredCount > 0 && <Badge text={`Restored ${cp.restoredCount}x`} color="#f59e0b" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderReplay = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Distributed Replay Consistency</h3>
      {replays.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.replayScope.replace(/_/g, ' ')} — {r.recordsReplayed} records</span>
            <Badge text={r.hashConsistent ? 'CONSISTENT' : 'INCONSISTENT'} color={r.hashConsistent ? '#22c55e' : '#ef4444'} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderBatching = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>High-Volume Evidence Batching</h3>
      {batches.map(b => (
        <div key={b.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Batch #{b.batchNumber}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={b.batchStatus} color={statusColor(b.batchStatus)} />
              <Badge text={`${b.processingRate.toFixed(1)} stmt/s`} color="#64748b" />
            </div>
          </div>
          <div style={{ background: '#334155', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{ background: '#22c55e', height: '100%', width: `${b.totalStatements > 0 ? (b.processedStatements / b.totalStatements) * 100 : 0}%` }} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{b.processedStatements}/{b.totalStatements} processed</div>
        </div>
      ))}
    </div>
  );

  const renderTelemetry = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Operational Health Telemetry</h3>
      {telemetry.slice(0, 18).map(t => (
        <div key={t.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t.componentName.replace(/_/g, ' ')} — {t.metricType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={`${t.metricValue.toFixed(1)}`} color="#7c3aed" />
              <Badge text={t.healthStatus} color={statusColor(t.healthStatus)} />
              {t.exceededThreshold && <Badge text="THRESHOLD" color="#ef4444" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderIsolation = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>Failure Cascade Isolation</h3>
      {isolations.map(i => (
        <div key={i.id} style={{ ...card, borderLeft: `4px solid ${statusColor(i.isolationStatus)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{i.originComponent.replace(/_/g, ' ')} — {i.failureType.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={i.isolationMethod.replace(/_/g, ' ')} color="#7c3aed" />
              <Badge text={i.isolationStatus} color={statusColor(i.isolationStatus)} />
              <Badge text={`Depth ${i.cascadeDepth}`} color="#64748b" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSurvivability = () => (
    <div>
      <h3 style={{ color: '#f8fafc', marginBottom: 12 }}>System Survivability Metrics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {metrics.map(m => (
          <div key={m.id} style={card}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>{m.metricName.replace(/_/g, ' ')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>{m.metricValue.toFixed(1)}<span style={{ fontSize: 14, color: '#64748b' }}> {m.metricUnit}</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge text={m.targetMet ? 'TARGET MET' : 'BELOW TARGET'} color={m.targetMet ? '#22c55e' : '#ef4444'} />
              <Badge text={m.trendDirection} color={m.trendDirection === 'improving' ? '#22c55e' : m.trendDirection === 'stable' ? '#3b82f6' : '#f59e0b'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderActive = () => {
    switch (activePane) {
      case 'workers': return renderWorkers();
      case 'queues': return renderQueues();
      case 'checkpoints': return renderCheckpoints();
      case 'replay': return renderReplay();
      case 'batching': return renderBatching();
      case 'telemetry': return renderTelemetry();
      case 'isolation': return renderIsolation();
      case 'survivability': return renderSurvivability();
      default: return null;
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Enterprise Operations Cockpit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Distributed reliability — deterministic scaling, reproducible recovery
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{
          padding: '10px 20px', background: loading ? '#475569' : '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
        }}>
          {loading ? 'Analyzing...' : 'Run Scalability Analysis'}
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

export default EnterpriseOperationsCockpit;
