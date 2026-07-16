// ============================================================================
// Program 124 — Criminal Defense Intelligence Engine
// Organizes repository-backed litigation intelligence (Attorney Workbench
// bundle) into attorney work product: Element Support Matrix, Evidence Gap
// Analysis, Defense Knowledge, Investigation Planner, Trial Preparation, and an
// Attorney Briefing. Constitution-faithful — repository-backed vs illustrative
// are labeled separately; UNKNOWN wherever repository evidence is insufficient.
// No defense theories, legal conclusions, or case outcomes are fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck, Grid3x3, FileWarning, Gavel, Search, Scale, ClipboardList,
  Loader2, Info, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

function statusMeta(status: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('satisf') || s.includes('support') && !s.includes('unsupport') && !s.includes('partial')) return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2, label: 'SUPPORTED' };
  if (s.includes('partial')) return { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle, label: 'PARTIAL' };
  if (s.includes('unsupported') || s.includes('missing')) return { cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle, label: 'UNSUPPORTED' };
  return { cls: 'bg-gray-100 text-gray-600 border-gray-300', Icon: HelpCircle, label: 'UNKNOWN' };
}

function Section({ icon, title, kind, note, children }: { icon: React.ReactNode; title: string; kind: 'repository' | 'unknown' | 'illustrative'; note?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">{icon} {title}</h3>
        <ProvenanceBadge kind={kind} note={note} />
      </div>
      {children}
    </Card>
  );
}

function List({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">{empty ?? 'None identified from current repository coverage (UNKNOWN).'}</p>;
  return <ul className="space-y-2">{items.map((it, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{it}</li>)}</ul>;
}

export function DefenseIntelligencePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [bundle, setBundle] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try { const b = await fetchWorkbench(caseId); if (!cancelled) setBundle(b); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load defense intelligence'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const data = useMemo(() => {
    if (!bundle) return null;
    const rows = bundle.elementMatrices.flatMap((m) => m.rows);
    const defenses = [...bundle.offenseAnalysis.flatMap((o) => o.defenses), ...bundle.legalAuthority.defenses];
    const exceptions = [...bundle.offenseAnalysis.flatMap((o) => o.exceptions), ...bundle.legalAuthority.exceptions];
    const enhancements = [...bundle.offenseAnalysis.flatMap((o) => o.enhancements), ...bundle.legalAuthority.enhancements];
    return { rows, defenses, exceptions, enhancements };
  }, [bundle]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Assembling defense intelligence…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!bundle || !data) return null;

  const cc = bundle.commandCenter;
  const inv = bundle.investigation;
  const tp = bundle.trialPreparation;
  const co = bundle.caseOverview;
  const outstandingIssues = co.outstandingUnknowns?.length ? co.outstandingUnknowns : bundle.intelligence.unknowns.all;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={22} className="text-emerald-600" /> Defense Intelligence</h2>
        <p className="text-sm text-gray-500 mt-1">Repository-backed litigation intelligence organized into attorney work product.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${co.charges.length} charges · ${co.evidenceSummary.total} evidence`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>This is evidence-governed work product, not legal advice. Findings are derived from repository coverage; where the repository is insufficient, the result is <strong>UNKNOWN</strong>. Statutory defenses/exceptions appear only when present in the legislative repository. All items require independent attorney review.</span>
      </div>

      {/* Attorney Briefing (Phase 7) */}
      <Section icon={<ClipboardList size={18} className="text-indigo-600" />} title="Attorney Briefing" kind="repository">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1 text-gray-700">
            <div><span className="text-gray-500">Case:</span> {co.case.title} (#{co.case.caseNumber})</div>
            <div><span className="text-gray-500">Charges:</span> {co.charges.length ? co.charges.map((c) => `${c.code} §${c.section}`).join(', ') : 'UNKNOWN'}</div>
            <div><span className="text-gray-500">Repository confidence:</span> {cc.unknownCount === 0 ? '100%' : `${Math.max(0, 100 - cc.unknownCount * 10)}% (${cc.unknownCount} UNKNOWN)`}</div>
            <div><span className="text-gray-500">CALCRIM coverage:</span> {cc.legalCoverage.score}% ({cc.legalCoverage.offensesCovered}/{cc.legalCoverage.offensesTotal} offenses)</div>
            <div><span className="text-gray-500">Evidence:</span> {co.evidenceSummary.total} items ({co.evidenceSummary.processingPending} pending)</div>
          </div>
          <div className="space-y-1 text-gray-700">
            <div><span className="text-gray-500">Contradictions:</span> {cc.contradictionCount}</div>
            <div><span className="text-gray-500">Motion opportunities:</span> {cc.motionOpportunities}</div>
            <div><span className="text-gray-500">Open investigation:</span> {cc.investigationStatus.open + cc.investigationStatus.inProgress}</div>
            <div><span className="text-gray-500">Outstanding human review:</span> {outstandingIssues.length} items</div>
            <div><span className="text-gray-500">Trial readiness:</span> {cc.trialReadiness.score}% ({cc.trialReadiness.label})</div>
          </div>
        </div>
      </Section>

      {/* Element Support Matrix (Phase 2) */}
      <Section icon={<Grid3x3 size={18} className="text-indigo-600" />} title="Element Support Matrix" kind={data.rows.some((r) => r.status.toLowerCase() !== 'unknown') ? 'repository' : 'unknown'}>
        {data.rows.length === 0 ? (
          <p className="text-sm text-gray-500">No offense elements in current repository coverage (UNKNOWN — no charges mapped or charge not in the legislative repository).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Charge</th><th className="py-2 pr-3">Element</th><th className="py-2 pr-3">Support</th><th className="py-2 pr-3">Evidence</th><th className="py-2">Confidence</th>
              </tr></thead>
              <tbody>
                {data.rows.map((r, i) => { const m = statusMeta(r.status); return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">{r.code} §{r.section}</td>
                    <td className="py-2 pr-3 text-gray-900">{r.elementLabel}</td>
                    <td className="py-2 pr-3"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}><m.Icon size={11} /> {m.label}</span></td>
                    <td className="py-2 pr-3 text-gray-500">{r.supportingEvidence.length} / {r.contradictoryEvidence.length}✗</td>
                    <td className="py-2 text-gray-500">{r.confidence || 'UNKNOWN'}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-400">Evidence column: supporting / contradictory count.</p>
          </div>
        )}
      </Section>

      {/* Evidence Gap Analysis (Phase 3) */}
      <div className="grid md:grid-cols-2 gap-4">
        <Section icon={<FileWarning size={18} className="text-amber-600" />} title="Evidence Gaps" kind={inv.evidenceGaps.length || bundle.evidenceWorkbench.missing.length ? 'repository' : 'unknown'}>
          <List items={[...inv.evidenceGaps.map((g) => g.finding), ...bundle.evidenceWorkbench.missing]} />
        </Section>
        <Section icon={<Search size={18} className="text-blue-600" />} title="Outstanding Discovery & Subpoenas" kind={inv.recommendedDiscovery.length || inv.recommendedSubpoenas.length ? 'repository' : 'unknown'}>
          <List items={[...inv.recommendedSubpoenas.map((s) => `Subpoena: ${s}`), ...inv.recommendedDiscovery.map((d) => `Discovery: ${d}`)]} />
        </Section>
      </div>

      {/* Defense Knowledge (Phase 4) */}
      <div className="grid md:grid-cols-3 gap-4">
        <Section icon={<Gavel size={18} className="text-purple-600" />} title="Statutory Defenses" kind={data.defenses.length ? 'repository' : 'unknown'}>
          <List items={data.defenses} />
        </Section>
        <Section icon={<Scale size={18} className="text-indigo-600" />} title="Exceptions / Immunities" kind={data.exceptions.length ? 'repository' : 'unknown'}>
          <List items={data.exceptions} />
        </Section>
        <Section icon={<AlertTriangle size={18} className="text-orange-600" />} title="Enhancements" kind={data.enhancements.length ? 'repository' : 'unknown'}>
          <List items={data.enhancements} />
        </Section>
      </div>

      {/* Investigation Planner (Phase 5) */}
      <Section icon={<Search size={18} className="text-blue-600" />} title="Investigation Planner" kind={inv.witnessGaps.length || inv.recommendedInvestigation.length || inv.tasks.length ? 'repository' : 'unknown'}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Witnesses to interview</h4>
            <List items={[...inv.witnessGaps.map((w) => w.finding), ...inv.recommendedInvestigation]} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Priority-ranked tasks</h4>
            {inv.tasks.length === 0 ? <p className="text-sm text-gray-500">No investigation tasks recorded.</p> : (
              <ul className="space-y-1.5">{[...inv.tasks].sort((a, b) => (a.priority > b.priority ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm"><span className="text-gray-700">{t.title}</span><span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{t.priority}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
      </Section>

      {/* Trial Preparation (Phase 6) */}
      <Section icon={<ShieldCheck size={18} className="text-emerald-600" />} title="Trial Preparation" kind={tp.witnessList.length || tp.impeachmentOpportunities.length || tp.crossExaminationTopics.length ? 'repository' : 'unknown'}>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-1">Witness list</h4>
            <List items={tp.witnessList.map((w) => w.title)} empty="No witnesses listed (UNKNOWN)." />
            <h4 className="font-medium text-gray-800 mb-1 mt-3">Cross-examination topics</h4>
            <List items={tp.crossExaminationTopics.map((t) => t.title)} empty="None (UNKNOWN)." />
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">Impeachment opportunities</h4>
            <List items={tp.impeachmentOpportunities.map((t) => `${t.title}${t.detail ? ` — ${t.detail}` : ''}`)} empty="None identified (UNKNOWN)." />
            <div className="mt-3 rounded-lg border border-gray-200 p-3">
              <div className="text-gray-500 text-xs">CALCRIM readiness</div>
              <div className="text-gray-900 font-medium">{cc.legalCoverage.score}% ({cc.legalCoverage.offensesCovered}/{cc.legalCoverage.offensesTotal} offenses covered)</div>
              <div className="mt-1 text-gray-500 text-xs">Exhibits: {tp.exhibitList.length} · Trial notebook entries: {tp.trialNotebook.length}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Outstanding human review */}
      <Section icon={<HelpCircle size={18} className="text-gray-500" />} title="Outstanding Human Review" kind={outstandingIssues.length ? 'repository' : 'unknown'}>
        <List items={outstandingIssues} empty="No outstanding review items recorded." />
      </Section>
    </div>
  );
}
