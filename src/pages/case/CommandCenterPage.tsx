// ============================================================================
// Program 132 — Criminal Case Command Center
// The single executive workspace for a criminal case: unifies every existing
// CourtAccess intelligence engine into one command interface, built from the
// repository-backed Attorney Workbench bundle. CourtAccess NEVER determines
// guilt, predicts verdicts, or recommends litigation strategy — it organizes
// repository facts for attorney review. Repository / UNKNOWN / Illustrative
// labeled via ProvenanceBadge; UNKNOWN wherever repository coverage is
// insufficient. Collaboration data is repository-derived; nothing is fabricated.
// ============================================================================

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LayoutDashboard, Gauge, Landmark, ShieldCheck, Boxes, Users, ListChecks, Gavel,
  Scale, Search, FileText, HelpCircle, AlertTriangle, Clock, Share2, MessageSquareWarning,
  BookOpen, Network, ClipboardList, ArrowRight, Info, Loader2, CalendarClock, UserCheck,
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
  if (!items.length) return <p className="text-sm text-gray-500">{empty ?? 'None from current repository coverage (UNKNOWN).'}</p>;
  return <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{t}</li>)}</ul>;
}

const NAV: Array<{ id: string; label: string; icon: typeof Gauge; desc: string }> = [
  { id: 'attorney-workbench', label: 'Attorney Workbench', icon: LayoutDashboard, desc: 'Case intelligence bundle' },
  { id: 'trial-notebook', label: 'Trial Notebook', icon: BookOpen, desc: 'Work-product packet' },
  { id: 'evidence-intelligence', label: 'Evidence Intelligence', icon: Boxes, desc: 'Proof matrix & inventory' },
  { id: 'motion-intelligence', label: 'Motion Intelligence', icon: Gavel, desc: 'Motion review information' },
  { id: 'case-theory', label: 'Case Theory Center', icon: Scale, desc: 'Competing theories' },
  { id: 'cross-examination', label: 'Cross-Examination', icon: MessageSquareWarning, desc: 'Witness analysis' },
  { id: 'trial-readiness', label: 'Trial Readiness', icon: Landmark, desc: 'Courtroom preparation' },
  { id: 'case-map', label: 'Knowledge Graph / Map', icon: Network, desc: 'Relationship map' },
  { id: 'dashboard/case-timeline', label: 'Timeline', icon: Clock, desc: 'Chronology' },
  { id: 'settings', label: 'Settings', icon: ClipboardList, desc: 'Case settings' },
];

export function CommandCenterPage() {
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
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load command center'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Loading Criminal Case Command Center…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!b) return null;

  const cc = b.commandCenter;
  const inv = b.investigation;
  const ew = b.evidenceWorkbench;
  const rows = b.elementMatrices.flatMap((m) => m.rows);
  const weakRows = rows.filter((r) => r.status.toLowerCase() !== 'satisfied');
  const supported = rows.filter((r) => r.supportingEvidence.length > 0).length;
  const repoConfidence = cc.unknownCount === 0 ? 100 : Math.max(0, 100 - cc.unknownCount * 10);
  const witnessNodes = ew.graph.nodes.filter((n) => /witness/i.test(n.type)).map((n) => n.label);
  const witnessCount = new Set([...b.trialPreparation.witnessList.map((w) => w.title), ...witnessNodes]).size;
  const outstandingUnknowns = b.caseOverview.outstandingUnknowns?.length ? b.caseOverview.outstandingUnknowns : b.intelligence.unknowns.all;
  const contradictions = ew.contradictions.map((c) => c.finding);
  const openInvestigation = cc.investigationStatus.open + cc.investigationStatus.inProgress;

  // Phase 2 — highest priority issues (repository-derived, ranked by severity of gap).
  const priorityIssues: string[] = [
    ...weakRows.slice(0, 4).map((r) => `Unsupported element — ${r.code} §${r.section}: ${r.elementLabel} (${r.status}).`),
    ...contradictions.slice(0, 3).map((c) => `Contradiction — ${c}`),
    ...ew.missing.slice(0, 3).map((m) => `Missing evidence — ${m}`),
  ];
  const recentEvidence = ew.items.slice(0, 5).map((e) => `${e.fileName} (${e.evidenceType || 'UNKNOWN'}, ${e.processingStatus})`);
  const upcomingDeadlines = b.caseOverview.upcomingHearings.map((h) => `${h.date ?? 'UNKNOWN date'}: ${h.note ?? 'hearing'}`);

  // Phase 6 — collaboration (repository-derived only).
  const assignedTasks = inv.tasks.filter((t) => t.assignedTo);
  const reviewQueue = outstandingUnknowns;
  const defenseTeam = b.caseOverview.defenseTeam.map((d) => `${d.role} — ${d.userId}`);

  const health: Array<{ label: string; score: number }> = [
    { label: 'Repository health', score: repoConfidence },
    { label: 'Evidence health', score: cc.evidenceHealth.score },
    { label: 'CALCRIM support', score: cc.legalCoverage.score },
    { label: 'Timeline coverage', score: cc.timelineCoverage.score },
    { label: 'Case readiness', score: cc.caseHealth.score },
    { label: 'Trial readiness', score: cc.trialReadiness.score },
  ];
  const bar = (s: number) => (s >= 75 ? 'bg-emerald-500' : s >= 45 ? 'bg-amber-500' : 'bg-red-500');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><LayoutDashboard size={22} className="text-indigo-600" /> Criminal Case Command Center</h2>
        <p className="text-sm text-gray-500 mt-1">{b.caseOverview.case.title} · #{b.caseOverview.case.caseNumber} · {b.caseOverview.case.phase}</p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`case readiness ${cc.caseHealth.score}% · trial readiness ${cc.trialReadiness.score}% · confidence ${repoConfidence}%`} /></div>
      </div>

      {/* Mandatory disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span><strong>CourtAccess does not determine guilt, predict verdicts, or recommend litigation strategy.</strong> The Command Center organizes repository-derived facts across every engine for attorney review. Where the repository does not establish a fact, the result is <strong>UNKNOWN</strong>. All legal judgment remains with the attorney.</span>
      </div>

      {/* Phase 1 — Command dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Gauge size={20} />} value={`${cc.caseHealth.score}%`} label="Case readiness" />
        <StatCard icon={<Landmark size={20} />} value={`${cc.trialReadiness.score}%`} label="Trial readiness" />
        <StatCard icon={<ShieldCheck size={20} />} value={`${repoConfidence}%`} label="Repository confidence" />
        <StatCard icon={<Boxes size={20} />} value={`${cc.evidenceHealth.score}%`} label="Evidence coverage" />
        <StatCard icon={<Users size={20} />} value={witnessCount} label="Witness coverage" />
        <StatCard icon={<ListChecks size={20} />} value={`${cc.legalCoverage.score}%`} label="CALCRIM coverage" />
        <StatCard icon={<Gavel size={20} />} value={b.intelligence.recommendedMotions.length} label="Motion review items" />
        <StatCard icon={<Scale size={20} />} value={`${supported}/${rows.length}`} label="Elements supported" />
        <StatCard icon={<Search size={20} />} value={openInvestigation} label="Outstanding investigation" highlight={openInvestigation > 0} />
        <StatCard icon={<FileText size={20} />} value={cc.discoveryStatus.pending} label="Outstanding discovery" highlight={cc.discoveryStatus.pending > 0} />
        <StatCard icon={<AlertTriangle size={20} />} value={cc.contradictionCount} label="Contradictions" highlight={cc.contradictionCount > 0} />
        <StatCard icon={<HelpCircle size={20} />} value={cc.unknownCount} label="Outstanding human review" highlight={cc.unknownCount > 0} />
      </div>

      {/* Phase 3 — Unified case navigation */}
      <Section icon={<Network size={18} className="text-indigo-600" />} title="Unified Case Navigation" kind="repository" note="shared case context">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {NAV.map((n) => (
            <Link key={n.id} to={`/cases/${caseId}/${n.id}`} className="group rounded-lg border border-gray-200 p-3 hover:border-indigo-300 hover:shadow-sm transition">
              <div className="flex items-center justify-between">
                <n.icon size={18} className="text-indigo-600" />
                <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-500" />
              </div>
              <div className="mt-2 text-sm font-medium text-gray-800">{n.label}</div>
              <div className="text-xs text-gray-500">{n.desc}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Phase 2 — Executive Intelligence Panel */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Section icon={<ListChecks size={18} className="text-red-600" />} title="Highest-Priority Issues" kind={kindOf(priorityIssues.length)}>
          <Bullets items={priorityIssues} empty="No outstanding repository-flagged issues (all supported / none detected)." />
        </Section>
        <Section icon={<Boxes size={18} className="text-emerald-600" />} title="Recently Ingested Evidence" kind={kindOf(recentEvidence.length)}>
          <Bullets items={recentEvidence} empty="No evidence items in the repository (UNKNOWN)." />
          <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3 flex items-center gap-1"><CalendarClock size={13} />Upcoming deadlines</h4>
          <Bullets items={upcomingDeadlines} />
        </Section>
      </div>

      {/* Phase 5 — Executive Case Health */}
      <Section icon={<Gauge size={18} className="text-indigo-600" />} title="Executive Case Health" kind="repository">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
          {health.map((h) => (
            <div key={h.label}>
              <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-700">{h.label}</span><span className="font-medium text-gray-800">{h.score}%</span></div>
              <div className="h-2 w-full rounded-full bg-gray-100"><div className={`h-2 rounded-full ${bar(h.score)}`} style={{ width: `${Math.min(100, Math.max(0, h.score))}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-full border border-gray-200 px-2 py-0.5">Contradiction status: {cc.contradictionCount === 0 ? 'none detected' : `${cc.contradictionCount} flagged`}</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5">Motion review: {b.intelligence.recommendedMotions.length} item(s)</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5">Human review: {cc.unknownCount} UNKNOWN</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5">Production gate: {cc.productionGateStatus.pass}/{cc.productionGateStatus.total} ({cc.productionGateStatus.status})</span>
        </div>
      </Section>

      {/* Phase 4 — Investigation Command Panel */}
      <Section icon={<Search size={18} className="text-blue-600" />} title="Investigation Command Panel" kind={kindOf(inv.tasks.length + inv.recommendedInvestigation.length + inv.recommendedSubpoenas.length)}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Priority-ranked tasks</h4>
            {inv.tasks.length === 0 ? <p className="text-sm text-gray-500">No investigation tasks recorded (UNKNOWN).</p> : (
              <ul className="space-y-1.5">{[...inv.tasks].sort((a, c) => (a.priority > c.priority ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm"><span className="text-gray-700">{t.title}{t.assignedTo ? <span className="text-gray-400"> · {t.assignedTo}</span> : ''}</span><span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{t.priority}</span></li>
              ))}</ul>
            )}
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Witness interviews & canvassing</h4>
            <Bullets items={inv.witnessGaps.map((w) => w.finding)} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Digital evidence & subpoenas</h4>
            <Bullets items={[...inv.recommendedSubpoenas, ...inv.recommendedDiscovery.filter((d) => /digital|record|phone|device|subpoena/i.test(d))]} />
            <h4 className="text-sm font-medium text-gray-800 mb-1 mt-3">Additional investigation (surveillance / travel / scene)</h4>
            <Bullets items={inv.recommendedInvestigation} />
          </div>
        </div>
      </Section>

      {/* Phase 6 — Collaboration Overview */}
      <Section icon={<UserCheck size={18} className="text-gray-700" />} title="Collaboration Overview" kind={kindOf(defenseTeam.length + assignedTasks.length + reviewQueue.length)} note="repository-derived; no fabricated activity">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-1"><Users size={13} />Defense team</h4>
            <Bullets items={defenseTeam} empty="No team members recorded (UNKNOWN)." />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-1"><ClipboardList size={13} />Assigned tasks</h4>
            <Bullets items={assignedTasks.map((t) => `${t.title} → ${t.assignedTo} (${t.status})`)} empty="No assigned tasks recorded (UNKNOWN)." />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-1"><HelpCircle size={13} />Attorney review queue</h4>
            <Bullets items={reviewQueue} empty="No outstanding review items." />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>Collaboration information is derived solely from repository records (team membership, assigned tasks, and UNKNOWN findings requiring review). CourtAccess does not fabricate assignments or activity.</span>
        </div>
      </Section>

      {/* Cross-engine quick summary */}
      <Section icon={<Share2 size={18} className="text-purple-600" />} title="Cross-Engine Summary" kind="repository">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Link to={`/cases/${caseId}/case-theory`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50"><div className="text-gray-500 text-xs">Case Theory</div><div className="font-medium text-gray-800">{supported}/{rows.length} elements supported</div></Link>
          <Link to={`/cases/${caseId}/motion-intelligence`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50"><div className="text-gray-500 text-xs">Motion Intelligence</div><div className="font-medium text-gray-800">{b.intelligence.recommendedMotions.length} review item(s)</div></Link>
          <Link to={`/cases/${caseId}/cross-examination`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50"><div className="text-gray-500 text-xs">Cross-Examination</div><div className="font-medium text-gray-800">{cc.contradictionCount} contradiction(s)</div></Link>
          <Link to={`/cases/${caseId}/evidence-intelligence`} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50"><div className="text-gray-500 text-xs">Evidence Intelligence</div><div className="font-medium text-gray-800">{ew.items.length} item(s)</div></Link>
        </div>
      </Section>
    </div>
  );
}
