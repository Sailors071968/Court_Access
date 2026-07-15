// ============================================================================
// Program 127 — Case Intelligence Map (interactive litigation visualization)
// A flagship SVG visualization that lets an attorney understand an entire
// criminal case at a glance: charges, CALCRIM elements, evidence, witnesses,
// timeline events, and investigation tasks and how they relate. Every node and
// edge is derived from the repository-backed Attorney Workbench bundle — no
// relationships, evidence, testimony, or legal conclusions are fabricated.
// Repository-backed vs UNKNOWN is labeled via ProvenanceBadge; UNKNOWN wherever
// repository coverage is insufficient (e.g. chain-of-custody collection).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Network, ZoomIn, ZoomOut, Maximize2, Info, X, Flame, Workflow,
  Gauge, ShieldCheck, Boxes, Users, HelpCircle, Scale, ListChecks, Clock, Loader2,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

type NodeType = 'charge' | 'element' | 'evidence' | 'witness' | 'document' | 'timeline' | 'investigation';

interface MapNode {
  id: string;
  type: NodeType;
  label: string;
  sub?: string;
  confidence?: string;
  status?: string;
  priority?: string;
  unknown?: boolean;
  x: number;
  y: number;
}
interface MapEdge { from: string; to: string; relation: string; kind: 'has' | 'supports' | 'contradicts' | 'graph' }

const TYPE_META: Record<NodeType, { label: string; color: string; icon: typeof Boxes }> = {
  charge: { label: 'Charges', color: '#4f46e5', icon: Scale },
  element: { label: 'CALCRIM Elements', color: '#0ea5e9', icon: ListChecks },
  evidence: { label: 'Evidence', color: '#059669', icon: Boxes },
  witness: { label: 'Witnesses', color: '#d97706', icon: Users },
  document: { label: 'Documents / Reports', color: '#7c3aed', icon: Info },
  timeline: { label: 'Timeline', color: '#0891b2', icon: Clock },
  investigation: { label: 'Investigation', color: '#dc2626', icon: ListChecks },
};
const COL_ORDER: NodeType[] = ['charge', 'element', 'evidence', 'witness', 'document', 'timeline', 'investigation'];
const EDGE_COLOR: Record<MapEdge['kind'], string> = { has: '#94a3b8', supports: '#10b981', contradicts: '#ef4444', graph: '#a78bfa' };
const CAP = 40;
const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');
const trunc = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function CaseIntelligenceMapPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set(COL_ORDER));
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load case intelligence map'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  // Build the deterministic node/edge model from the repository bundle.
  const { nodes, edges } = useMemo(() => {
    const nodes: MapNode[] = [];
    const edges: MapEdge[] = [];
    if (!b) return { nodes, edges };
    const raw: Record<NodeType, Omit<MapNode, 'x' | 'y'>[]> = {
      charge: [], element: [], evidence: [], witness: [], document: [], timeline: [], investigation: [],
    };
    const evItems = b.evidenceWorkbench.items;
    const evById = new Map(evItems.map((i) => [i.evidenceId, i]));

    b.caseOverview.charges.forEach((c) => raw.charge.push({ id: `charge:${c.id}`, type: 'charge', label: `${c.code} §${c.section}`, sub: c.title ?? undefined }));
    b.elementMatrices.forEach((m) => m.rows.forEach((r, i) => {
      const id = `element:${r.chargeId}:${r.elementId}:${i}`;
      raw.element.push({ id, type: 'element', label: trunc(r.elementLabel, 30), sub: `${r.code} §${r.section}`, status: r.status, confidence: r.confidence, unknown: r.status.toLowerCase() === 'unknown' });
      edges.push({ from: `charge:${r.chargeId}`, to: id, relation: 'has element', kind: 'has' });
      r.supportingEvidence.forEach((s) => { if (evById.has(s.evidenceId)) edges.push({ from: id, to: `evidence:${s.evidenceId}`, relation: `supports (${s.role})`, kind: 'supports' }); });
      r.contradictoryEvidence.forEach((s) => { if (evById.has(s.evidenceId)) edges.push({ from: id, to: `evidence:${s.evidenceId}`, relation: `contradicts (${s.role})`, kind: 'contradicts' }); });
    }));
    evItems.forEach((e) => raw.evidence.push({ id: `evidence:${e.evidenceId}`, type: 'evidence', label: trunc(e.fileName, 28), sub: e.evidenceType, confidence: e.confidence, status: e.processingStatus }));
    // Knowledge-graph nodes/edges: witnesses & documents not already represented.
    const gNodeType = (t: string): NodeType => (/witness/i.test(t) ? 'witness' : /doc|report|record/i.test(t) ? 'document' : 'evidence');
    b.evidenceWorkbench.graph.nodes.forEach((n) => {
      const t = gNodeType(n.type);
      if (t === 'evidence' && evById.has(n.id)) return;
      const id = `${t}:${n.id}`;
      if (t === 'witness' && !raw.witness.some((w) => w.id === id)) raw.witness.push({ id, type: 'witness', label: trunc(n.label, 26), sub: n.type });
      else if (t === 'document' && !raw.document.some((d) => d.id === id)) raw.document.push({ id, type: 'document', label: trunc(n.label, 26), sub: n.type });
    });
    b.evidenceWorkbench.graph.edges.forEach((e) => {
      const from = [...raw.witness, ...raw.document].find((x) => x.id.endsWith(`:${e.from}`))?.id ?? (evById.has(e.from) ? `evidence:${e.from}` : null);
      const to = [...raw.witness, ...raw.document].find((x) => x.id.endsWith(`:${e.to}`))?.id ?? (evById.has(e.to) ? `evidence:${e.to}` : null);
      if (from && to) edges.push({ from, to, relation: e.relation, kind: 'graph' });
    });
    b.caseOverview.caseTimeline.slice(0, CAP).forEach((t) => raw.timeline.push({ id: `timeline:${t.id}`, type: 'timeline', label: trunc(t.description, 28), sub: t.timestamp ?? 'UNKNOWN time', unknown: !t.timestamp }));
    b.investigation.tasks.slice(0, CAP).forEach((t) => raw.investigation.push({ id: `task:${t.id}`, type: 'investigation', label: trunc(t.title, 28), sub: t.status, priority: t.priority }));

    // Deterministic columnar layout.
    const presentCols = COL_ORDER.filter((t) => raw[t].length > 0);
    const colGap = 260;
    presentCols.forEach((t, ci) => {
      const list = raw[t].slice(0, CAP);
      const rowGap = Math.max(46, Math.min(90, 620 / Math.max(list.length, 1)));
      list.forEach((n, ri) => nodes.push({ ...n, x: 120 + ci * colGap, y: 70 + ri * rowGap }));
    });
    return { nodes, edges };
  }, [b]);

  const visibleNodes = useMemo(() => nodes.filter((n) => {
    if (!activeTypes.has(n.type)) return false;
    if (unknownOnly && !n.unknown && (n.status ?? '').toLowerCase() !== 'unknown') return false;
    if (highPriorityOnly && n.type === 'investigation' && !/high|highest/i.test(n.priority ?? '')) return false;
    if (highPriorityOnly && n.type !== 'investigation' && n.type !== 'element') return false;
    if (highPriorityOnly && n.type === 'element' && (n.status ?? '').toLowerCase() === 'satisfied') return false;
    return true;
  }), [nodes, activeTypes, unknownOnly, highPriorityOnly]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)), [edges, visibleIds]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const selectedNode = selected ? nodeById.get(selected) : null;
  const neighbors = useMemo(() => {
    if (!selectedNode) return [];
    const out: Array<{ node: MapNode; relation: string }> = [];
    edges.forEach((e) => {
      if (e.from === selectedNode.id && nodeById.get(e.to)) out.push({ node: nodeById.get(e.to)!, relation: e.relation });
      else if (e.to === selectedNode.id && nodeById.get(e.from)) out.push({ node: nodeById.get(e.from)!, relation: `← ${e.relation}` });
    });
    return out;
  }, [selectedNode, edges, nodeById]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Rendering Case Intelligence Map…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const rows = b.elementMatrices.flatMap((m) => m.rows);
  const supported = rows.filter((r) => r.supportingEvidence.length > 0).length;
  const proofStrength = rows.length ? Math.round((supported / rows.length) * 100) : 0;
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const openInvestigation = cc.investigationStatus.open + cc.investigationStatus.inProgress;

  // Investigation heat map cells.
  const heat: Array<{ label: string; count: number }> = [
    { label: 'Missing evidence', count: b.evidenceWorkbench.missing.length },
    { label: 'Missing witnesses', count: b.investigation.witnessGaps.length },
    { label: 'Contradictions', count: cc.contradictionCount },
    { label: 'Evidence gaps', count: b.investigation.evidenceGaps.length },
    { label: 'CALCRIM deficiencies', count: rows.filter((r) => r.status.toLowerCase() !== 'satisfied').length },
    { label: 'Open investigation', count: openInvestigation },
    { label: 'Outstanding subpoenas', count: b.investigation.recommendedSubpoenas.length },
    { label: 'Outstanding discovery', count: b.investigation.recommendedDiscovery.length },
  ];
  const heatCls = (c: number) => (c === 0 ? 'bg-gray-50 text-gray-400 border-gray-200' : c <= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : c <= 5 ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-red-100 text-red-700 border-red-300');

  const svgW = Math.max(700, (COL_ORDER.filter((t) => nodes.some((n) => n.type === t)).length) * 260 + 120);
  const svgH = 720;
  const toggleType = (t: NodeType) => setActiveTypes((prev) => { const s = new Set(prev); s.has(t) ? s.delete(t) : s.add(t); return s; });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Network size={22} className="text-indigo-600" /> Case Intelligence Map</h2>
        <p className="text-sm text-gray-500 mt-1">Interactive, evidence-governed view of how charges, elements, evidence, witnesses, timeline, and investigation relate.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${nodes.length} nodes · ${edges.length} relationships · confidence ${repoConfidence}%`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Every node and edge is derived from repository coverage. Nodes with no established relationship appear unconnected; facts the repository does not establish are <strong>UNKNOWN</strong> — no relationships, evidence, or conclusions are fabricated.</span>
      </div>

      {/* Phase 6 — Executive Case Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard icon={<Gauge size={20} />} value={`${cc.caseHealth.score}%`} label="Case readiness" />
        <StatCard icon={<Scale size={20} />} value={`${cc.trialReadiness.score}%`} label="Trial readiness" />
        <StatCard icon={<ShieldCheck size={20} />} value={`${proofStrength}%`} label="Proof strength" />
        <StatCard icon={<Boxes size={20} />} value={`${cc.evidenceHealth.score}%`} label="Evidence coverage" />
        <StatCard icon={<ListChecks size={20} />} value={`${cc.legalCoverage.score}%`} label="CALCRIM coverage" />
        <StatCard icon={<Network size={20} />} value={`${repoConfidence}%`} label="Repository confidence" />
        <StatCard icon={<ListChecks size={20} />} value={openInvestigation} label="Open investigation" highlight={openInvestigation > 0} />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Human review" highlight={cc.unknownCount > 0} />
      </div>

      {/* Phase 3 — Visual Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">Filters</span>
          {COL_ORDER.filter((t) => nodes.some((n) => n.type === t)).map((t) => {
            const M = TYPE_META[t]; const on = activeTypes.has(t); const count = nodes.filter((n) => n.type === t).length;
            return (
              <button key={t} onClick={() => toggleType(t)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? 'text-white' : 'bg-white text-gray-500 border-gray-300'}`} style={on ? { backgroundColor: M.color, borderColor: M.color } : undefined}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? '#fff' : M.color }} />{M.label} ({count})
              </button>
            );
          })}
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <button onClick={() => setUnknownOnly((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${unknownOnly ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-300'}`}><HelpCircle size={12} /> UNKNOWN only</button>
          <button onClick={() => setHighPriorityOnly((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${highPriorityOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-300'}`}><Flame size={12} /> High priority / outstanding</button>
        </div>
      </Card>

      {/* Phase 1/2/7 — Interactive map */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <span className="text-sm font-medium text-gray-700">Relationship Map <span className="text-gray-400">({visibleNodes.length} shown · {visibleEdges.length} edges)</span></span>
              <div className="flex items-center gap-1">
                <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))} className="rounded p-1.5 hover:bg-gray-100 text-gray-600"><ZoomOut size={16} /></button>
                <span className="w-10 text-center text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
                <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} className="rounded p-1.5 hover:bg-gray-100 text-gray-600"><ZoomIn size={16} /></button>
                <button aria-label="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1.5 hover:bg-gray-100 text-gray-600"><Maximize2 size={16} /></button>
              </div>
            </div>
            <div
              className="relative overflow-hidden bg-slate-50"
              style={{ height: 560, cursor: drag.current ? 'grabbing' : 'grab' }}
              onWheel={(e) => { setZoom((z) => Math.min(2.5, Math.max(0.4, +(z - Math.sign(e.deltaY) * 0.1).toFixed(2)))); }}
              onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
              onPointerMove={(e) => { if (drag.current) setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }}
              onPointerUp={() => { drag.current = null; }}
              onPointerLeave={() => { drag.current = null; }}
            >
              {visibleNodes.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No nodes match the current filters.</div>
              ) : (
                <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
                  <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                    {visibleEdges.map((e, i) => {
                      const a = nodeById.get(e.from)!; const c = nodeById.get(e.to)!;
                      const active = selected && (e.from === selected || e.to === selected);
                      const mx = (a.x + c.x) / 2;
                      return <path key={i} d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${c.y}, ${c.x} ${c.y}`} fill="none" stroke={EDGE_COLOR[e.kind]} strokeWidth={active ? 2.4 : 1} strokeOpacity={selected && !active ? 0.12 : 0.5} />;
                    })}
                    {visibleNodes.map((n) => {
                      const M = TYPE_META[n.type];
                      const isSel = selected === n.id;
                      const dim = selected && !isSel && !neighbors.some((x) => x.node.id === n.id);
                      return (
                        <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }} opacity={dim ? 0.3 : 1} onPointerDown={(e) => e.stopPropagation()} onClick={() => setSelected(n.id)}>
                          <circle r={isSel ? 11 : 8} fill={M.color} stroke={n.unknown ? '#9ca3af' : '#fff'} strokeWidth={n.unknown ? 2 : 1.5} strokeDasharray={n.unknown ? '3 2' : undefined} />
                          <text x={13} y={4} fontSize={11} fill="#334155" fontWeight={isSel ? 700 : 400}>{n.label}</text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
              <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded bg-white/80 px-2 py-1 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded" style={{ background: EDGE_COLOR.has }} />has element</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded" style={{ background: EDGE_COLOR.supports }} />supports</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded" style={{ background: EDGE_COLOR.contradicts }} />contradicts</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded" style={{ background: EDGE_COLOR.graph }} />graph link</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full border border-gray-400 border-dashed" />UNKNOWN</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Phase 2 — Interactive relationships side panel */}
        <Card>
          {selectedNode ? (
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: TYPE_META[selectedNode.type].color }}>{TYPE_META[selectedNode.type].label}</span>
                  <h4 className="mt-2 text-base font-semibold text-gray-900">{selectedNode.label}</h4>
                  {selectedNode.sub && <p className="text-xs text-gray-500">{selectedNode.sub}</p>}
                </div>
                <button aria-label="Close" onClick={() => setSelected(null)} className="rounded p-1 hover:bg-gray-100 text-gray-400"><X size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                {selectedNode.status && <span className="rounded-full border border-gray-200 px-2 py-0.5">Status: {selectedNode.status}</span>}
                {selectedNode.confidence && <span className="rounded-full border border-gray-200 px-2 py-0.5">Confidence: {selectedNode.confidence}</span>}
                {selectedNode.priority && <span className="rounded-full border border-gray-200 px-2 py-0.5">Priority: {selectedNode.priority}</span>}
                {selectedNode.unknown && <ProvenanceBadge kind="unknown" />}
              </div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Related ({neighbors.length})</h5>
              {neighbors.length === 0 ? <p className="text-sm text-gray-500">No repository relationships established for this node (UNKNOWN).</p> : (
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {neighbors.map((nb, i) => (
                    <li key={i}>
                      <button onClick={() => setSelected(nb.node.id)} className="w-full text-left rounded-md border border-gray-100 px-2 py-1.5 hover:bg-gray-50">
                        <span className="flex items-center gap-1.5 text-sm text-gray-800"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_META[nb.node.type].color }} />{nb.node.label}</span>
                        <span className="text-xs text-gray-400">{nb.relation}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-gray-400"><Network size={28} className="mx-auto mb-2 text-gray-300" />Select any node to inspect its repository-backed relationships.</div>
          )}
        </Card>
      </div>

      {/* Phase 4 — Investigation Heat Map */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Flame size={18} className="text-red-600" /> Investigation Heat Map</h3>
          <ProvenanceBadge kind={kindOf(heat.reduce((s, h) => s + h.count, 0))} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {heat.map((h) => (
            <div key={h.label} className={`rounded-lg border p-3 text-center ${heatCls(h.count)}`}>
              <div className="text-2xl font-bold">{h.count}</div>
              <div className="text-xs mt-1">{h.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Intensity reflects the count of outstanding items from repository coverage; higher intensity indicates greater investigative priority.</p>
      </Card>

      {/* Phase 5 — Evidence Flow */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Workflow size={18} className="text-emerald-600" /> Evidence Flow</h3>
          <ProvenanceBadge kind={kindOf(b.evidenceWorkbench.items.length)} note="collection/custody UNKNOWN" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { label: 'Collection', value: 'UNKNOWN', cls: 'bg-gray-100 text-gray-500 border-gray-300' },
            { label: 'Chain of custody', value: 'UNKNOWN', cls: 'bg-gray-100 text-gray-500 border-gray-300' },
            { label: 'Evidence items', value: String(b.evidenceWorkbench.items.length), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Supported elements', value: `${supported}/${rows.length}`, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
            { label: 'Charges', value: String(b.caseOverview.charges.length), cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          ].map((lane, i, arr) => (
            <span key={lane.label} className="flex items-center gap-2">
              <span className={`rounded-lg border px-3 py-2 text-center ${lane.cls}`}><span className="block text-lg font-bold">{lane.value}</span><span className="text-xs">{lane.label}</span></span>
              {i < arr.length - 1 && <span className="text-gray-300">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Evidence collection and chain-of-custody events are not established by the current repository and are reported as UNKNOWN pending records review.</p>
      </Card>
    </div>
  );
}
