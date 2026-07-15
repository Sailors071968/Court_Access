// ============================================================================
// Program 128 — Motion Intelligence Center
// Organizes repository-backed litigation information relevant to attorney
// motion practice. CourtAccess NEVER recommends whether to file a motion and
// NEVER asserts motion viability or legal conclusions — it surfaces
// evidence-governed facts an attorney may consider during independent review.
// Repository-backed vs UNKNOWN is labeled via ProvenanceBadge; UNKNOWN wherever
// repository coverage is insufficient.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Gavel, ShieldAlert, FileSearch, CalendarClock, Lock, Boxes, Scale, Landmark,
  ClipboardList, Search, Info, HelpCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');
const kw = (arr: string[], re: RegExp) => arr.filter((s) => re.test(s));

interface MotionCategory {
  id: string;
  label: string;
  icon: typeof Gavel;
  description: string;
  supporting: string[];      // repository-backed information relevant to review
  conflicting: string[];     // repository-backed conflicting information
  factualQuestions: string[];
  evidentiaryQuestions: string[];
  relatedTimeline: string[];
  relatedDocuments: string[];
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
  if (!items.length) return <p className="text-sm text-gray-500">{empty ?? 'No repository information established (UNKNOWN).'}</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{t}</li>)}</ul>;
}

export function MotionIntelligencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('suppression');

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load motion intelligence'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const categories: MotionCategory[] = useMemo(() => {
    if (!b) return [];
    const inv = b.investigation;
    const ew = b.evidenceWorkbench;
    const rows = b.elementMatrices.flatMap((m) => m.rows);
    const weak = rows.filter((r) => r.status.toLowerCase() !== 'satisfied');
    const contradictions = ew.contradictions.map((c) => c.finding);
    const motions = b.intelligence.recommendedMotions;
    const timelineConflicts = b.caseOverview.caseTimeline.filter((t) => t.conflictFlag).map((t) => t.description);
    const docNodes = ew.graph.nodes.filter((n) => /doc|report|record/i.test(n.type)).map((n) => n.label);
    const custodyQuestions = ew.items.map((i) => `Circumstances of collection and chain of custody for "${i.fileName}" are not established in the repository (UNKNOWN).`);
    const lowConfItems = ew.items.filter((i) => /low|unknown/i.test(i.confidence)).map((i) => `Evidentiary reliability of "${i.fileName}" is ${i.confidence} — may warrant further review.`);

    return [
      {
        id: 'suppression', label: 'Suppression', icon: ShieldAlert,
        description: 'Information relevant to review of search, seizure, statements, or identification issues.',
        supporting: [...kw(motions, /suppress|search|seiz|miranda|stop|arrest|warrant|statement|identif/i), ...kw(contradictions, /search|custody|stop|arrest|statement|consent/i)],
        conflicting: [],
        factualQuestions: custodyQuestions,
        evidentiaryQuestions: lowConfItems,
        relatedTimeline: timelineConflicts,
        relatedDocuments: docNodes,
      },
      {
        id: 'discovery', label: 'Discovery', icon: FileSearch,
        description: 'Outstanding discovery, requests, and materials the repository indicates are not yet accounted for.',
        supporting: [...inv.recommendedDiscovery, ...inv.discoveryRequests.map((d) => d.title)],
        conflicting: [],
        factualQuestions: inv.witnessGaps.map((w) => w.finding),
        evidentiaryQuestions: ew.missing,
        relatedTimeline: [],
        relatedDocuments: inv.recommendedSubpoenas,
      },
      {
        id: 'continuance', label: 'Continuance', icon: CalendarClock,
        description: 'Factual status of outstanding work relevant to scheduling review (no recommendation implied).',
        supporting: [
          `${b.commandCenter.discoveryStatus.pending} discovery item(s) pending of ${b.commandCenter.discoveryStatus.total}.`,
          `${b.commandCenter.investigationStatus.open + b.commandCenter.investigationStatus.inProgress} investigation task(s) open/in-progress.`,
          `${ew.missing.length} missing-evidence item(s) noted.`,
        ].filter((s) => !/^0 /.test(s)),
        conflicting: [],
        factualQuestions: inv.recommendedInvestigation,
        evidentiaryQuestions: [],
        relatedTimeline: b.caseOverview.upcomingHearings.map((h) => `${h.date ?? 'UNKNOWN date'}: ${h.note ?? 'hearing'}`),
        relatedDocuments: [],
      },
      {
        id: 'protective', label: 'Protective Orders', icon: Lock,
        description: 'Repository information relevant to review of protective/privacy considerations.',
        supporting: kw(motions, /protective|privacy|seal|redact|confidential/i),
        conflicting: [],
        factualQuestions: inv.witnessGaps.map((w) => w.finding),
        evidentiaryQuestions: [],
        relatedTimeline: [],
        relatedDocuments: docNodes,
      },
      {
        id: 'evidence', label: 'Evidence Issues', icon: Boxes,
        description: 'Contradictions, duplicates, gaps, and unsupported elements relevant to evidentiary review.',
        supporting: [...contradictions, ...ew.duplicates.map((d) => d.reason)],
        conflicting: weak.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`),
        factualQuestions: ew.missing,
        evidentiaryQuestions: lowConfItems,
        relatedTimeline: timelineConflicts,
        relatedDocuments: docNodes,
      },
      {
        id: 'procedural', label: 'Procedural Issues', icon: Scale,
        description: 'Timeline conflicts and procedural status relevant to review.',
        supporting: timelineConflicts,
        conflicting: [],
        factualQuestions: inv.timelineGaps.map((t) => t.finding),
        evidentiaryQuestions: [],
        relatedTimeline: b.caseOverview.caseTimeline.slice(0, 12).map((t) => `${t.timestamp ?? 'UNKNOWN time'}: ${t.description}`),
        relatedDocuments: [],
      },
      {
        id: 'constitutional', label: 'Constitutional Issues', icon: Landmark,
        description: 'Repository-flagged items and authorities relevant to constitutional review.',
        supporting: [...kw(motions, /constitution|due process|speedy|confront|miranda|fourth|fifth|sixth|equal protection/i), ...b.legalAuthority.authorities.map((a) => a.finding)],
        conflicting: [],
        factualQuestions: [],
        evidentiaryQuestions: [],
        relatedTimeline: [],
        relatedDocuments: docNodes,
      },
    ];
  }, [b]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Building Motion Intelligence Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const inv = b.investigation;
  const ew = b.evidenceWorkbench;
  const rows = b.elementMatrices.flatMap((m) => m.rows);
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const active = categories.find((c) => c.id === selected) ?? categories[0];
  const catSignals = (c: MotionCategory) => c.supporting.length + c.conflicting.length + c.factualQuestions.length + c.evidentiaryQuestions.length;
  const flaggedCategories = categories.filter((c) => catSignals(c) > 0);
  const outstandingUnknowns = b.caseOverview.outstandingUnknowns?.length ? b.caseOverview.outstandingUnknowns : b.intelligence.unknowns.all;

  // Phase 3 — Evidence Support Matrix rows.
  const matrix: Array<{ label: string; count: number; sample?: string }> = [
    { label: 'Evidence supporting attorney review', count: ew.items.filter((i) => !/low|unknown/i.test(i.confidence)).length, sample: 'items with established repository confidence' },
    { label: 'Evidence requiring further investigation', count: ew.items.filter((i) => /low|unknown/i.test(i.confidence)).length, sample: 'low/UNKNOWN confidence items' },
    { label: 'Outstanding discovery', count: inv.recommendedDiscovery.length + inv.discoveryRequests.length },
    { label: 'Outstanding subpoenas', count: inv.recommendedSubpoenas.length },
    { label: 'Contradictions', count: cc.contradictionCount },
    { label: 'Missing witnesses', count: inv.witnessGaps.length },
    { label: 'Missing evidence', count: ew.missing.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Gavel size={22} className="text-indigo-600" /> Motion Intelligence Center</h2>
        <p className="text-sm text-gray-500 mt-1">Repository-backed information organized by motion category for attorney review.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${flaggedCategories.length}/${categories.length} categories with repository signals · confidence ${repoConfidence}%`} /></div>
      </div>

      {/* Mandatory non-recommendation disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not recommend whether any motion should or should not be filed</strong> and does not assess motion viability. It organizes evidence-governed, repository-derived facts an attorney may independently review. Where the repository does not establish a fact, the result is <strong>UNKNOWN</strong>. All legal judgment remains with the attorney.</span>
      </div>

      {/* Phase 1/7 — Executive dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Gavel size={20} />} value={flaggedCategories.length} label="Categories flagged for review" />
        <StatCard icon={<Boxes size={20} />} value={ew.items.length} label="Evidence items" />
        <StatCard icon={<Scale size={20} />} value={cc.contradictionCount} label="Contradictions" highlight={cc.contradictionCount > 0} />
        <StatCard icon={<FileSearch size={20} />} value={inv.recommendedDiscovery.length + inv.discoveryRequests.length} label="Outstanding discovery" />
        <StatCard icon={<Gavel size={20} />} value={`${repoConfidence}%`} label="Repository confidence" />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Human review" highlight={cc.unknownCount > 0} />
      </div>

      {/* Phase 4 — Motion Workspace: category selector */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><ClipboardList size={18} className="text-indigo-600" /> Motion Workspace</h3>
          <span className="text-xs text-gray-400">Select a category to review repository-backed information</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const CIcon = c.icon; const on = c.id === selected; const signals = catSignals(c);
            return (
              <button key={c.id} onClick={() => setSelected(c.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
                <CIcon size={13} />{c.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${on ? 'bg-white/20' : signals > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>{signals}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Phase 2 — Motion Analysis for the selected category */}
      <Section icon={<active.icon size={18} className="text-indigo-600" />} title={`Motion Analysis — ${active.label}`} kind={kindOf(catSignals(active))} note={active.description}>
        <p className="text-sm text-gray-500 mb-3">{active.description} <span className="text-amber-700">No filing recommendation is made.</span></p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Repository-backed information relevant to review</h4>
            <Bullets items={active.supporting} empty="No repository information relevant to this category (UNKNOWN)." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Conflicting / limiting information</h4>
            <Bullets items={active.conflicting} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Related documents / reports</h4>
            <Bullets items={active.relatedDocuments} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding factual questions</h4>
            <Bullets items={active.factualQuestions} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding evidentiary questions</h4>
            <Bullets items={active.evidentiaryQuestions} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Related timeline events</h4>
            <Bullets items={active.relatedTimeline} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-full border border-gray-200 px-2 py-0.5">Related charges: {b.caseOverview.charges.length ? b.caseOverview.charges.map((c) => `${c.code} §${c.section}`).join(', ') : 'UNKNOWN'}</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5">Related CALCRIM: {b.offenseAnalysis.flatMap((o) => o.applicableCalcrim).length || 'UNKNOWN'}</span>
        </div>
      </Section>

      {/* Phase 3 — Evidence Support Matrix */}
      <Section icon={<Boxes size={18} className="text-emerald-600" />} title="Evidence Support Matrix" kind={kindOf(matrix.reduce((s, m) => s + m.count, 0))}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Information relevant to review</th>
                <th className="py-2 px-2 text-center">Count</th>
                <th className="py-2 px-2">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((m) => (
                <tr key={m.label} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-700">{m.label}{m.sample && <span className="block text-xs text-gray-400">{m.sample}</span>}</td>
                  <td className="py-2 px-2 text-center font-medium text-gray-800">{m.count}</td>
                  <td className="py-2 px-2"><ProvenanceBadge kind={kindOf(m.count)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Phase 5 — Investigation Impact */}
      <Section icon={<Search size={18} className="text-blue-600" />} title="Investigation Impact" kind={kindOf(inv.recommendedInvestigation.length + inv.witnessGaps.length + inv.tasks.length)} note="additional investigation that could materially affect attorney review">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Additional investigation</h4>
            <Bullets items={inv.recommendedInvestigation} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Potential witnesses / records</h4>
            <Bullets items={[...inv.witnessGaps.map((w) => w.finding), ...inv.recommendedSubpoenas]} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding forensic / digital evidence</h4>
            <Bullets items={[...inv.evidenceGaps.map((g) => g.finding), ...kw(inv.recommendedDiscovery, /digital|forensic|dna|phone|device|record/i)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Priority-ranked tasks</h4>
            {inv.tasks.length === 0 ? <p className="text-sm text-gray-500">No investigation tasks recorded (UNKNOWN).</p> : (
              <ul className="space-y-1.5">{[...inv.tasks].sort((a, c) => (a.priority > c.priority ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm"><span className="text-gray-700">{t.title}</span><span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{t.priority}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
      </Section>

      {/* Phase 6 — Attorney Briefing */}
      <Section icon={<ClipboardList size={18} className="text-gray-700" />} title="Attorney Briefing — Motion Review" kind="repository">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm text-gray-700">
            <div><span className="text-gray-500">Motion review summary:</span> {flaggedCategories.length} of {categories.length} categories have repository-backed information relevant to review ({flaggedCategories.map((c) => c.label).join(', ') || 'none'}).</div>
            <div><span className="text-gray-500">Repository confidence:</span> {repoConfidence}% ({cc.unknownCount} UNKNOWN)</div>
            <div><span className="text-gray-500">Contradictions:</span> {cc.contradictionCount} · <span className="text-gray-500">Unsupported/partial elements:</span> {rows.filter((r) => r.status.toLowerCase() !== 'satisfied').length}</div>
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding legal research topics (for attorney research, not conclusions)</h4>
            <Bullets items={[...b.intelligence.recommendedMotions, ...b.legalAuthority.authorities.map((a) => a.finding)]} empty="No repository-flagged research topics (UNKNOWN)." />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding factual questions & investigation</h4>
            <Bullets items={[...inv.recommendedInvestigation, ...inv.evidenceGaps.map((g) => g.finding)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Human review checklist</h4>
            {outstandingUnknowns.length === 0 ? <p className="text-sm text-gray-500">No outstanding review items recorded.</p> : (
              <ul className="space-y-1.5">{outstandingUnknowns.map((u, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><HelpCircle size={13} className="mt-0.5 text-gray-400 flex-shrink-0" /><span><input type="checkbox" className="mr-2 align-middle" aria-label="reviewed" />{u}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>This briefing organizes repository-derived facts only. It does not assert motion viability or recommend filing. UNKNOWN denotes insufficient repository coverage requiring attorney/records review.</span>
        </div>
      </Section>
    </div>
  );
}
