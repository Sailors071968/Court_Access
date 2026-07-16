// ============================================================================
// Program 126 — Evidence Intelligence Center & Proof Matrix
// Visually organizes every known piece of evidence against every charge and
// every CALCRIM element, composed entirely from the repository-backed Attorney
// Workbench bundle. Constitution-faithful: repository-backed vs UNKNOWN labeled
// via ProvenanceBadge; no evidence, witness testimony, or legal conclusions are
// fabricated. UNKNOWN wherever repository coverage is insufficient.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Boxes, Grid3x3, Share2, ShieldCheck, AlertTriangle, Gauge,
  FileText, Users, Camera, HardDrive, FlaskConical, Clock,
  Loader2, Info, HelpCircle,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle, type ElementRow } from '../../services/workbenchApi';

const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');

function statusClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === 'satisfied' || s === 'supported') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.startsWith('partial')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'unsupported') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-500 border-gray-300';
}

function evidenceTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('photo') || t.includes('image')) return <Camera size={14} className="text-blue-500" />;
  if (t.includes('digital') || t.includes('video') || t.includes('audio')) return <HardDrive size={14} className="text-purple-500" />;
  if (t.includes('forensic') || t.includes('dna') || t.includes('lab')) return <FlaskConical size={14} className="text-pink-500" />;
  if (t.includes('witness') || t.includes('testimony')) return <Users size={14} className="text-emerald-500" />;
  return <FileText size={14} className="text-gray-500" />;
}

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
  if (!items.length) return <p className="text-sm text-gray-500">{empty ?? 'None identified from current repository coverage (UNKNOWN).'}</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{t}</li>)}</ul>;
}

export function EvidenceIntelligencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load evidence intelligence'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const items = b?.evidenceWorkbench.items ?? [];
  const itemById = useMemo(() => new Map(items.map((i) => [i.evidenceId, i])), [items]);
  const rows: ElementRow[] = useMemo(() => (b?.elementMatrices ?? []).flatMap((m) => m.rows), [b]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.evidenceType || 'unknown', (map.get(it.evidenceType || 'unknown') ?? 0) + 1);
    return [...map.entries()].sort((a, c) => c[1] - a[1]);
  }, [items]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Building Evidence Intelligence Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const ew = b.evidenceWorkbench;
  const inv = b.investigation;
  const graphNodes = ew.graph.nodes;
  const graphEdges = ew.graph.edges;
  const witnessNodes = graphNodes.filter((n) => n.type.toLowerCase().includes('witness'));
  const docNodes = graphNodes.filter((n) => /doc|report|record/i.test(n.type));
  const weakRows = rows.filter((r) => r.status.toLowerCase() !== 'satisfied' && r.status.toLowerCase() !== 'supported');
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);

  // Proof strength: share of elements with any supporting evidence.
  const supportedCount = rows.filter((r) => r.supportingEvidence.length > 0).length;
  const proofStrength = rows.length ? Math.round((supportedCount / rows.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Boxes size={22} className="text-indigo-600" /> Evidence Intelligence Center</h2>
        <p className="text-sm text-gray-500 mt-1">Every known piece of evidence mapped against every charge and CALCRIM element.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${items.length} evidence items · ${rows.length} elements · confidence ${repoConfidence}%`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Every relationship below is derived from repository coverage. Where the repository does not establish a fact (e.g. chain-of-custody transfers), the result is <strong>UNKNOWN</strong> — no evidence, testimony, or legal conclusion is fabricated.</span>
      </div>

      {/* Phase 6 — Evidence Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Boxes size={20} />} value={items.length} label="Evidence items" />
        <StatCard icon={<Gauge size={20} />} value={`${cc.legalCoverage.score}%`} label="CALCRIM coverage" />
        <StatCard icon={<ShieldCheck size={20} />} value={`${proofStrength}%`} label="Proof strength" />
        <StatCard icon={<Users size={20} />} value={witnessNodes.length} label="Witnesses (graph)" />
        <StatCard icon={<Grid3x3 size={20} />} value={`${cc.evidenceHealth.score}%`} label="Evidence health" />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Outstanding UNKNOWN" highlight={cc.unknownCount > 0} />
      </div>

      {/* Phase 2 — Proof Matrix */}
      <Section icon={<Grid3x3 size={18} className="text-indigo-600" />} title="Proof Matrix — CALCRIM Elements × Support" kind={kindOf(rows.length)} note={`${supportedCount}/${rows.length} elements with supporting evidence`}>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No CALCRIM elements available for the charges on this case (UNKNOWN). Add charges with repository-backed CALCRIM coverage to populate the matrix.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Charge / Element</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2 text-center">Evidence</th>
                  <th className="py-2 px-2 text-center">Witnesses</th>
                  <th className="py-2 px-2 text-center">Documents</th>
                  <th className="py-2 px-2 text-center">Conflicts</th>
                  <th className="py-2 px-2 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const sup = r.supportingEvidence;
                  const witnessSup = sup.filter((s) => itemById.get(s.evidenceId)?.evidenceType?.toLowerCase().includes('witness') || /witness/i.test(s.role)).length;
                  const docSup = sup.filter((s) => /doc|report|record/i.test(itemById.get(s.evidenceId)?.evidenceType ?? '') || /doc|report/i.test(s.role)).length;
                  return (
                    <tr key={`${r.elementId}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-800">{r.code} §{r.section}</div>
                        <div className="text-xs text-gray-500">{r.elementLabel}</div>
                      </td>
                      <td className="py-2 px-2 text-center"><span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusClasses(r.status)}`}>{r.status}</span></td>
                      <td className="py-2 px-2 text-center text-gray-700">{sup.length || <span className="text-gray-400">—</span>}</td>
                      <td className="py-2 px-2 text-center text-gray-700">{witnessSup || <span className="text-gray-400">—</span>}</td>
                      <td className="py-2 px-2 text-center text-gray-700">{docSup || <span className="text-gray-400">—</span>}</td>
                      <td className="py-2 px-2 text-center">{r.contradictoryEvidence.length ? <span className="text-red-600 font-medium">{r.contradictoryEvidence.length}</span> : <span className="text-gray-400">—</span>}</td>
                      <td className="py-2 px-2 text-center text-xs text-gray-500">{r.confidence}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Phase 1 — Evidence Inventory + categories + strength */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Section icon={<Boxes size={18} className="text-indigo-600" />} title="Evidence Inventory" kind={kindOf(items.length)}>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">No evidence items in the repository for this case (UNKNOWN).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 px-2">Category</th>
                      <th className="py-2 px-2">Processing</th>
                      <th className="py-2 px-2 text-center">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.evidenceId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-3 font-medium text-gray-800 flex items-center gap-2">{evidenceTypeIcon(it.evidenceType)}{it.fileName}</td>
                        <td className="py-2 px-2 text-gray-600">{it.evidenceType || 'UNKNOWN'}</td>
                        <td className="py-2 px-2 text-gray-600">{it.processingStatus}</td>
                        <td className="py-2 px-2 text-center text-xs text-gray-500">{it.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
        <Section icon={<Grid3x3 size={18} className="text-indigo-600" />} title="Evidence Categories" kind={kindOf(categories.length)}>
          {categories.length === 0 ? <p className="text-sm text-gray-500">No categories (UNKNOWN).</p> : (
            <ul className="space-y-2">
              {categories.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700">{evidenceTypeIcon(type)}{type}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Phase 3 — Evidence Relationships (Knowledge Graph) */}
      <Section icon={<Share2 size={18} className="text-purple-600" />} title="Evidence Relationships (Knowledge Graph)" kind={kindOf(graphEdges.length)} note={`${graphNodes.length} nodes · ${graphEdges.length} edges`}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Related witnesses</h4>
            <Bullets items={witnessNodes.map((n) => n.label)} empty="No witness nodes in the graph (UNKNOWN)." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Related documents / reports</h4>
            <Bullets items={docNodes.map((n) => n.label)} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Relationships</h4>
            {graphEdges.length === 0 ? <p className="text-sm text-gray-500">No repository relationships established (UNKNOWN).</p> : (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {graphEdges.slice(0, 60).map((e, i) => {
                  const from = graphNodes.find((n) => n.id === e.from)?.label ?? e.from;
                  const to = graphNodes.find((n) => n.id === e.to)?.label ?? e.to;
                  return <li key={i} className="text-sm text-gray-700"><span className="font-medium">{from}</span> <span className="text-gray-400">— {e.relation} →</span> <span className="font-medium">{to}</span></li>;
                })}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {/* Phase 4 — Chain of Custody */}
      <Section icon={<Clock size={18} className="text-emerald-600" />} title="Chain of Custody" kind={kindOf(items.length)} note="collection/transfer detail is UNKNOWN unless in repository">
        {items.length === 0 ? <p className="text-sm text-gray-500">No evidence to track (UNKNOWN).</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 px-2">Repository status</th>
                  <th className="py-2 px-2">Collection</th>
                  <th className="py-2 px-2">Transfers</th>
                  <th className="py-2 px-2">Storage</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.evidenceId} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{it.fileName}</td>
                    <td className="py-2 px-2 text-gray-600">{it.processingStatus}</td>
                    <td className="py-2 px-2 text-gray-400">UNKNOWN</td>
                    <td className="py-2 px-2 text-gray-400">UNKNOWN</td>
                    <td className="py-2 px-2 text-gray-400">UNKNOWN</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-400">Chain-of-custody collection, transfer, and storage events are not established by the current repository and are reported as UNKNOWN pending attorney/records review.</p>
          </div>
        )}
      </Section>

      {/* Phase 5 — Proof Gaps */}
      <Section icon={<AlertTriangle size={18} className="text-amber-600" />} title="Proof Gaps & Investigation Priorities" kind={kindOf(ew.missing.length + inv.evidenceGaps.length + inv.witnessGaps.length + weakRows.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Unsupported / partial elements</h4>
            <Bullets items={weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel} (${r.status})`)} empty="All repository elements are supported." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Missing evidence</h4>
            <Bullets items={ew.missing} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Missing witnesses</h4>
            <Bullets items={inv.witnessGaps.map((w) => w.finding)} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding subpoenas</h4>
            <Bullets items={inv.recommendedSubpoenas} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding discovery / forensic</h4>
            <Bullets items={[...inv.recommendedDiscovery, ...inv.evidenceGaps.map((g) => g.finding)]} />
          </div>
        </div>
      </Section>
    </div>
  );
}
