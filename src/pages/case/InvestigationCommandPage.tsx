// ============================================================================
// Program 133 — Investigation Command Center
// Organizes repository-backed evidence into structured investigation planning,
// built from the Attorney Workbench bundle. CourtAccess NEVER fabricates
// investigative findings, evidence, witnesses, legal conclusions, or litigation
// strategy — it organizes repository facts to help identify investigative
// opportunities for attorney/investigator review. Repository / UNKNOWN /
// Illustrative labeled via ProvenanceBadge; UNKNOWN wherever coverage is
// insufficient.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, MapPin, Lightbulb, Share2, Gauge, ClipboardList, Users, FileText,
  Camera, HardDrive, FlaskConical, Clock, ListChecks, HelpCircle, Info, Loader2,
  AlertTriangle, ZoomIn, ZoomOut, Maximize2, X, ShieldCheck, Boxes,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');
const trunc = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type NType = 'task' | 'evidence' | 'witness' | 'charge' | 'element' | 'timeline';
interface GNode { id: string; type: NType; label: string; x: number; y: number }
interface GEdge { from: string; to: string; relation: string }
const NT: Record<NType, { label: string; color: string }> = {
  task: { label: 'Investigation', color: '#dc2626' },
  evidence: { label: 'Evidence', color: '#059669' },
  witness: { label: 'Witnesses', color: '#d97706' },
  charge: { label: 'Charges', color: '#4f46e5' },
  element: { label: 'CALCRIM', color: '#0ea5e9' },
  timeline: { label: 'Timeline', color: '#0891b2' },
};
const COL: NType[] = ['task', 'witness', 'evidence', 'element', 'charge', 'timeline'];

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
function leadIcon(label: string) {
  if (/photo|scene|image/i.test(label)) return <Camera size={14} className="text-blue-500" />;
  if (/digital|phone|device|video|record/i.test(label)) return <HardDrive size={14} className="text-purple-500" />;
  if (/forensic|dna|lab|test/i.test(label)) return <FlaskConical size={14} className="text-pink-500" />;
  if (/witness|interview|canvas/i.test(label)) return <Users size={14} className="text-amber-500" />;
  return <FileText size={14} className="text-gray-500" />;
}

export function InvestigationCommandPage() {
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
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load investigation command center'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const { nodes, edges } = useMemo(() => {
    const nodes: GNode[] = []; const edges: GEdge[] = [];
    if (!b) return { nodes, edges };
    const raw: Record<NType, Omit<GNode, 'x' | 'y'>[]> = { task: [], evidence: [], witness: [], charge: [], element: [], timeline: [] };
    const evById = new Map(b.evidenceWorkbench.items.map((i) => [i.evidenceId, i]));
    b.investigation.tasks.slice(0, 30).forEach((t) => raw.task.push({ id: `task:${t.id}`, type: 'task', label: trunc(t.title) }));
    b.evidenceWorkbench.items.slice(0, 25).forEach((e) => raw.evidence.push({ id: `evidence:${e.evidenceId}`, type: 'evidence', label: trunc(e.fileName) }));
    const witnesses = [...b.trialPreparation.witnessList.map((w) => w.title), ...b.evidenceWorkbench.graph.nodes.filter((n) => /witness/i.test(n.type)).map((n) => n.label)];
    [...new Set(witnesses)].forEach((w, i) => raw.witness.push({ id: `witness:${i}:${w}`, type: 'witness', label: trunc(w) }));
    b.caseOverview.charges.forEach((c) => raw.charge.push({ id: `charge:${c.id}`, type: 'charge', label: `${c.code} §${c.section}` }));
    b.elementMatrices.flatMap((m) => m.rows).slice(0, 25).forEach((r, i) => {
      const id = `element:${r.elementId}:${i}`;
      raw.element.push({ id, type: 'element', label: trunc(r.elementLabel) });
      edges.push({ from: `charge:${r.chargeId}`, to: id, relation: 'has element' });
      r.supportingEvidence.forEach((s) => { if (evById.has(s.evidenceId)) edges.push({ from: id, to: `evidence:${s.evidenceId}`, relation: 'supported by' }); });
    });
    b.caseOverview.caseTimeline.slice(0, 18).forEach((t) => raw.timeline.push({ id: `timeline:${t.id}`, type: 'timeline', label: trunc(t.description) }));
    // Investigation tasks that name a witness/element gain a soft link (repository-derived text match only).
    const present = COL.filter((t) => raw[t].length > 0);
    present.forEach((t, ci) => {
      const list = raw[t];
      const rowGap = Math.max(46, Math.min(90, 600 / Math.max(list.length, 1)));
      list.forEach((n, ri) => nodes.push({ ...n, x: 110 + ci * 240, y: 60 + ri * rowGap }));
    });
    // Knowledge-graph edges touching evidence/witness nodes.
    b.evidenceWorkbench.graph.edges.forEach((e) => {
      const find = (gid: string) => raw.witness.find((w) => w.id.endsWith(`:${gid}`))?.id ?? (evById.has(gid) ? `evidence:${gid}` : null);
      const from = find(e.from); const to = find(e.to);
      if (from && to) edges.push({ from, to, relation: e.relation });
    });
    return { nodes, edges };
  }, [b]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNode = selected ? nodeById.get(selected) : null;
  const neighbors = useMemo(() => {
    if (!selectedNode) return [] as Array<{ node: GNode; relation: string }>;
    const out: Array<{ node: GNode; relation: string }> = [];
    edges.forEach((e) => {
      if (e.from === selectedNode.id && nodeById.get(e.to)) out.push({ node: nodeById.get(e.to)!, relation: e.relation });
      else if (e.to === selectedNode.id && nodeById.get(e.from)) out.push({ node: nodeById.get(e.from)!, relation: `← ${e.relation}` });
    });
    return out;
  }, [selectedNode, edges, nodeById]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Building Investigation Command Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const inv = b.investigation;
  const ew = b.evidenceWorkbench;
  const rows = b.elementMatrices.flatMap((m) => m.rows);
  const weakRows = rows.filter((r) => r.status.toLowerCase() !== 'satisfied');
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const outstandingUnknowns = b.caseOverview.outstandingUnknowns?.length ? b.caseOverview.outstandingUnknowns : b.intelligence.unknowns.all;
  const openInvestigation = cc.investigationStatus.open + cc.investigationStatus.inProgress;
  const totalTasks = cc.investigationStatus.open + cc.investigationStatus.inProgress + cc.investigationStatus.completed;
  const completion = totalTasks > 0 ? Math.round((cc.investigationStatus.completed / totalTasks) * 100) : 0;
  const svgW = Math.max(700, COL.filter((t) => nodes.some((n) => n.type === t)).length * 240 + 120);

  const forensic = [...inv.evidenceGaps.map((g) => g.finding).filter((f) => /forensic|dna|lab|test/i.test(f)), ...inv.recommendedDiscovery.filter((d) => /forensic|dna|lab|test/i.test(d))];
  const digital = inv.recommendedDiscovery.filter((d) => /digital|phone|device|video|record|data/i.test(d));
  const sceneItems = ew.items.filter((i) => /photo|scene|image/i.test(i.evidenceType) || /scene|photo/i.test(i.fileName)).map((i) => i.fileName);
  const surveillance = inv.recommendedInvestigation.filter((r) => /surveill|camera|canvas|business|travel/i.test(r));
  const legalResearch = [...b.intelligence.recommendedMotions, ...b.legalAuthority.authorities.map((a) => a.finding)];

  const readiness: Array<{ label: string; score: number; hint: string }> = [
    { label: 'Investigation completion', score: completion, hint: `${cc.investigationStatus.completed}/${totalTasks} tasks` },
    { label: 'Evidence coverage', score: cc.evidenceHealth.score, hint: `${ew.items.length} items` },
    { label: 'CALCRIM support', score: cc.legalCoverage.score, hint: `${rows.length - weakRows.length}/${rows.length} elements` },
    { label: 'Repository confidence', score: repoConfidence, hint: `${cc.unknownCount} UNKNOWN` },
  ];
  const bar = (s: number) => (s >= 75 ? 'bg-emerald-500' : s >= 45 ? 'bg-amber-500' : 'bg-red-500');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Search size={22} className="text-indigo-600" /> Investigation Command Center</h2>
        <p className="text-sm text-gray-500 mt-1">Repository-backed evidence organized into structured investigation planning.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${openInvestigation} open task(s) · ${completion}% complete · confidence ${repoConfidence}%`} /></div>
      </div>

      {/* Mandatory disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not fabricate investigative findings, evidence, or witnesses, and does not recommend litigation strategy.</strong> It organizes repository-derived facts to help identify investigative opportunities for attorney/investigator review. Where the repository does not establish a fact, the result is <strong>UNKNOWN</strong>.</span>
      </div>

      {/* Phase 1 — Investigation Command dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<ClipboardList size={20} />} value={openInvestigation} label="Outstanding tasks" highlight={openInvestigation > 0} />
        <StatCard icon={<Gauge size={20} />} value={`${completion}%`} label="Investigation complete" />
        <StatCard icon={<Boxes size={20} />} value={ew.missing.length} label="Evidence gaps" highlight={ew.missing.length > 0} />
        <StatCard icon={<Users size={20} />} value={inv.witnessGaps.length} label="Witness gaps" highlight={inv.witnessGaps.length > 0} />
        <StatCard icon={<FileText size={20} />} value={inv.recommendedSubpoenas.length} label="Outstanding subpoenas" />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Outstanding human review" highlight={cc.unknownCount > 0} />
      </div>

      {/* Phase 3 — Investigative Leads */}
      <Section icon={<Lightbulb size={18} className="text-amber-600" />} title="Investigative Leads" kind={kindOf(inv.witnessGaps.length + inv.recommendedDiscovery.length + inv.recommendedSubpoenas.length + forensic.length + ew.missing.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding witness interviews</h4>
            <Bullets items={inv.witnessGaps.map((w) => w.finding)} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding document requests / subpoenas</h4>
            <Bullets items={[...inv.recommendedSubpoenas, ...inv.discoveryRequests.map((d) => d.title)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding forensic testing</h4>
            <Bullets items={forensic} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding digital evidence</h4>
            <Bullets items={digital} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding physical evidence</h4>
            <Bullets items={ew.missing} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding investigative questions</h4>
            <Bullets items={[...weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`), ...inv.evidenceGaps.map((g) => g.finding)]} />
          </div>
        </div>
      </Section>

      {/* Priority-ranked tasks */}
      <Section icon={<ClipboardList size={18} className="text-red-600" />} title="Outstanding Investigative Tasks (priority-ranked)" kind={kindOf(inv.tasks.length)}>
        {inv.tasks.length === 0 ? <p className="text-sm text-gray-500">No investigation tasks recorded (UNKNOWN).</p> : (
          <ul className="space-y-1.5">{[...inv.tasks].sort((a, c) => (a.priority > c.priority ? 1 : -1)).map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-1.5">
              <span className="flex items-center gap-2 text-gray-700">{leadIcon(t.title)}{t.title}{t.assignedTo ? <span className="text-gray-400">· {t.assignedTo}</span> : ''}</span>
              <span className="flex items-center gap-2"><span className="text-xs text-gray-400">{t.status}</span><span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{t.priority}</span></span>
            </li>
          ))}</ul>
        )}
      </Section>

      {/* Phase 2 — Scene Intelligence */}
      <Section icon={<MapPin size={18} className="text-blue-600" />} title="Scene Intelligence" kind={kindOf(sceneItems.length + surveillance.length)} note="scene/location detail UNKNOWN unless in repository">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Scene documentation / photographs</h4>
            <Bullets items={sceneItems} empty="No scene photographs established in the repository (UNKNOWN)." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Scene locations</h4>
            <p className="text-sm text-gray-500">Precise scene coordinates are not established by the repository (UNKNOWN) unless attached to evidence metadata.</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Surveillance / business canvass / travel verification</h4>
            <Bullets items={surveillance} empty="No repository-flagged surveillance/canvass leads (UNKNOWN)." />
          </div>
        </div>
      </Section>

      {/* Phase 4 — Investigation Relationship Map */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><Share2 size={16} className="text-purple-600" /> Investigation Relationship Map <span className="text-gray-400">({nodes.length} nodes · {edges.length} edges)</span></span>
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
                        <circle r={isSel ? 11 : 8} fill={NT[n.type].color} stroke="#fff" strokeWidth={1.5} />
                        <text x={13} y={4} fontSize={11} fill="#334155" fontWeight={isSel ? 700 : 400}>{n.label}</text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded bg-white/80 px-2 py-1 text-[10px] text-gray-500">
              {COL.filter((t) => nodes.some((n) => n.type === t)).map((t) => <span key={t} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: NT[t].color }} />{NT[t].label}</span>)}
            </div>
          </div>
          <div className="border-l border-gray-100 p-4">
            {selectedNode ? (
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: NT[selectedNode.type].color }}>{NT[selectedNode.type].label}</span>
                    <h4 className="mt-2 text-sm font-semibold text-gray-900">{selectedNode.label}</h4>
                  </div>
                  <button aria-label="Close" onClick={() => setSelected(null)} className="rounded p-1 hover:bg-gray-100 text-gray-400"><X size={16} /></button>
                </div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Related ({neighbors.length})</h5>
                {neighbors.length === 0 ? <p className="text-sm text-gray-500">No repository relationships (UNKNOWN).</p> : (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {neighbors.map((nb, i) => (
                      <li key={i}><button onClick={() => setSelected(nb.node.id)} className="w-full text-left rounded-md border border-gray-100 px-2 py-1.5 hover:bg-gray-50">
                        <span className="flex items-center gap-1.5 text-sm text-gray-800"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: NT[nb.node.type].color }} />{nb.node.label}</span>
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

      {/* Phase 5 — Investigation Readiness */}
      <Section icon={<Gauge size={18} className="text-indigo-600" />} title="Investigation Readiness" kind="repository">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          {readiness.map((h) => (
            <div key={h.label}>
              <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-700">{h.label}</span><span className="font-medium text-gray-800">{h.score}% <span className="text-xs text-gray-400">({h.hint})</span></span></div>
              <div className="h-2 w-full rounded-full bg-gray-100"><div className={`h-2 rounded-full ${bar(h.score)}`} style={{ width: `${Math.min(100, Math.max(0, h.score))}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-full border border-gray-200 px-2 py-0.5 flex items-center gap-1"><Clock size={11} />Outstanding forensic: {forensic.length}</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 flex items-center gap-1"><ListChecks size={11} />Outstanding legal research: {legalResearch.length}</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 flex items-center gap-1"><ShieldCheck size={11} />Human review: {cc.unknownCount} UNKNOWN</span>
        </div>
      </Section>

      {/* Phase 6 — Investigation Briefing */}
      <Section icon={<ClipboardList size={18} className="text-gray-700" />} title="Investigation Briefing" kind="repository">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm text-gray-700">
            <div><span className="text-gray-500">Case:</span> {b.caseOverview.case.title} (#{b.caseOverview.case.caseNumber}) — {b.caseOverview.case.phase}</div>
            <div><span className="text-gray-500">Charges:</span> {b.caseOverview.charges.length ? b.caseOverview.charges.map((c) => `${c.code} §${c.section}`).join(', ') : 'UNKNOWN'}</div>
            <div><span className="text-gray-500">Investigation:</span> {cc.investigationStatus.completed}/{totalTasks} complete; {openInvestigation} open.</div>
            <div><span className="text-gray-500">Evidence:</span> {b.caseOverview.evidenceSummary.total} item(s); {ew.missing.length} missing.</div>
            <div><span className="text-gray-500">Witnesses:</span> {inv.witnessGaps.length} gap(s) flagged.</div>
            <div><span className="text-gray-500">Repository confidence:</span> {repoConfidence}% ({cc.unknownCount} UNKNOWN)</div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding factual questions</h4>
            <Bullets items={weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`)} empty="No unsupported elements." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding human review</h4>
            {outstandingUnknowns.length === 0 ? <p className="text-sm text-gray-500">No outstanding review items recorded.</p> : (
              <ul className="space-y-1.5">{outstandingUnknowns.map((u, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><HelpCircle size={13} className="mt-0.5 text-gray-400 flex-shrink-0" /><span><input type="checkbox" className="mr-2 align-middle" aria-label="reviewed" />{u}</span></li>)}</ul>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>This briefing organizes repository-derived facts to assist investigation planning. It does not fabricate findings, evidence, or witnesses, and does not recommend litigation strategy. UNKNOWN denotes insufficient repository coverage.</span>
        </div>
      </Section>
    </div>
  );
}
