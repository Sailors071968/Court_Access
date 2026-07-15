// ============================================================================
// Program 120 — Litigation Strategy Center
// The unified, flagship attorney workspace. It integrates the existing
// intelligence engines (Attorney Workbench bundle) into one executive briefing
// that answers: "What should I do next to improve this case?"
// It does NOT duplicate the engines — it composes their repository-backed
// output. Constitution-faithful: repository-backed vs illustrative are labeled
// separately; UNKNOWN wherever repository coverage is incomplete. No legal
// conclusions, recommendations, or repository intelligence are fabricated.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Gauge, ListChecks, ShieldCheck, Search, CalendarClock, Loader2, Info,
  AlertTriangle, HelpCircle, ArrowRight, Target,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

type Priority = 'Highest' | 'High' | 'Medium' | 'Low';
interface StrategyTask {
  priority: Priority;
  title: string;
  why: string;
  charge?: string;
  element?: string;
  value: string;
  ref: string;
}

const PRIORITY_ORDER: Priority[] = ['Highest', 'High', 'Medium', 'Low'];
const PRIORITY_TONE: Record<Priority, string> = {
  Highest: 'bg-red-50 text-red-700 border-red-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-gray-100 text-gray-600 border-gray-300',
};

const ILLUSTRATIVE_TASKS: StrategyTask[] = [
  { priority: 'Highest', title: 'Obtain surveillance covering the entry window', why: 'The prosecution cannot place the defendant inside the structure; a camera gap (02:10–02:45) is dispositive.', charge: 'PC §459', element: 'Entry into a building', value: 'High — may negate an element', ref: 'Illustrative' },
  { priority: 'High', title: 'Interview the corner-store clerk', why: 'A witness 40 ft from the scene may corroborate or contradict identity.', charge: 'PC §459', element: 'Identity', value: 'High — impeachment/alibi', ref: 'Illustrative' },
  { priority: 'Medium', title: 'Subpoena cell-site records', why: 'Verify travel-time feasibility for the alleged window.', charge: 'PC §459', value: 'Medium — timeline', ref: 'Illustrative' },
];

function Bar({ label, score, note }: { label: string; score: number; note?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const tone = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{pct}%{note ? ` · ${note}` : ''}</span></div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Metric({ label, value, sub, kind }: { label: string; value: string | number; sub?: string; kind?: 'repository' | 'unknown' }) {
  return (
    <Card padding="sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{label}</span>
          {kind && <ProvenanceBadge kind={kind} />}
        </div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </Card>
  );
}

export function LitigationStrategyCenterPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [bundle, setBundle] = useState<WorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const b = await fetchWorkbench(caseId);
        if (!cancelled) setBundle(b);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load strategy center');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const derived = useMemo(() => {
    if (!bundle) return null;
    const cc = bundle.commandCenter;
    const rows = bundle.elementMatrices.flatMap((m) => m.rows);
    const mensReaRows = rows.filter((r) => /intent|knowledge|mens|willful|malic|reckless|negligen/i.test(r.elementLabel));
    const mensReaSatisfied = mensReaRows.filter((r) => r.status.toLowerCase().includes('satisf')).length;
    const witnessCount = bundle.trialPreparation.witnessList.length;
    const invTotal = cc.investigationStatus.open + cc.investigationStatus.inProgress + cc.investigationStatus.completed;
    const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);

    // Auto-prioritized next actions (repository-derived; never fabricated).
    const tasks: StrategyTask[] = [];
    if (bundle.caseOverview.evidenceSummary.total === 0) {
      tasks.push({ priority: 'Highest', title: 'Upload discovery materials', why: 'No evidence is in the repository, so no element, contradiction, or timeline analysis can run.', value: 'High — unlocks all intelligence', ref: 'Repository (0 evidence items)' });
    }
    for (const m of bundle.elementMatrices) {
      for (const r of m.rows) {
        const s = r.status.toLowerCase();
        if (s.includes('unsupported')) tasks.push({ priority: 'Highest', title: `Support element: ${r.elementLabel}`, why: 'A required element is unsupported by repository evidence.', charge: `${r.code} §${r.section}`, element: r.elementLabel, value: 'High — may negate an element', ref: `Confidence ${r.confidence || 'UNKNOWN'}` });
        else if (s.includes('partial')) tasks.push({ priority: 'High', title: `Strengthen element: ${r.elementLabel}`, why: 'A required element is only partially supported.', charge: `${r.code} §${r.section}`, element: r.elementLabel, value: 'Medium-High', ref: `Confidence ${r.confidence || 'UNKNOWN'}` });
        else if (s.includes('unknown')) tasks.push({ priority: 'High', title: `Verify offense elements for ${r.code} §${r.section}`, why: 'The legislative repository lacks elements for this charge — element analysis is UNKNOWN until coverage exists.', charge: `${r.code} §${r.section}`, value: 'High — enables CALCRIM analysis', ref: 'Repository UNKNOWN' });
      }
    }
    for (const c of bundle.evidenceWorkbench.contradictions) tasks.push({ priority: 'High', title: 'Resolve/leverage contradiction', why: c.finding, value: 'High — impeachment', ref: `Status ${c.status}` });
    for (const s of bundle.investigation.recommendedSubpoenas) tasks.push({ priority: 'Medium', title: `Subpoena: ${s}`, why: 'Compel records/testimony relevant to the case.', value: 'Medium', ref: 'Repository recommendation' });
    for (const inv of bundle.investigation.recommendedInvestigation) tasks.push({ priority: 'Medium', title: inv, why: 'Investigation recommended from repository coverage.', value: 'Medium', ref: 'Repository recommendation' });
    for (const g of bundle.investigation.evidenceGaps) tasks.push({ priority: 'Low', title: `Address evidence gap`, why: g.finding, value: 'Low-Medium', ref: 'Repository gap' });

    return {
      readiness: {
        caseReadiness: cc.caseHealth.score,
        trialReadiness: cc.trialReadiness.score,
        calcrim: cc.legalCoverage.score,
        evidence: cc.evidenceHealth.score,
        timeline: cc.timelineCoverage.score,
        repoConfidence,
        mensRea: mensReaRows.length ? Math.round((mensReaSatisfied / mensReaRows.length) * 100) : null,
        witnessCount,
        contradictions: cc.contradictionCount,
        unknowns: cc.unknownCount,
        outstandingInvestigation: cc.investigationStatus.open + cc.investigationStatus.inProgress,
        discovery: cc.discoveryStatus,
        investigationCompletion: invTotal ? Math.round((cc.investigationStatus.completed / invTotal) * 100) : 0,
      },
      tasks,
    };
  }, [bundle]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Assembling litigation strategy…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!bundle || !derived) return null;

  const r = derived.readiness;
  const trialComponents = [
    { label: 'CALCRIM', score: r.calcrim, note: 'legal element coverage' },
    { label: 'Evidence', score: r.evidence, note: `${r.discovery.total} discovery` },
    { label: 'Witnesses', score: r.witnessCount > 0 ? Math.min(100, r.witnessCount * 20) : 0, note: `${r.witnessCount} listed` },
    { label: 'Mens Rea', score: r.mensRea ?? 0, note: r.mensRea === null ? 'UNKNOWN' : undefined },
    { label: 'Timeline', score: r.timeline },
    { label: 'Investigation', score: r.investigationCompletion, note: `${r.outstandingInvestigation} open` },
    { label: 'Repository Confidence', score: r.repoConfidence, note: `${r.unknowns} UNKNOWN` },
  ];
  const trialWeighted = Math.round(trialComponents.reduce((s, c) => s + c.score, 0) / trialComponents.length);

  const upcomingHearings = bundle.caseOverview.upcomingHearings.filter((h) => h.date || h.note);
  const outstandingIssues = bundle.caseOverview.outstandingUnknowns?.length ? bundle.caseOverview.outstandingUnknowns : bundle.intelligence.unknowns.all;
  const tasksByPriority = PRIORITY_ORDER.map((p) => ({ p, items: derived.tasks.filter((t) => t.priority === p) }));
  const noRealTasks = derived.tasks.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Target size={22} className="text-indigo-600" /> Litigation Strategy Center</h2>
        <p className="text-sm text-gray-500 mt-1">One executive briefing that answers: <em>what should I do next to improve this case?</em> Integrates every CourtAccess intelligence engine.</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note="composed from the Attorney Workbench engines" /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>All scores and priorities are derived from repository coverage, not legal conclusions. Sections without repository support are marked <strong>UNKNOWN</strong>. Everything requires independent attorney review.</span>
      </div>

      {/* Phase 1 — Readiness dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Metric label="Case Readiness" value={`${r.caseReadiness}%`} kind="repository" />
        <Metric label="Trial Readiness" value={`${trialWeighted}%`} kind="repository" />
        <Metric label="CALCRIM Coverage" value={`${r.calcrim}%`} sub={r.calcrim === 0 ? 'UNKNOWN / uncovered' : undefined} kind={r.calcrim > 0 ? 'repository' : 'unknown'} />
        <Metric label="Evidence Coverage" value={`${r.evidence}%`} kind="repository" />
        <Metric label="Mens Rea Coverage" value={r.mensRea === null ? 'UNKNOWN' : `${r.mensRea}%`} kind={r.mensRea === null ? 'unknown' : 'repository'} />
        <Metric label="Witness Coverage" value={r.witnessCount} sub="witnesses listed" kind={r.witnessCount ? 'repository' : 'unknown'} />
        <Metric label="Repository Confidence" value={`${r.repoConfidence}%`} sub={`${r.unknowns} UNKNOWN`} kind="repository" />
        <Metric label="Contradictions" value={r.contradictions} kind="repository" />
        <Metric label="Outstanding Investigation" value={r.outstandingInvestigation} sub="open tasks" kind="repository" />
        <Metric label="Outstanding Human Review" value={outstandingIssues.length} sub="items" kind={outstandingIssues.length ? 'repository' : 'unknown'} />
      </div>

      {/* Phase 2 — Top Attorney Priorities */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><ListChecks size={18} className="text-indigo-600" /> Top Attorney Priorities — What to do next</h3>
          <ProvenanceBadge kind={noRealTasks ? 'illustrative' : 'repository'} />
        </div>
        {noRealTasks ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <p className="text-sm text-amber-800 mb-3">No repository-derived priorities exist for this case yet. The following is an <strong>illustrative demonstration</strong> — fabricated example content, <strong>not</strong> recommendations for this case.</p>
            <div className="space-y-2">
              {ILLUSTRATIVE_TASKS.map((t, i) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{t.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_TONE[t.priority]}`}>{t.priority}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{t.why}</p>
                  <div className="mt-1 text-xs text-gray-400">{t.charge ?? ''} {t.element ? `· ${t.element}` : ''} · Value: {t.value} · {t.ref}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {tasksByPriority.filter((g) => g.items.length).map((g) => (
              <div key={g.p}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_TONE[g.p]}`}>{g.p} Priority</span>
                  <span className="text-xs text-gray-400">{g.items.length} task{g.items.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-2">
                  {g.items.map((t, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 p-3">
                      <span className="font-medium text-gray-900">{t.title}</span>
                      <p className="mt-1 text-sm text-gray-600">{t.why}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                        {t.charge && <span>Charge: {t.charge}</span>}
                        {t.element && <span>Element: {t.element}</span>}
                        <span>Value: {t.value}</span>
                        <span>Ref: {t.ref}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Phase 3 — Trial Readiness */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Gauge size={18} className="text-indigo-600" /> Trial Readiness Score</h3>
          <ProvenanceBadge kind="repository" />
        </div>
        <div className="grid md:grid-cols-[160px_1fr] gap-6 items-center">
          <div className="text-center">
            <div className={`text-4xl font-bold ${trialWeighted >= 70 ? 'text-emerald-600' : trialWeighted >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{trialWeighted}%</div>
            <div className="text-xs text-gray-500 mt-1">{bundle.commandCenter.trialReadiness.label}</div>
          </div>
          <div className="space-y-3">
            {trialComponents.map((c) => <Bar key={c.label} label={c.label} score={c.score} note={c.note} />)}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">Each component is repository-backed; "UNKNOWN" indicates the repository cannot yet support that dimension. Score = mean of components.</p>
      </Card>

      {/* Phase 4 & 5 — Defense Strategy Matrix + Investigative Action Center (integrate existing engines) */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-600" /> Defense Strategy Matrix</h3>
            <ProvenanceBadge kind="repository" />
          </div>
          <ul className="space-y-1.5 text-sm text-gray-700">
            <li className="flex justify-between"><span>Unsupported / weak elements</span><span className="font-medium">{bundle.elementMatrices.flatMap((m) => m.rows).filter((x) => x.status.toLowerCase() !== 'satisfied').length}</span></li>
            <li className="flex justify-between"><span>Potential impeachment</span><span className="font-medium">{bundle.trialPreparation.impeachmentOpportunities.length}</span></li>
            <li className="flex justify-between"><span>Statutory defenses (repository)</span><span className="font-medium">{[...bundle.offenseAnalysis.flatMap((o) => o.defenses), ...bundle.legalAuthority.defenses].length || 'UNKNOWN'}</span></li>
            <li className="flex justify-between"><span>Exceptions / immunities (repository)</span><span className="font-medium">{[...bundle.offenseAnalysis.flatMap((o) => o.exceptions), ...bundle.legalAuthority.exceptions].length || 'UNKNOWN'}</span></li>
            <li className="flex justify-between"><span>Contradictions</span><span className="font-medium">{bundle.evidenceWorkbench.contradictions.length}</span></li>
          </ul>
          <Link to={`/cases/${caseId}/defense-opportunities`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">Open Defense Opportunities <ArrowRight size={14} /></Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Search size={17} className="text-blue-600" /> Investigative Action Center</h3>
            <ProvenanceBadge kind="repository" />
          </div>
          <ul className="space-y-1.5 text-sm text-gray-700">
            <li className="flex justify-between"><span>Witnesses to interview</span><span className="font-medium">{bundle.investigation.witnessGaps.length + bundle.investigation.recommendedInvestigation.length || 'UNKNOWN'}</span></li>
            <li className="flex justify-between"><span>Outstanding subpoenas</span><span className="font-medium">{bundle.investigation.recommendedSubpoenas.length || 'UNKNOWN'}</span></li>
            <li className="flex justify-between"><span>Digital evidence requests</span><span className="font-medium">{bundle.investigation.recommendedDiscovery.length + bundle.investigation.discoveryRequests.length || 'UNKNOWN'}</span></li>
            <li className="flex justify-between"><span>Timeline verification gaps</span><span className="font-medium">{bundle.investigation.timelineGaps.length || 'UNKNOWN'}</span></li>
            <li className="flex justify-between"><span>Open investigation tasks</span><span className="font-medium">{r.outstandingInvestigation}</span></li>
          </ul>
          <Link to={`/cases/${caseId}/investigation-opportunities`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">Open Investigation Opportunities <ArrowRight size={14} /></Link>
        </Card>
      </div>

      {/* Phase 6 — Attorney Daily Briefing */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><CalendarClock size={18} className="text-indigo-600" /> Attorney Briefing</h3>
          <ProvenanceBadge kind="repository" note="current-state snapshot" />
        </div>
        <p className="text-xs text-gray-400 mb-3">Change-tracking (diff since last review) is not yet available, so this is a current-state briefing rather than a "what changed" delta (UNKNOWN for deltas).</p>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-1 flex items-center gap-1"><AlertTriangle size={14} className="text-amber-500" /> Outstanding Issues</h4>
            {outstandingIssues.length === 0 ? <p className="text-gray-500">None recorded.</p> : (
              <ul className="space-y-1 text-gray-600">{outstandingIssues.slice(0, 6).map((u, i) => <li key={i} className="flex items-start gap-1"><HelpCircle size={12} className="mt-1 text-gray-400 flex-shrink-0" />{u}</li>)}</ul>
            )}
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1 flex items-center gap-1"><CalendarClock size={14} className="text-indigo-500" /> Upcoming Hearings</h4>
            {upcomingHearings.length === 0 ? <p className="text-gray-500">None scheduled (UNKNOWN if not entered).</p> : (
              <ul className="space-y-1 text-gray-600">{upcomingHearings.map((h, i) => <li key={i}>{h.date ?? 'TBD'} — {h.note ?? ''}</li>)}</ul>
            )}
            <div className="mt-3 text-gray-600">
              <div>Evidence pending processing: <span className="font-medium">{bundle.caseOverview.evidenceSummary.processingPending}</span></div>
              <div>Contradictions to review: <span className="font-medium">{bundle.evidenceWorkbench.contradictions.length}</span></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
