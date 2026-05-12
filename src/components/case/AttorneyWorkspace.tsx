// ============================================================================
// Phase D.4 — Attorney Intelligence Workspace
// Operational defense-analysis cockpit with 6 panes.
// Displays provable litigation intelligence — never generates legal advice.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceData {
  caseId: string;
  evidencePane: { totalStatements: number; totalDocuments: number };
  calcrimPane: { charges: number; instructions: number; elements: number };
  contradictionPane: { totalContradictions: number; bySeverity: Record<string, number> };
  prosecutorTheoryPane: { totalAttacks: number; byType: Record<string, number> };
  burdenFracturePane: { totalFractures: number; collapseScores: CollapseScore[] };
  timelinePane: { totalIncompatibilities: number };
  defensePane: {
    issues: DefenseIssue[];
    motions: MotionOpportunity[];
    impeachmentPackets: ImpeachmentPacket[];
    reasonableDoubt: ReasonableDoubt[];
  };
}

interface CollapseScore {
  id: string;
  instructionNumber: number;
  collapseScore: number;
  collapseLevel: string;
  totalElements: number;
  unsupportedElements: number;
  contradictedElements: number;
  explanation: string;
}

interface DefenseIssue {
  id: string;
  issueType: string;
  priority: number;
  severity: string;
  title: string;
  description: string;
  defenseAction: string;
  status: string;
}

interface MotionOpportunity {
  id: string;
  motionType: string;
  title: string;
  strength: string;
  legalBasis: string;
  factualBasis: string;
  priority: number;
}

interface ImpeachmentPacket {
  id: string;
  witnessName: string;
  totalInconsistencies: number;
  totalContradictions: number;
  credibilityScore: number;
}

interface ReasonableDoubt {
  id: string;
  doubtCategory: string;
  title: string;
  narrative: string;
  strength: string;
}

type PaneId = 'evidence' | 'calcrim' | 'contradiction' | 'prosecutor' | 'burden' | 'timeline' | 'defense';

// ---------------------------------------------------------------------------
// Severity / Strength badge colors
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d',
};

const STRENGTH_COLORS: Record<string, string> = {
  compelling: '#dc2626',
  significant: '#ea580c',
  strong: '#ea580c',
  moderate: '#ca8a04',
  weak: '#65a30d',
  marginal: '#65a30d',
};

const COLLAPSE_COLORS: Record<string, string> = {
  collapsed: '#dc2626',
  fractured: '#ea580c',
  weakened: '#ca8a04',
  supported: '#65a30d',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AttorneyWorkspaceProps {
  caseId: string;
}

export default function AttorneyWorkspace({ caseId }: AttorneyWorkspaceProps) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [activePane, setActivePane] = useState<PaneId>('defense');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/defense/workspace/${caseId}`);
      if (!res.ok) throw new Error(`Failed to load workspace: ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchWorkspace(); }, [fetchWorkspace]);

  const runSynthesis = async () => {
    setSynthesizing(true);
    try {
      const res = await fetch(`/api/defense/synthesize/${caseId}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Synthesis failed: ${res.status}`);
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
    } finally {
      setSynthesizing(false);
    }
  };

  if (loading && !data) {
    return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading attorney workspace...</div>;
  }

  if (error && !data) {
    return <div style={{ padding: 24, color: '#dc2626', fontFamily: 'system-ui' }}>Error: {error}</div>;
  }

  if (!data) return null;

  const panes: Array<{ id: PaneId; label: string; count: number }> = [
    { id: 'defense', label: 'Defense Issues', count: data.defensePane.issues.length },
    { id: 'burden', label: 'Burden Fractures', count: data.burdenFracturePane.totalFractures },
    { id: 'contradiction', label: 'Contradictions', count: data.contradictionPane.totalContradictions },
    { id: 'prosecutor', label: 'Prosecutor Theory', count: data.prosecutorTheoryPane.totalAttacks },
    { id: 'timeline', label: 'Timeline', count: data.timelinePane.totalIncompatibilities },
    { id: 'evidence', label: 'Evidence', count: data.evidencePane.totalStatements },
    { id: 'calcrim', label: 'CALCRIM', count: data.calcrimPane.charges },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>
            Attorney Intelligence Workspace
          </h1>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Case: {caseId.slice(0, 12)}... — Defense Analysis Cockpit</span>
        </div>
        <button
          onClick={runSynthesis}
          disabled={synthesizing}
          style={{
            padding: '8px 16px', background: synthesizing ? '#475569' : '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 6, cursor: synthesizing ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}
        >
          {synthesizing ? 'Synthesizing...' : 'Run Defense Synthesis'}
        </button>
      </div>

      {/* Pane Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: '1px solid #1e293b', overflowX: 'auto' }}>
        {panes.map((pane) => (
          <button
            key={pane.id}
            onClick={() => setActivePane(pane.id)}
            style={{
              padding: '10px 16px', background: activePane === pane.id ? '#1e293b' : 'transparent',
              color: activePane === pane.id ? '#f8fafc' : '#94a3b8', border: 'none',
              borderBottom: activePane === pane.id ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap',
            }}
          >
            {pane.label} <span style={{ background: '#334155', padding: '1px 6px', borderRadius: 10, fontSize: 11, marginLeft: 4 }}>{pane.count}</span>
          </button>
        ))}
      </div>

      {/* Pane Content */}
      <div style={{ padding: 24 }}>
        {activePane === 'defense' && <DefensePane data={data.defensePane} />}
        {activePane === 'burden' && <BurdenPane data={data.burdenFracturePane} />}
        {activePane === 'contradiction' && <ContradictionPane data={data.contradictionPane} />}
        {activePane === 'prosecutor' && <ProsecutorPane data={data.prosecutorTheoryPane} />}
        {activePane === 'timeline' && <TimelinePane data={data.timelinePane} />}
        {activePane === 'evidence' && <EvidencePane data={data.evidencePane} />}
        {activePane === 'calcrim' && <CalcrimPane data={data.calcrimPane} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Panes
// ---------------------------------------------------------------------------

function DefensePane({ data }: { data: WorkspaceData['defensePane'] }) {
  return (
    <div>
      {/* Defense Issues */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        Prioritized Defense Issues ({data.issues.length})
      </h2>
      {data.issues.length === 0 && <p style={{ color: '#94a3b8' }}>No defense issues detected. Run synthesis first.</p>}
      {data.issues.map((issue) => (
        <div key={issue.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 8, borderLeft: `4px solid ${SEVERITY_COLORS[issue.severity] || '#94a3b8'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{issue.title}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge color={SEVERITY_COLORS[issue.severity]}>{issue.severity}</Badge>
              <Badge color="#475569">P{issue.priority}</Badge>
              <Badge color="#475569">{issue.issueType}</Badge>
            </div>
          </div>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#cbd5e1' }}>{issue.description}</p>
          <p style={{ margin: '4px 0', fontSize: 12, color: '#3b82f6', fontWeight: 500 }}>{issue.defenseAction}</p>
        </div>
      ))}

      {/* Motion Opportunities */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 12, color: '#f8fafc' }}>
        Motion Opportunities ({data.motions.length})
      </h2>
      {data.motions.map((m) => (
        <div key={m.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 8, borderLeft: `4px solid ${STRENGTH_COLORS[m.strength] || '#94a3b8'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge color={STRENGTH_COLORS[m.strength]}>{m.strength}</Badge>
              <Badge color="#475569">{m.motionType}</Badge>
            </div>
          </div>
          <p style={{ margin: '2px 0', fontSize: 12, color: '#94a3b8' }}>{m.legalBasis}</p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#cbd5e1' }}>{m.factualBasis}</p>
        </div>
      ))}

      {/* Impeachment Packets */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 12, color: '#f8fafc' }}>
        Witness Impeachment Packets ({data.impeachmentPackets.length})
      </h2>
      {data.impeachmentPackets.map((p) => (
        <div key={p.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{p.witnessName}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge color={p.credibilityScore < 0.4 ? '#dc2626' : p.credibilityScore < 0.7 ? '#ca8a04' : '#65a30d'}>
                Credibility: {Math.round(p.credibilityScore * 100)}%
              </Badge>
              <Badge color="#475569">{p.totalInconsistencies} inconsistencies</Badge>
              <Badge color="#475569">{p.totalContradictions} contradictions</Badge>
            </div>
          </div>
        </div>
      ))}

      {/* Reasonable Doubt Structures */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 12, color: '#f8fafc' }}>
        Reasonable Doubt Structures ({data.reasonableDoubt.length})
      </h2>
      {data.reasonableDoubt.map((rd) => (
        <div key={rd.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 8, borderLeft: `4px solid ${STRENGTH_COLORS[rd.strength] || '#94a3b8'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{rd.title}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge color={STRENGTH_COLORS[rd.strength]}>{rd.strength}</Badge>
              <Badge color="#475569">{rd.doubtCategory}</Badge>
            </div>
          </div>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#cbd5e1' }}>{rd.narrative}</p>
        </div>
      ))}
    </div>
  );
}

function BurdenPane({ data }: { data: WorkspaceData['burdenFracturePane'] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        Burden Collapse Analysis ({data.collapseScores.length} instructions)
      </h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Total fractures: {data.totalFractures}</p>
      {data.collapseScores.map((cs) => (
        <div key={cs.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 8, borderLeft: `4px solid ${COLLAPSE_COLORS[cs.collapseLevel] || '#94a3b8'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>CALCRIM {cs.instructionNumber}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge color={COLLAPSE_COLORS[cs.collapseLevel]}>{cs.collapseLevel}</Badge>
              <Badge color="#475569">{Math.round(cs.collapseScore * 100)}% collapsed</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
            <span>Elements: {cs.totalElements}</span>
            <span style={{ color: '#dc2626' }}>Unsupported: {cs.unsupportedElements}</span>
            <span style={{ color: '#ea580c' }}>Contradicted: {cs.contradictedElements}</span>
          </div>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#cbd5e1' }}>{cs.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function ContradictionPane({ data }: { data: WorkspaceData['contradictionPane'] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        Proven Contradictions ({data.totalContradictions})
      </h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {Object.entries(data.bySeverity).map(([sev, count]) => (
          <div key={sev} style={{ background: '#1e293b', borderRadius: 8, padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: SEVERITY_COLORS[sev] || '#f8fafc' }}>{count}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>{sev}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#64748b' }}>
        Every contradiction is proven using exact evidence citations and deterministic logical incompatibility.
        No contradictions are invented or hallucinated.
      </p>
    </div>
  );
}

function ProsecutorPane({ data }: { data: WorkspaceData['prosecutorTheoryPane'] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        Prosecutor Theory Attack Surfaces ({data.totalAttacks})
      </h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(data.byType).map(([type, count]) => (
          <div key={type} style={{ background: '#1e293b', borderRadius: 8, padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>{count}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{type.replace(/_/g, ' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelinePane({ data }: { data: WorkspaceData['timelinePane'] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        Timeline Incompatibilities ({data.totalIncompatibilities})
      </h2>
      {data.totalIncompatibilities === 0 && (
        <p style={{ color: '#94a3b8' }}>No timeline incompatibilities detected.</p>
      )}
      {data.totalIncompatibilities > 0 && (
        <p style={{ fontSize: 13, color: '#cbd5e1' }}>
          {data.totalIncompatibilities} proven timeline impossibilities detected.
          Each represents a physical impossibility in the prosecution&apos;s version of events.
        </p>
      )}
    </div>
  );
}

function EvidencePane({ data }: { data: WorkspaceData['evidencePane'] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        Evidence Overview
      </h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <StatCard label="Documents" value={data.totalDocuments} />
        <StatCard label="Statements" value={data.totalStatements} />
      </div>
    </div>
  );
}

function CalcrimPane({ data }: { data: WorkspaceData['calcrimPane'] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
        CALCRIM Structure
      </h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <StatCard label="Charges" value={data.charges} />
        <StatCard label="Instructions" value={data.instructions} />
        <StatCard label="Elements" value={data.elements} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility Components
// ---------------------------------------------------------------------------

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: `${color}22`, color, padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
    </div>
  );
}
