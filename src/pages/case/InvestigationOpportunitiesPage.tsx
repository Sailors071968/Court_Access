// ============================================================================
// Program 118 — Investigation Opportunities
// Repository-backed investigative intelligence derived from the Attorney
// Workbench bundle: witnesses to interview, subpoenas, digital evidence
// requests, evidence/timeline gaps, and open tasks — with priority ranking and
// expected litigation value. Constitution-faithful: repository-backed vs
// illustrative are labeled separately; UNKNOWN where coverage is incomplete.
// ============================================================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Users, Send, FileSearch, Clock, ListChecks, Loader2, Info, MapPin,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ProvenanceBadge } from '../../components/common/ProvenanceBadge';
import { fetchWorkbench, type WorkbenchBundle } from '../../services/workbenchApi';

const ILLUSTRATIVE_OPPS = [
  { icon: <Users size={15} className="text-blue-500" />, title: 'Interview the corner-store clerk (canvass)', value: 'High', detail: 'A business 40 ft from the scene likely has an exterior camera covering the 02:10–02:45 gap.' },
  { icon: <MapPin size={15} className="text-emerald-500" />, title: 'Canvass businesses along Main St for surveillance', value: 'High', detail: 'Three businesses on the approach route may hold footage of the defendant\'s movements.' },
  { icon: <Send size={15} className="text-amber-500" />, title: 'Subpoena cell-site records for travel-time verification', value: 'Medium', detail: 'Verify whether the defendant could have traveled between locations in the alleged window.' },
];

function priorityRank(p: string): number {
  const s = (p || '').toLowerCase();
  if (s.includes('critical') || s.includes('high')) return 0;
  if (s.includes('medium')) return 1;
  return 2;
}
function valueLabel(p: string): string {
  const r = priorityRank(p);
  return r === 0 ? 'High' : r === 1 ? 'Medium' : 'Standard';
}
function valueTone(p: string): string {
  const r = priorityRank(p);
  return r === 0 ? 'bg-red-50 text-red-700 border-red-200'
    : r === 1 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-gray-100 text-gray-600 border-gray-300';
}

export function InvestigationOpportunitiesPage() {
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load opportunities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Identifying investigative opportunities…</span>
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!bundle) return null;

  const inv = bundle.investigation;
  const witnesses = [...inv.witnessGaps.map((w) => w.finding), ...inv.recommendedInvestigation];
  const subpoenas = inv.recommendedSubpoenas;
  const discovery = [...inv.recommendedDiscovery, ...inv.discoveryRequests.map((d) => d.title)];
  const timeline = inv.timelineGaps.map((t) => t.finding);
  const tasks = [...inv.tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  const totalOpps = witnesses.length + subpoenas.length + discovery.length + timeline.length + tasks.length;
  const isEmptyCase = totalOpps === 0;

  const sections: Array<{ icon: React.ReactNode; title: string; items: string[]; hint: string }> = [
    { icon: <Users size={18} className="text-blue-600" />, title: 'Witnesses to Interview', items: witnesses, hint: 'Derived from witness gaps and recommended investigation.' },
    { icon: <Send size={18} className="text-amber-600" />, title: 'Outstanding Subpoenas', items: subpoenas, hint: 'Records and testimony to compel.' },
    { icon: <FileSearch size={18} className="text-emerald-600" />, title: 'Digital Evidence Requests', items: discovery, hint: 'Discovery and digital records to request.' },
    { icon: <Clock size={18} className="text-indigo-600" />, title: 'Timeline & Travel-Time Verification', items: timeline, hint: 'Gaps requiring corroboration or reconstruction.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Search size={22} className="text-indigo-600" /> Investigation Opportunities
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Prioritized, repository-backed investigative leads and their expected litigation value.
        </p>
        <div className="mt-2"><ProvenanceBadge kind="repository" note={`${totalOpps} opportunities`} /></div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Opportunities are analytical suggestions from repository coverage, not directives.
        Priority/value reflect recorded task priority; attorneys and investigators must exercise judgment.</span>
      </div>

      {isEmptyCase && (
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-amber-900">Illustrative Opportunities</h3>
            <ProvenanceBadge kind="illustrative" note="example only — not this case" />
          </div>
          <p className="text-sm text-amber-800 mb-4">
            No investigative leads exist for this case yet. The following is an <strong>illustrative
            demonstration</strong> of the opportunities CourtAccess surfaces once evidence and timeline
            data are ingested — fabricated example content, <strong>not</strong> findings about this case.
          </p>
          <div className="space-y-3">
            {ILLUSTRATIVE_OPPS.map((o, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-white p-4">
                <span className="mt-0.5">{o.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{o.title}</span>
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Value: {o.value}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{o.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Priority-ranked tasks (repository-backed) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ListChecks size={18} className="text-indigo-600" /> Priority-Ranked Investigation Tasks
          </h3>
          <ProvenanceBadge kind={tasks.length ? 'repository' : 'unknown'} />
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No investigation tasks recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">{t.title}</span>
                  <span className="ml-2 text-xs text-gray-400">{t.status}</span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${valueTone(t.priority)}`}>
                  Value: {valueLabel(t.priority)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {sections.map((sec) => (
        <Card key={sec.title}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">{sec.icon} {sec.title}</h3>
            <ProvenanceBadge kind={sec.items.length ? 'repository' : 'unknown'} />
          </div>
          <p className="text-xs text-gray-400 mb-3">{sec.hint}</p>
          {sec.items.length === 0 ? (
            <p className="text-sm text-gray-500">None identified from current repository coverage (UNKNOWN).</p>
          ) : (
            <ul className="space-y-2">
              {sec.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{item}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
