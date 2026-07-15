// ============================================================================
// Program 131 — Cross-Examination Intelligence Center
// Organizes repository-backed evidence into structured witness analysis and
// cross-examination preparation, built from the Attorney Workbench bundle.
// CourtAccess NEVER generates testimony, fabricates contradictions/impeachment
// material, or recommends a cross-examination strategy — it organizes repository
// facts for attorney review. Repository / UNKNOWN / Illustrative labeled via
// ProvenanceBadge; UNKNOWN wherever repository coverage is insufficient.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Users, MessageSquareWarning, Scale, Share2, ClipboardList, ShieldCheck,
  FileText, Clock, ListChecks, Info, HelpCircle, Loader2, AlertTriangle,
  ZoomIn, ZoomOut, Maximize2, X,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');
const trunc = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type MNodeType = 'witness' | 'evidence' | 'charge' | 'element' | 'timeline' | 'document';
interface MNode { id: string; type: MNodeType; label: string; x: number; y: number }
interface MEdge { from: string; to: string; relation: string }
const NTYPE: Record<MNodeType, { label: string; color: string }> = {
  witness: { label: 'Witnesses', color: '#d97706' },
  evidence: { label: 'Evidence', color: '#059669' },
  charge: { label: 'Charges', color: '#4f46e5' },
  element: { label: 'CALCRIM', color: '#0ea5e9' },
  timeline: { label: 'Timeline', color: '#0891b2' },
  document: { label: 'Documents', color: '#7c3aed' },
};
const MCOL: MNodeType[] = ['witness', 'evidence', 'element', 'charge', 'document', 'timeline'];

function Section({ icon, title, kind, note, children }: { icon: React.ReactNode; title: string; kind: Provenance; note?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">{icon} {title}</h3>
        <ProvenanceBadge kind={kind} note={note} />
      </div>
      {children}
    </Card>
  );
}
function Bullets({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-gray-500">{empty ?? 'No repository information established (UNKNOWN).'}</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{t}</li>)}</ul>;
}

export function CrossExaminationPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load cross-examination intelligence'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const witnesses = useMemo(() => {
    if (!b) return [] as Array<{ name: string; detail: string }>;
    const fromList = b.trialPreparation.witnessList.map((w) => ({ name: w.title, detail: w.detail }));
    const fromGraph = b.evidenceWorkbench.graph.nodes.filter((n) => /witness/i.test(n.type)).map((n) => ({ name: n.label, detail: n.type }));
    const seen = new Set(fromList.map((w) => w.name));
    return [...fromList, ...fromGraph.filter((w) => !seen.has(w.name))];
  }, [b]);

  // Deterministic witness relationship map.
  const { nodes, edges } = useMemo(() => {
    const nodes: MNode[] = []; const edges: MEdge[] = [];
    if (!b) return { nodes, edges };
    const raw: Record<MNodeType, Omit<MNode, 'x' | 'y'>[]> = { witness: [], evidence: [], charge: [], element: [], timeline: [], document: [] };
    const evById = new Map(b.evidenceWorkbench.items.map((i) => [i.evidenceId, i]));
    witnesses.forEach((w, i) => raw.witness.push({ id: `witness:${i}:${w.name}`, type: 'witness', label: trunc(w.name) }));
    b.evidenceWorkbench.items.slice(0, 30).forEach((e) => raw.evidence.push({ id: `evidence:${e.evidenceId}`, type: 'evidence', label: trunc(e.fileName) }));
    b.caseOverview.charges.forEach((c) => raw.charge.push({ id: `charge:${c.id}`, type: 'charge', label: `${c.code} §${c.section}` }));
    b.elementMatrices.flatMap((m) => m.rows).slice(0, 30).forEach((r, i) => {
      const id = `element:${r.elementId}:${i}`;
      raw.element.push({ id, type: 'element', label: trunc(r.elementLabel) });
      edges.push({ from: `charge:${r.chargeId}`, to: id, relation: 'has element' });
      r.supportingEvidence.forEach((s) => { if (evById.has(s.evidenceId)) edges.push({ from: id, to: `evidence:${s.evidenceId}`, relation: 'supported by' }); });
    });
    b.evidenceWorkbench.graph.nodes.filter((n) => /doc|report|record/i.test(n.type)).forEach((n) => raw.document.push({ id: `document:${n.id}`, type: 'document', label: trunc(n.label) }));
    b.caseOverview.caseTimeline.slice(0, 20).forEach((t) => raw.timeline.push({ id: `timeline:${t.id}`, type: 'timeline', label: trunc(t.description) }));
    // Knowledge-graph edges touching witnesses/evidence/documents.
    b.evidenceWorkbench.graph.edges.forEach((e) => {
      const find = (gid: string) => raw.witness.find((w) => w.id.endsWith(gid))?.id ?? (evById.has(gid) ? `evidence:${gid}` : raw.document.find((d) => d.id === `document:${gid}`)?.id ?? null);
      const from = find(e.from); const to = find(e.to);
      if (from && to) edges.push({ from, to, relation: e.relation });
    });
    const present = MCOL.filter((t) => raw[t].length > 0);
    present.forEach((t, ci) => {
      const list = raw[t];
      const rowGap = Math.max(46, Math.min(90, 600 / Math.max(list.length, 1)));
      list.forEach((n, ri) => nodes.push({ ...n, x: 110 + ci * 240, y: 60 + ri * rowGap }));
    });
    return { nodes, edges };
  }, [b, witnesses]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNode = selected ? nodeById.get(selected) : null;
  const neighbors = useMemo(() => {
    if (!selectedNode) return [] as Array<{ node: MNode; relation: string }>;
    const out: Array<{ node: MNode; relation: string }> = [];
    edges.forEach((e) => {
      if (e.from === selectedNode.id && nodeById.get(e.to)) out.push({ node: nodeById.get(e.to)!, relation: e.relation });
      else if (e.to === selectedNode.id && nodeById.get(e.from)) out.push({ node: nodeById.get(e.from)!, relation: `← ${e.relation}` });
    });
    return out;
  }, [selectedNode, edges, nodeById]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Building Cross-Examination Intelligence Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const inv = b.investigation;
  const ew = b.evidenceWorkbench;
  const rows = b.elementMatrices.flatMap((m) => m.rows);
  const weakRows = rows.filter((r) => r.status.toLowerCase() !== 'satisfied');
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const contradictions = ew.contradictions.map((c) => c.finding);
  const impeachment = b.trialPreparation.impeachmentOpportunities.map((i) => `${i.title}${i.detail ? ` — ${i.detail}` : ''}`);
  const timelineConflicts = b.caseOverview.caseTimeline.filter((t) => t.conflictFlag).map((t) => `${t.timestamp ?? 'UNKNOWN time'}: ${t.description}`);
  const outstandingUnknowns = b.caseOverview.outstandingUnknowns?.length ? b.caseOverview.outstandingUnknowns : b.intelligence.unknowns.all;
  const witnessNodes = ew.graph.nodes.filter((n) => /witness/i.test(n.type)).map((n) => n.label);
  const docNodes = ew.graph.nodes.filter((n) => /doc|report|record/i.test(n.type)).map((n) => n.label);
  const svgW = Math.max(700, MCOL.filter((t) => nodes.some((n) => n.type === t)).length * 240 + 120);
  const legalResearch = [...b.intelligence.recommendedMotions, ...b.legalAuthority.authorities.map((a) => a.finding)];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><MessageSquareWarning size={22} className="text-indigo-600" /> Cross-Examination Intelligence Center</h2>
        <p className="text-sm text-gray-500 mt-1">Repository-backed witness analysis organized for attorney cross-examination preparation.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${witnesses.length} witness(es) · ${cc.contradictionCount} contradiction(s) · confidence ${repoConfidence}%`} /></div>
      </div>

      {/* Mandatory disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not generate testimony, fabricate contradictions or impeachment material, or recommend a cross-examination strategy.</strong> The information below organizes repository-derived facts for attorney review. Where the repository does not establish a fact, the result is <strong>UNKNOWN</strong>. All questioning and strategy remain attorney judgment.</span>
      </div>

      {/* Phase 1 — Center dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Users size={20} />} value={witnesses.length} label="Witnesses" />
        <StatCard icon={<Scale size={20} />} value={cc.contradictionCount} label="Contradictions" highlight={cc.contradictionCount > 0} />
        <StatCard icon={<MessageSquareWarning size={20} />} value={impeachment.length} label="Impeachment items" />
        <StatCard icon={<ListChecks size={20} />} value={`${cc.legalCoverage.score}%`} label="CALCRIM coverage" />
        <StatCard icon={<ShieldCheck size={20} />} value={`${repoConfidence}%`} label="Repository confidence" />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Human review" highlight={cc.unknownCount > 0} />
      </div>

      {/* Phase 2 — Witness Analysis */}
      <Section icon={<Users size={18} className="text-amber-600" />} title="Witness Analysis" kind={kindOf(witnesses.length)}>
        {witnesses.length === 0 ? <p className="text-sm text-gray-500">No witnesses established in the repository (UNKNOWN).</p> : (
          <div className="space-y-3">
            {witnesses.map((w, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Users size={14} className="text-amber-500" />{w.name}</h4>
                  <span className="text-xs text-gray-400">{w.detail || 'UNKNOWN role'}</span>
                </div>
                <div className="grid md:grid-cols-4 gap-3 mt-2 text-xs">
                  <div><span className="text-gray-500 flex items-center gap-1"><FileText size={11} />Related documents</span><Bullets items={docNodes} empty="UNKNOWN" /></div>
                  <div><span className="text-gray-500 flex items-center gap-1"><Clock size={11} />Related timeline</span><Bullets items={b.caseOverview.caseTimeline.slice(0, 4).map((t) => `${t.timestamp ?? 'UNKNOWN'}: ${trunc(t.description, 30)}`)} empty="UNKNOWN" /></div>
                  <div><span className="text-gray-500 flex items-center gap-1"><ListChecks size={11} />Related CALCRIM</span><Bullets items={[...new Set(weakRows.map((r) => `${r.code} §${r.section}`))]} empty="UNKNOWN" /></div>
                  <div><span className="text-gray-500 flex items-center gap-1"><Share2 size={11} />Graph links</span><Bullets items={witnessNodes.length ? [`${ew.graph.edges.length} graph edge(s)`] : []} empty="UNKNOWN" /></div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400">Witness-specific evidence linkage is shown where the repository establishes it; otherwise UNKNOWN. CourtAccess does not generate witness statements.</p>
          </div>
        )}
      </Section>

      {/* Phase 3 — Contradiction Analysis */}
      <Section icon={<Scale size={18} className="text-red-600" />} title="Contradiction Analysis" kind={kindOf(contradictions.length + timelineConflicts.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Repository-backed contradictions</h4>
            <Bullets items={contradictions} empty="No contradictions detected in the repository (UNKNOWN)." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Conflicting evidence</h4>
            <Bullets items={rows.flatMap((r) => r.contradictoryEvidence.map((s) => `${r.code} §${r.section} (${r.elementLabel}) — conflicting item ${s.evidenceId}`))} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Timeline inconsistencies</h4>
            <Bullets items={timelineConflicts} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding factual / evidentiary questions</h4>
            <Bullets items={[...weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`), ...ew.missing]} />
          </div>
        </div>
      </Section>

      {/* Phase 4 — Impeachment Review */}
      <Section icon={<MessageSquareWarning size={18} className="text-purple-600" />} title="Impeachment Review" kind={kindOf(impeachment.length + timelineConflicts.length)} note="information for review — impeachment appropriateness is attorney judgment">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Potential prior inconsistent statements</h4>
            <Bullets items={impeachment} empty="No repository-backed impeachment material (UNKNOWN)." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Conflicting evidence & timeline conflicts</h4>
            <Bullets items={[...contradictions, ...timelineConflicts]} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding investigation</h4>
            <Bullets items={[...inv.recommendedInvestigation, ...inv.witnessGaps.map((w) => w.finding)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Human review checklist</h4>
            {outstandingUnknowns.length === 0 ? <p className="text-sm text-gray-500">No outstanding review items recorded.</p> : (
              <ul className="space-y-1.5">{outstandingUnknowns.map((u, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1 flex-shrink-0" aria-label="reviewed" />{u}</li>)}</ul>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-amber-700">CourtAccess presents repository-backed information only; it does not assert that impeachment is appropriate.</p>
      </Section>

      {/* Phase 5 — Witness Relationship Map */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><Share2 size={16} className="text-purple-600" /> Witness Relationship Map <span className="text-gray-400">({nodes.length} nodes · {edges.length} edges)</span></span>
          <div className="flex items-center gap-1">
            <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))} className="rounded p-1.5 hover:bg-gray-100 text-gray-600"><ZoomOut size={16} /></button>
            <span className="w-10 text-center text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
            <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} className="rounded p-1.5 hover:bg-gray-100 text-gray-600"><ZoomIn size={16} /></button>
            <button aria-label="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1.5 hover:bg-gray-100 text-gray-600"><Maximize2 size={16} /></button>
          </div>
        </div>
        <div className="grid lg:grid-cols-3">
          <div className="lg:col-span-2 relative overflow-hidden bg-slate-50" style={{ height: 520, cursor: drag.current ? 'grabbing' : 'grab' }}
            onWheel={(e) => setZoom((z) => Math.min(2.5, Math.max(0.4, +(z - Math.sign(e.deltaY) * 0.1).toFixed(2))))}
            onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
            onPointerMove={(e) => { if (drag.current) setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }}
            onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
            {nodes.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-gray-400">No repository relationships to visualize (UNKNOWN).</div> : (
              <svg width="100%" height="100%" viewBox={`0 0 ${svgW} 700`} preserveAspectRatio="xMidYMid meet">
                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                  {edges.map((e, i) => {
                    const a = nodeById.get(e.from); const c = nodeById.get(e.to);
                    if (!a || !c) return null;
                    const act = selected && (e.from === selected || e.to === selected);
                    const mx = (a.x + c.x) / 2;
                    return <path key={i} d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${c.y}, ${c.x} ${c.y}`} fill="none" stroke={act ? '#6366f1' : '#cbd5e1'} strokeWidth={act ? 2.2 : 1} strokeOpacity={selected && !act ? 0.15 : 0.5} />;
                  })}
                  {nodes.map((n) => {
                    const isSel = selected === n.id;
                    const dim = selected && !isSel && !neighbors.some((x) => x.node.id === n.id);
                    return (
                      <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }} opacity={dim ? 0.3 : 1} onPointerDown={(e) => e.stopPropagation()} onClick={() => setSelected(n.id)}>
                        <circle r={isSel ? 11 : 8} fill={NTYPE[n.type].color} stroke="#fff" strokeWidth={1.5} />
                        <text x={13} y={4} fontSize={11} fill="#334155" fontWeight={isSel ? 700 : 400}>{n.label}</text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded bg-white/80 px-2 py-1 text-[10px] text-gray-500">
              {MCOL.filter((t) => nodes.some((n) => n.type === t)).map((t) => <span key={t} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: NTYPE[t].color }} />{NTYPE[t].label}</span>)}
            </div>
          </div>
          <div className="border-l border-gray-100 p-4">
            {selectedNode ? (
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: NTYPE[selectedNode.type].color }}>{NTYPE[selectedNode.type].label}</span>
                    <h4 className="mt-2 text-sm font-semibold text-gray-900">{selectedNode.label}</h4>
                  </div>
                  <button aria-label="Close" onClick={() => setSelected(null)} className="rounded p-1 hover:bg-gray-100 text-gray-400"><X size={16} /></button>
                </div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Related ({neighbors.length})</h5>
                {neighbors.length === 0 ? <p className="text-sm text-gray-500">No repository relationships (UNKNOWN).</p> : (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {neighbors.map((nb, i) => (
                      <li key={i}><button onClick={() => setSelected(nb.node.id)} className="w-full text-left rounded-md border border-gray-100 px-2 py-1.5 hover:bg-gray-50">
                        <span className="flex items-center gap-1.5 text-sm text-gray-800"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: NTYPE[nb.node.type].color }} />{nb.node.label}</span>
                        <span className="text-xs text-gray-400">{nb.relation}</span>
                      </button></li>
                    ))}
                  </ul>
                )}
              </div>
            ) : <div className="text-center py-10 text-sm text-gray-400"><Share2 size={26} className="mx-auto mb-2 text-gray-300" />Select any node to inspect its repository-backed relationships.</div>}
          </div>
        </div>
      </Card>

      {/* Phase 6 — Attorney Witness Briefing */}
      <Section icon={<ClipboardList size={18} className="text-gray-700" />} title="Attorney Witness Briefing" kind="repository">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm text-gray-700">
            <div><span className="text-gray-500">Witness summary:</span> {witnesses.length} witness(es) in the repository; {witnessNodes.length} appear in the Knowledge Graph.</div>
            <div><span className="text-gray-500">Evidence summary:</span> {b.caseOverview.evidenceSummary.total} item(s); {cc.contradictionCount} contradiction(s); {impeachment.length} impeachment item(s).</div>
            <div><span className="text-gray-500">Repository confidence:</span> {repoConfidence}% ({cc.unknownCount} UNKNOWN)</div>
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding factual questions</h4>
            <Bullets items={weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`)} empty="No unsupported elements." />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding investigation</h4>
            <Bullets items={[...inv.recommendedInvestigation, ...inv.witnessGaps.map((w) => w.finding)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding legal research (topics, not conclusions)</h4>
            <Bullets items={legalResearch} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Human review checklist</h4>
            {outstandingUnknowns.length === 0 ? <p className="text-sm text-gray-500">No outstanding review items recorded.</p> : (
              <ul className="space-y-1.5">{outstandingUnknowns.map((u, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><HelpCircle size={13} className="mt-0.5 text-gray-400 flex-shrink-0" /><span><input type="checkbox" className="mr-2 align-middle" aria-label="reviewed" />{u}</span></li>)}</ul>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>This briefing organizes repository-derived facts only. It does not generate testimony, fabricate contradictions, or recommend a cross-examination strategy. UNKNOWN denotes insufficient repository coverage requiring attorney review.</span>
        </div>
      </Section>
    </div>
  );
}
