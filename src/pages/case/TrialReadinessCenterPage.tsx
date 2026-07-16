// ============================================================================
// Program 130 — Trial Readiness Center
// Unifies every existing CourtAccess intelligence engine into a single
// courtroom-preparation workflow, built from the repository-backed Attorney
// Workbench bundle. CourtAccess NEVER determines guilt, predicts verdicts, or
// recommends trial strategy — it organizes repository facts to assist attorney
// preparation. Repository / UNKNOWN / Illustrative labeled via ProvenanceBadge;
// UNKNOWN wherever repository coverage is insufficient. Nothing is fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Landmark, ClipboardCheck, Users, Boxes, Clock, ClipboardList, Gauge, ShieldCheck,
  ListChecks, FileText, Camera, HardDrive, FlaskConical, Info, HelpCircle, Loader2, AlertTriangle,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { ProvenanceBadge, type Provenance } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const kindOf = (n: number): Provenance => (n > 0 ? 'repository' : 'unknown');

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
function Checklist({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-gray-500">None outstanding from current repository coverage.</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1 flex-shrink-0" aria-label="done" />{t}</li>)}</ul>;
}
function exhibitIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('photo') || t.includes('image')) return <Camera size={14} className="text-blue-500" />;
  if (t.includes('digital') || t.includes('video') || t.includes('audio')) return <HardDrive size={14} className="text-purple-500" />;
  if (t.includes('forensic') || t.includes('dna') || t.includes('lab')) return <FlaskConical size={14} className="text-pink-500" />;
  return <FileText size={14} className="text-gray-500" />;
}

const TIMELINE_FILTERS = ['all', 'conflicts'] as const;
type TimelineFilter = typeof TIMELINE_FILTERS[number];

export function TrialReadinessCenterPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [b, setB] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tlFilter, setTlFilter] = useState<TimelineFilter>('all');

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const bundle = await fetchWorkbench(caseId); if (!cancelled) setB(bundle); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load trial readiness center'); }
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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Building Trial Readiness Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const inv = b.investigation;
  const ew = b.evidenceWorkbench;
  const rows = b.elementMatrices.flatMap((m) => m.rows);
  const weakRows = rows.filter((r) => r.status.toLowerCase() !== 'satisfied');
  const supported = rows.filter((r) => r.supportingEvidence.length > 0).length;
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const outstandingUnknowns = b.caseOverview.outstandingUnknowns?.length ? b.caseOverview.outstandingUnknowns : b.intelligence.unknowns.all;
  const contradictions = ew.contradictions.map((c) => c.finding);

  const timeline = b.caseOverview.caseTimeline.filter((t) => (tlFilter === 'conflicts' ? t.conflictFlag : true));

  // Pretrial checklist groups.
  const evidenceRequired = [...ew.missing, ...inv.evidenceGaps.map((g) => g.finding)];
  const witnessInterview = inv.witnessGaps.map((w) => w.finding);
  const forensic = [...inv.evidenceGaps.map((g) => g.finding).filter((f) => /forensic|dna|lab|test/i.test(f)), ...inv.recommendedDiscovery.filter((d) => /forensic|dna|lab|test/i.test(d))];
  const legalResearch = [...b.intelligence.recommendedMotions, ...b.legalAuthority.authorities.map((a) => a.finding)];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Landmark size={22} className="text-indigo-600" /> Trial Readiness Center</h2>
        <p className="text-sm text-gray-500 mt-1">Every intelligence engine organized into one courtroom-preparation workflow.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`trial readiness ${cc.trialReadiness.score}% · confidence ${repoConfidence}%`} /></div>
      </div>

      {/* Mandatory disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not determine guilt, predict verdicts, or recommend trial strategy.</strong> The readiness metrics and checklists below organize repository-derived facts to assist attorney preparation. Where the repository does not establish a fact, the result is <strong>UNKNOWN</strong>. All legal judgment remains with the attorney.</span>
      </div>

      {/* Phase 1 — Trial Readiness Center dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Landmark size={20} />} value={`${cc.trialReadiness.score}%`} label={`Trial readiness (${cc.trialReadiness.label})`} />
        <StatCard icon={<Gauge size={20} />} value={`${cc.caseHealth.score}%`} label="Case readiness" />
        <StatCard icon={<ShieldCheck size={20} />} value={`${repoConfidence}%`} label="Repository confidence" />
        <StatCard icon={<Boxes size={20} />} value={`${cc.evidenceHealth.score}%`} label="Evidence coverage" />
        <StatCard icon={<ListChecks size={20} />} value={`${cc.legalCoverage.score}%`} label="CALCRIM coverage" />
        <StatCard icon={<Users size={20} />} value={witnesses.length} label="Witness coverage" />
        <StatCard icon={<ClipboardList size={20} />} value={cc.investigationStatus.open + cc.investigationStatus.inProgress} label="Outstanding investigation" highlight={(cc.investigationStatus.open + cc.investigationStatus.inProgress) > 0} />
        <StatCard icon={<FileText size={20} />} value={cc.discoveryStatus.pending} label="Outstanding discovery" highlight={cc.discoveryStatus.pending > 0} />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Outstanding human review" highlight={cc.unknownCount > 0} />
        <StatCard icon={<AlertTriangle size={20} />} value={cc.contradictionCount} label="Contradictions" highlight={cc.contradictionCount > 0} />
        <StatCard icon={<ListChecks size={20} />} value={`${supported}/${rows.length}`} label="Elements supported" />
        <StatCard icon={<ClipboardCheck size={20} />} value={weakRows.length} label="Elements to resolve" highlight={weakRows.length > 0} />
      </div>

      {/* Phase 2 — Pretrial Checklist */}
      <Section icon={<ClipboardCheck size={18} className="text-emerald-600" />} title="Pretrial Checklist" kind={kindOf(evidenceRequired.length + witnessInterview.length + inv.recommendedSubpoenas.length + inv.recommendedDiscovery.length + legalResearch.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Evidence still required</h4>
            <Checklist items={evidenceRequired} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Witnesses requiring interview</h4>
            <Checklist items={witnessInterview} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Witnesses requiring preparation</h4>
            <Checklist items={witnesses.map((w) => w.name)} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding subpoenas</h4>
            <Checklist items={inv.recommendedSubpoenas} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding discovery</h4>
            <Checklist items={[...inv.recommendedDiscovery, ...inv.discoveryRequests.map((d) => d.title)]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding forensic analysis</h4>
            <Checklist items={forensic} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding legal research (topics, not conclusions)</h4>
            <Checklist items={legalResearch} />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">Repository confidence: {repoConfidence}% · {cc.unknownCount} UNKNOWN. Checklist items derive from repository coverage; completeness remains attorney judgment.</p>
      </Section>

      {/* Phase 3 — Witness Preparation Center */}
      <Section icon={<Users size={18} className="text-blue-600" />} title="Witness Preparation Center" kind={kindOf(witnesses.length)}>
        {witnesses.length === 0 ? <p className="text-sm text-gray-500">No witnesses established in the repository (UNKNOWN).</p> : (
          <div className="space-y-3">
            {witnesses.map((w, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Users size={14} className="text-blue-500" />{w.name}</h4>
                  <span className="text-xs text-gray-400">{w.detail || 'UNKNOWN role'}</span>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-2 text-xs">
                  <div><span className="text-gray-500">Potential impeachment</span><Bullets items={b.trialPreparation.impeachmentOpportunities.map((x) => x.title)} empty="None (UNKNOWN)." /></div>
                  <div><span className="text-gray-500">Related contradictions</span><Bullets items={contradictions} empty="None detected (UNKNOWN)." /></div>
                  <div><span className="text-gray-500">Outstanding interview topics</span><Bullets items={witnessInterview} empty="None (UNKNOWN)." /></div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400">Witness-specific evidence/CALCRIM/timeline linkage is shown where the repository establishes it; otherwise UNKNOWN. CourtAccess does not script testimony.</p>
          </div>
        )}
      </Section>

      {/* Phase 4 — Exhibit Organizer */}
      <Section icon={<Boxes size={18} className="text-emerald-600" />} title="Exhibit Organizer" kind={kindOf(ew.items.length)} note="chain of custody UNKNOWN unless in repository">
        {ew.items.length === 0 ? <p className="text-sm text-gray-500">No evidence items in the repository (UNKNOWN).</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Exhibit</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2">Processing</th>
                  <th className="py-2 px-2">Chain of custody</th>
                  <th className="py-2 px-2 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {ew.items.map((it) => (
                  <tr key={it.evidenceId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-800 flex items-center gap-2">{exhibitIcon(it.evidenceType)}{it.fileName}</td>
                    <td className="py-2 px-2 text-gray-600">{it.evidenceType || 'UNKNOWN'}</td>
                    <td className="py-2 px-2 text-gray-600">{it.processingStatus}</td>
                    <td className="py-2 px-2 text-gray-400">UNKNOWN</td>
                    <td className="py-2 px-2 text-center text-xs text-gray-500">{it.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-400">Knowledge Graph: {ew.graph.nodes.length} nodes / {ew.graph.edges.length} edges. Chain-of-custody events are not established by the repository and are reported UNKNOWN pending records review.</p>
          </div>
        )}
      </Section>

      {/* Phase 5 — Courtroom Timeline */}
      <Section icon={<Clock size={18} className="text-cyan-600" />} title="Courtroom Timeline" kind={kindOf(b.caseOverview.caseTimeline.length)}>
        <div className="flex items-center gap-2 mb-3">
          {TIMELINE_FILTERS.map((f) => (
            <button key={f} onClick={() => setTlFilter(f)} className={`rounded-full border px-3 py-1 text-xs font-medium ${tlFilter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>{f === 'all' ? 'All events' : 'Conflicts only'}</button>
          ))}
          <span className="text-xs text-gray-400">{timeline.length} event(s)</span>
        </div>
        {timeline.length === 0 ? <p className="text-sm text-gray-500">No timeline events{tlFilter === 'conflicts' ? ' with conflicts' : ''} (UNKNOWN).</p> : (
          <ol className="relative border-l border-gray-200 ml-2 space-y-3">
            {timeline.map((t) => (
              <li key={t.id} className="ml-4">
                <span className={`absolute -left-1.5 h-3 w-3 rounded-full ${t.conflictFlag ? 'bg-red-500' : 'bg-indigo-400'}`} />
                <div className="text-xs text-gray-400">{t.timestamp ?? 'UNKNOWN time'}{t.actor ? ` · ${t.actor}` : ''}</div>
                <div className="text-sm text-gray-700">{t.description}{t.conflictFlag && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 border border-red-200">conflict</span>}</div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Phase 6 — Executive Trial Briefing */}
      <Section icon={<ClipboardList size={18} className="text-gray-700" />} title="Executive Trial Briefing" kind="repository">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm text-gray-700">
            <div><span className="text-gray-500">Case:</span> {b.caseOverview.case.title} (#{b.caseOverview.case.caseNumber}) — {b.caseOverview.case.phase}</div>
            <div><span className="text-gray-500">Charges:</span> {b.caseOverview.charges.length ? b.caseOverview.charges.map((c) => `${c.code} §${c.section}`).join(', ') : 'UNKNOWN'}</div>
            <div><span className="text-gray-500">Repository confidence:</span> {repoConfidence}% ({cc.unknownCount} UNKNOWN)</div>
            <div><span className="text-gray-500">Case theory:</span> {supported}/{rows.length} elements supported; {weakRows.length} not fully established; {cc.contradictionCount} contradiction(s).</div>
            <div><span className="text-gray-500">Motion review:</span> {b.intelligence.recommendedMotions.length} repository-flagged research topic(s).</div>
            <div><span className="text-gray-500">CALCRIM:</span> {cc.legalCoverage.score}% coverage ({cc.legalCoverage.offensesCovered}/{cc.legalCoverage.offensesTotal}).</div>
            <div><span className="text-gray-500">Evidence:</span> {b.caseOverview.evidenceSummary.total} item(s), {b.caseOverview.evidenceSummary.processingPending} pending.</div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Outstanding factual questions</h4>
            <Bullets items={weakRows.map((r) => `${r.code} §${r.section} — ${r.elementLabel}: ${r.status}`)} empty="No unsupported elements." />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding investigation & legal research</h4>
            <Bullets items={[...inv.recommendedInvestigation, ...legalResearch]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Outstanding human review</h4>
            <Checklist items={outstandingUnknowns} />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>This briefing organizes repository-derived facts to assist preparation. It does not determine guilt, predict a verdict, or recommend trial strategy. UNKNOWN denotes insufficient repository coverage requiring attorney review.</span>
        </div>
      </Section>
    </div>
  );
}
